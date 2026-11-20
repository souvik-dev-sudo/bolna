"""Every call's record: stored in Postgres, sent to the agent's webhook, and read by Call History.

The websocket handler collects each task's output (the conversation, then the summary and
extraction follow-up tasks) and calls `finish_call` once they are all done. A call that never
reached the agent (busy / no answer / failed) is stored by `record_unanswered` from Plivo's
hangup callback. Nothing here can affect the call itself: every failure is logged and swallowed.

Table `call_results` (created and extended on first use):
    run_id            text primary key   the execution ID (TaskManager run_id; the ref for unanswered calls)
    agent_id          text
    call_sid          text               telephony call id (Plivo CallUUID)
    status            text               completed / busy / no-answer / failed / canceled
    conversation_time double precision   seconds
    transcript        jsonb              [{role, content}, ...]
    summary           text               null when Call Summary is off
    extracted_data    jsonb              null when there are no extraction categories
    hangup_reason     text               the engine's HangupReason, "user_hangup", or the Plivo status
    recording_url     text
    webhook_url       text
    webhook_status    integer            HTTP status of the webhook POST, null if not sent
    webhook_error     text
    created_at        timestamptz        when the row was written
    ref               text               the dashboard's reference for a tracked call, if any
    user_number       text               the number called
    call_type         text               outbound (inbound / web are not built yet)
    provider          text               plivo
    hangup_by         text               agent / user / system
    started_at        timestamptz        "Initiated At": when the call was placed or connected
    latencies         jsonb              [{turn, transcriberMs, llmMs, synthesizerMs, totalMs}, ...]
    rating            smallint           1-5, set from Call History
"""

import csv
import io
import json
from datetime import datetime, timezone

import aiohttp

import database
from bolna.helpers.logger_config import configure_logger

logger = configure_logger(__name__)

WEBHOOK_TIMEOUT_S = 10

SCHEMA = """
CREATE TABLE IF NOT EXISTS call_results (
    run_id            text PRIMARY KEY,
    agent_id          text NOT NULL,
    call_sid          text,
    status            text NOT NULL,
    conversation_time double precision,
    transcript        jsonb,
    summary           text,
    extracted_data    jsonb,
    hangup_reason     text,
    recording_url     text,
    webhook_url       text,
    webhook_status    integer,
    webhook_error     text,
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_results_agent_created ON call_results (agent_id, created_at DESC);
ALTER TABLE call_results ADD COLUMN IF NOT EXISTS ref text;
CREATE INDEX IF NOT EXISTS call_results_ref ON call_results (ref);
ALTER TABLE call_results ADD COLUMN IF NOT EXISTS user_number text;
ALTER TABLE call_results ADD COLUMN IF NOT EXISTS call_type text NOT NULL DEFAULT 'outbound';
ALTER TABLE call_results ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'plivo';
ALTER TABLE call_results ADD COLUMN IF NOT EXISTS hangup_by text;
ALTER TABLE call_results ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE call_results ADD COLUMN IF NOT EXISTS latencies jsonb;
ALTER TABLE call_results ADD COLUMN IF NOT EXISTS rating smallint;
UPDATE call_results SET started_at = created_at - make_interval(secs => coalesce(conversation_time, 0))
    WHERE started_at IS NULL;
CREATE INDEX IF NOT EXISTS call_results_started ON call_results (started_at DESC);
"""

# Hang-up reasons that mean the platform, not the agent or the caller, ended the call.
SYSTEM_HANGUPS = {
    "inactivity_timeout",
    "max_duration_reached",
    "web_call_max_duration_reached",
    "transcriber_error",
    "transcriber_connection_error",
    "synthesizer_error",
    "llm_error",
}
# Plivo CallStatus -> our status, for calls that never reached the agent.
UNANSWERED_STATUS = {"busy": "busy", "no-answer": "no-answer", "timeout": "no-answer", "canceled": "canceled",
                     "cancel": "canceled", "failed": "failed"}

_schema_ready = False


def _text(value):
    """Enums (HangupReason) and other values as plain strings."""
    if value is None:
        return None
    return getattr(value, "value", value) if not isinstance(value, str) else value


def _messages(conversation):
    """The call's turns as [{role, content}], without the system prompt."""
    out = []
    for m in conversation.get("messages") or []:
        role = _text(m.get("role"))
        content = m.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            out.append({"role": role, "content": content})
    return out


def turn_latencies(latency_dict):
    """Per reply: how long the caller waited (totalMs), split into the LLM's first token, the voice's
    first audio, and the rest (transcription, end-of-turn detection and the linear delay)."""
    if not isinstance(latency_dict, dict):
        return []
    by_seq = lambda section: {  # noqa: E731
        t.get("sequence_id"): t for t in ((latency_dict.get(section) or {}).get("turn_latencies") or []) if isinstance(t, dict)
    }
    llm, synth = by_seq("llm_latencies"), by_seq("synthesizer_latencies")
    out = []
    for i, turn in enumerate(latency_dict.get("user_bot_latencies") or []):
        total = turn.get("latency_ms")
        if not isinstance(total, (int, float)) or total <= 0:
            continue
        seq = turn.get("sequence_id")
        llm_ms = (llm.get(seq) or {}).get("first_token_latency_ms") or 0
        synth_ms = (synth.get(seq) or {}).get("first_result_latency_ms") or 0
        out.append(
            {
                "turn": len(out) + 1,
                "llmMs": round(llm_ms),
                "synthesizerMs": round(synth_ms),
                "transcriberMs": max(0, round(total - llm_ms - synth_ms)),
                "totalMs": round(total),
            }
        )
    return out


def _hangup(conversation):
    """(hangup_reason, hangup_by) for a call that reached the agent."""
    reason = _text(conversation.get("hangup_detail"))
    if reason in SYSTEM_HANGUPS:
        return reason, "system"
    if conversation.get("ended_by_assistant") or reason in ("llm_prompted_hangup", "end_call_tool", "voicemail_detected"):
        return reason or "llm_prompted_hangup", "agent"
    return reason or "user_hangup", "user"


def build_result(agent_id, agent_config, outputs, ref=None, tracked=None, started_at=None):
    """One call's result from the task outputs ({task_type: output})."""
    conversation = outputs.get("conversation") or {}
    messages = _messages(conversation)
    summary = (outputs.get("summarization") or {}).get("summary")
    extracted = (outputs.get("extraction") or {}).get("extracted_data")
    reason, hangup_by = _hangup(conversation)
    now = datetime.now(timezone.utc)
    return {
        "run_id": conversation.get("run_id"),
        "agent_id": agent_id,
        "call_sid": conversation.get("call_sid"),
        "status": "completed",
        "conversation_time": round(float(conversation.get("conversation_time") or 0), 2),
        "transcript": messages,
        "summary": summary if isinstance(summary, str) else (json.dumps(summary) if summary else None),
        "extracted_data": extracted if isinstance(extracted, dict) else None,
        "hangup_reason": reason,
        "hangup_by": hangup_by,
        "recording_url": conversation.get("recording_url"),
        "ended_by_assistant": bool(conversation.get("ended_by_assistant")),
        "created_at": now,
        "started_at": started_at or now,
        "webhook_url": (agent_config.get("webhook_url") or "").strip() or None,
        "ref": ref,
        "user_number": (tracked or {}).get("phone"),
        "call_type": "outbound",
        "provider": "plivo",
        "latencies": turn_latencies(conversation.get("latency_dict")),
    }


def webhook_payload(result):
    """Bolna-style execution payload."""
    transcript = "".join(f"{m['role']}: {m['content']}\n" for m in result["transcript"])
    created = result["created_at"].isoformat()
    return {
        "id": result["run_id"],
        "agent_id": result["agent_id"],
        "status": result["status"],
        "conversation_time": result["conversation_time"],
        "transcript": transcript,
        "summary": result["summary"],
        "extracted_data": result["extracted_data"],
        "telephony_data": {
            "provider_call_id": result["call_sid"],
            "provider": result["provider"],
            "to_number": result["user_number"],
            "call_type": result["call_type"],
            "recording_url": result["recording_url"],
            "hangup_reason": result["hangup_reason"],
            "hangup_by": "assistant" if result["hangup_by"] == "agent" else result["hangup_by"],
        },
        "created_at": created,
        "updated_at": created,
    }


async def send_webhook(url, headers, payload):
    """POSTs the payload. Returns (http_status or None, error or None)."""
    try:
        timeout = aiohttp.ClientTimeout(total=WEBHOOK_TIMEOUT_S)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload, headers=headers or {}) as response:
                if response.status >= 400:
                    body = (await response.text())[:300]
                    return response.status, f"HTTP {response.status}: {body}"
                return response.status, None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"[:300]


async def _ensure_schema(conn):
    global _schema_ready
    if not _schema_ready:
        await conn.execute(SCHEMA)
        _schema_ready = True


async def _connection():
    pool = await database.get_pool()
    conn = await pool.acquire()
    try:
        await _ensure_schema(conn)
    except Exception:
        await pool.release(conn)
        raise
    return pool, conn


async def store_result(result):
    if not database.is_configured():
        logger.info(f"call_results: DATABASE_URL not set, result for run_id={result['run_id']} not stored")
        return
    pool, conn = await _connection()
    try:
        await conn.execute(
            """
            INSERT INTO call_results (run_id, agent_id, call_sid, status, conversation_time, transcript, summary,
                                      extracted_data, hangup_reason, recording_url, webhook_url, webhook_status,
                                      webhook_error, created_at, ref, user_number, call_type, provider, hangup_by,
                                      started_at, latencies)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                    $19, $20, $21::jsonb)
            ON CONFLICT (run_id) DO UPDATE SET
                summary = EXCLUDED.summary, extracted_data = EXCLUDED.extracted_data,
                webhook_status = EXCLUDED.webhook_status, webhook_error = EXCLUDED.webhook_error
            """,
            result["run_id"],
            result["agent_id"],
            result["call_sid"],
            result["status"],
            result["conversation_time"],
            json.dumps(result["transcript"], ensure_ascii=False),
            result["summary"],
            json.dumps(result["extracted_data"], ensure_ascii=False) if result["extracted_data"] is not None else None,
            result["hangup_reason"],
            result["recording_url"],
            result["webhook_url"],
            result.get("webhook_status"),
            result.get("webhook_error"),
            result["created_at"],
            result.get("ref"),
            result.get("user_number"),
            result.get("call_type") or "outbound",
            result.get("provider") or "plivo",
            result.get("hangup_by"),
            result.get("started_at"),
            json.dumps(result.get("latencies") or []),
        )
    finally:
        await pool.release(conn)


async def record_unanswered(tracked, plivo_status, cause=None, call_uuid=None):
    """A tracked call that never reached the agent: one row with Plivo's status. Never raises.
    `cause` (Plivo's HangupCause) is only logged; the row's reason is the status in our terms."""
    if not database.is_configured():
        return
    try:
        status = UNANSWERED_STATUS.get((plivo_status or "").lower(), "failed")
        created = tracked.get("created_at")
        started_at = datetime.fromisoformat(created) if created else datetime.now(timezone.utc)
        pool, conn = await _connection()
        try:
            await conn.execute(
                """
                INSERT INTO call_results (run_id, agent_id, call_sid, status, conversation_time, transcript,
                                          hangup_reason, created_at, ref, user_number, call_type, provider,
                                          hangup_by, started_at, latencies)
                VALUES ($1, $2, $3, $4, 0, '[]'::jsonb, $5, now(), $1, $6, 'outbound', 'plivo', NULL, $7, '[]'::jsonb)
                ON CONFLICT (run_id) DO NOTHING
                """,
                tracked["ref"],
                tracked["agent_id"],
                call_uuid,
                status,
                {"no-answer": "no_answer", "busy": "busy", "canceled": "canceled"}.get(status, "error"),
                tracked.get("phone"),
                started_at,
            )
        finally:
            await pool.release(conn)
        logger.info(f"call_results: stored unanswered call ref={tracked['ref']} status={status} cause={cause}")
    except Exception as e:
        logger.error(f"call_results: could not store unanswered call {tracked.get('ref')}: {type(e).__name__}: {e}")


def _row(row):
    """A row as JSON-friendly values."""
    out = dict(row)
    for key in ("transcript", "extracted_data", "latencies"):
        if isinstance(out.get(key), str):
            out[key] = json.loads(out[key])
    for key in ("created_at", "started_at"):
        if out.get(key) is not None:
            out[key] = out[key].isoformat()
    return out


async def result_by_ref(ref):
    """The stored result of a tracked call, or None."""
    if not database.is_configured():
        return None
    try:
        pool, conn = await _connection()
        try:
            row = await conn.fetchrow("SELECT * FROM call_results WHERE ref = $1 ORDER BY created_at DESC LIMIT 1", ref)
        finally:
            await pool.release(conn)
    except Exception as e:
        logger.error(f"call_results: could not read ref={ref}: {type(e).__name__}: {e}")
        return None
    return _row(row) if row else None


async def finish_call(agent_id, agent_config, outputs, ref=None, tracked=None, started_at=None):
    """Sends the webhook (if the agent has one), then stores the result. Never raises."""
    try:
        result = build_result(agent_id, agent_config, outputs, ref, tracked, started_at)
        if not result["run_id"]:
            logger.warning(f"call_results: no conversation output for agent {agent_id}, nothing stored")
            return
        if result["webhook_url"]:
            status, error = await send_webhook(
                result["webhook_url"], agent_config.get("webhook_headers"), webhook_payload(result)
            )
            result["webhook_status"], result["webhook_error"] = status, error
            if error:
                logger.warning(f"call_results: webhook for run_id={result['run_id']} failed: {error}")
            else:
                logger.info(f"call_results: webhook for run_id={result['run_id']} delivered ({status})")
        await store_result(result)
        logger.info(
            f"call_results: stored run_id={result['run_id']} summary={'yes' if result['summary'] else 'no'} "
            f"extracted_fields={len(result['extracted_data'] or {})}"
        )
    except Exception as e:
        logger.error(f"call_results: could not finish call for agent {agent_id}: {type(e).__name__}: {e}", exc_info=True)


# --------------------------------------------------------------------------------------------
# Call History queries
# --------------------------------------------------------------------------------------------
SORTABLE = {"started_at": "started_at", "duration": "conversation_time"}
LIST_COLUMNS = (
    "run_id, agent_id, call_sid, status, conversation_time, hangup_reason, hangup_by, user_number, call_type, "
    "provider, started_at, created_at, rating, summary, extracted_data, ref"
)


def _where(filters):
    """SQL WHERE clause and its arguments for the Call History filters."""
    clauses, args = [], []

    def add(sql, value):
        args.append(value)
        clauses.append(sql.replace("?", f"${len(args)}"))

    if filters.get("agent_id"):
        add("agent_id = ?", filters["agent_id"])
    if filters.get("status"):
        add("status = ?", filters["status"])
    if filters.get("call_type"):
        add("call_type = ?", filters["call_type"])
    if filters.get("provider"):
        add("provider = ?", filters["provider"])
    if filters.get("voicemail") == "yes":
        clauses.append("hangup_reason = 'voicemail_detected'")
    elif filters.get("voicemail") == "no":
        clauses.append("hangup_reason IS DISTINCT FROM 'voicemail_detected'")
    if filters.get("from"):
        add("started_at >= ?", filters["from"])
    if filters.get("to"):
        add("started_at <= ?", filters["to"])
    q = (filters.get("q") or "").strip()
    if q:
        digits = "".join(ch for ch in q if ch.isdigit())
        args.append(f"%{q}%")
        n = len(args)
        number_clause = ""
        # Only a phone-like query searches numbers; "83ac" (an ID prefix) must not match every number with 83.
        if len(digits) >= 3 and all(ch.isdigit() or ch in " +-()" for ch in q):
            args.append(f"%{digits}%")
            number_clause = f" OR user_number LIKE ${len(args)}"
        clauses.append(f"(run_id ILIKE ${n} OR call_sid ILIKE ${n}{number_clause})")
    return ("WHERE " + " AND ".join(clauses)) if clauses else "", args


async def _fetch(query, args, many=True):
    pool, conn = await _connection()
    try:
        return await (conn.fetch(query, *args) if many else conn.fetchrow(query, *args))
    finally:
        await pool.release(conn)


async def list_calls(filters, page=1, page_size=20, sort="started_at", direction="desc"):
    where, args = _where(filters)
    column = SORTABLE.get(sort, "started_at")
    direction = "ASC" if direction == "asc" else "DESC"
    total = (await _fetch(f"SELECT count(*) AS n FROM call_results {where}", args, many=False))["n"]
    offset = max(0, (page - 1) * page_size)
    rows = await _fetch(
        f"SELECT {LIST_COLUMNS} FROM call_results {where} "
        f"ORDER BY {column} {direction} NULLS LAST, run_id LIMIT {int(page_size)} OFFSET {int(offset)}",
        args,
    )
    return {"items": [_row(r) for r in rows], "total": total, "page": page, "page_size": page_size}


async def call_stats(filters):
    where, args = _where(filters)
    row = await _fetch(
        f"""SELECT count(*) AS total,
                   count(*) FILTER (WHERE status = 'completed') AS completed,
                   coalesce(sum(conversation_time), 0) AS total_duration,
                   coalesce(avg(conversation_time) FILTER (WHERE status = 'completed'), 0) AS avg_duration
            FROM call_results {where}""",
        args,
        many=False,
    )
    by_status = await _fetch(f"SELECT status, count(*) AS n FROM call_results {where} GROUP BY status", args)
    # Average reply time over every measured turn of the matching calls.
    latency = await _fetch(
        f"""SELECT avg((t->>'totalMs')::float) AS avg_ms
            FROM (SELECT latencies FROM call_results {where}) c, jsonb_array_elements(coalesce(c.latencies, '[]')) t""",
        args,
        many=False,
    )
    return {
        "total": row["total"],
        "completed": row["completed"],
        "total_duration_seconds": float(row["total_duration"]),
        "avg_duration_seconds": float(row["avg_duration"]),
        "avg_latency_ms": float(latency["avg_ms"] or 0),
        "by_status": {r["status"]: r["n"] for r in by_status},
    }


async def calls_per_day(days, agent_id=None):
    """[{date, total, completed}] for the last `days` days (UTC), oldest first, with empty days included."""
    args = [int(days)]
    agent_clause = ""
    if agent_id:
        args.append(agent_id)
        agent_clause = "AND agent_id = $2"
    rows = await _fetch(
        f"""SELECT d::date AS date,
                   count(c.run_id) AS total,
                   count(c.run_id) FILTER (WHERE c.status = 'completed') AS completed
            FROM generate_series(current_date - ($1 - 1), current_date, interval '1 day') AS d
            LEFT JOIN call_results c ON c.started_at::date = d::date {agent_clause}
            GROUP BY d ORDER BY d""",
        args,
    )
    return [{"date": r["date"].isoformat(), "total": r["total"], "completed": r["completed"]} for r in rows]


async def get_call(run_id):
    row = await _fetch("SELECT * FROM call_results WHERE run_id = $1", [run_id], many=False)
    return _row(row) if row else None


async def set_rating(run_id, rating):
    row = await _fetch(
        "UPDATE call_results SET rating = $2 WHERE run_id = $1 RETURNING run_id, rating", [run_id, rating], many=False
    )
    return dict(row) if row else None


CSV_COLUMNS = [
    "execution_id", "agent_id", "agent_name", "user_number", "call_type", "provider", "status", "initiated_at",
    "duration_s", "hangup_by", "termination_reason", "rating", "summary", "extracted_data",
]


async def export_csv(filters, agent_names):
    where, args = _where(filters)
    rows = await _fetch(f"SELECT {LIST_COLUMNS} FROM call_results {where} ORDER BY started_at DESC NULLS LAST", args)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_COLUMNS)
    for r in map(_row, rows):
        writer.writerow([
            r["run_id"], r["agent_id"], agent_names.get(r["agent_id"], ""), r.get("user_number") or "",
            r["call_type"], r["provider"], r["status"], r.get("started_at") or "", r.get("conversation_time") or 0,
            r.get("hangup_by") or "", r.get("hangup_reason") or "", r.get("rating") or "", r.get("summary") or "",
            json.dumps(r["extracted_data"], ensure_ascii=False) if r.get("extracted_data") else "",
        ])
    return buf.getvalue()
