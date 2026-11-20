/**
 * Call History, backed by bolna-app's Postgres table call_results (local_setup/call_results.py).
 *
 *   listCalls    -> GET /api/bolna/call-history?agent_id=&status=&call_type=&provider=&voicemail=&from=&to=&q=&page=&page_size=&sort=&direction=
 *   callStats    -> GET /api/bolna/call-history/stats?<same filters>
 *   callsPerDay  -> GET /api/bolna/call-history/timeseries?days=&agent_id=
 *   getCall      -> GET /api/bolna/call-history/{id}
 *   setRating    -> PUT /api/bolna/call-history/{id}/rating   { rating }
 *   csvPath      ->     /call-history/export.csv?<same filters>  (fetched with the token, then saved)
 *   recording    ->     /call-history/{id}/recording           (fetched with the token, then played)
 */
import type { CallStatus, CallType, HangupBy } from "@/config/calls";
import { bolnaApi } from "@/lib/api";
import type { CallFilters, CallRecord, CallStats, Page, TranscriptTurn } from "@/types/call";
import { listAgents } from "./agents";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Agent names for the rows (the table stores only agent_id); refreshed at most every 30 s.
let agentNames: { at: number; names: Promise<Map<string, string>> } | null = null;
function names(): Promise<Map<string, string>> {
  if (!agentNames || Date.now() - agentNames.at > 30_000) {
    const names = listAgents()
      .then((agents) => new Map(agents.map((a) => [a.id, a.name])))
      .catch(() => new Map<string, string>());
    agentNames = { at: Date.now(), names };
  }
  return agentNames.names;
}

function query(filters: Omit<CallFilters, "page" | "pageSize" | "sort">, extra: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  const add = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  };
  add("agent_id", filters.agentId);
  add("status", filters.status);
  add("call_type", filters.type);
  add("provider", filters.provider);
  add("voicemail", filters.voicemail);
  add("from", filters.from);
  add("to", filters.to);
  add("q", filters.search?.trim());
  for (const [k, v] of Object.entries(extra)) add(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

function toTranscript(raw: unknown): TranscriptTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m: Json) => typeof m?.content === "string")
    .map((m: Json) => ({ role: m.role === "assistant" ? "agent" : m.role === "user" ? "user" : "system", text: m.content }));
}

function toCall(row: Json, agentName: string): CallRecord {
  const completed = row.status === "completed";
  return {
    id: row.run_id,
    callSid: row.call_sid ?? undefined,
    agentId: row.agent_id,
    agentName: agentName || "Deleted agent",
    type: (row.call_type ?? "outbound") as CallType,
    status: row.status as CallStatus,
    userNumber: row.user_number ? `+${String(row.user_number).replace(/^\+/, "")}` : undefined,
    provider: row.provider ?? "plivo",
    startedAt: row.started_at ?? row.created_at,
    durationSeconds: Number(row.conversation_time ?? 0),
    hangupBy: (row.hangup_by ?? undefined) as HangupBy | undefined,
    terminationReason: row.hangup_reason ?? undefined,
    // A bolna-app path; the player fetches it with the login token (lib/api fetchBlobUrl).
    recordingUrl: completed && row.call_sid ? `/call-history/${encodeURIComponent(row.run_id)}/recording` : undefined,
    transcript: toTranscript(row.transcript),
    latencies: Array.isArray(row.latencies) ? row.latencies : [],
    summary: row.summary ?? undefined,
    extracted: row.extracted_data ?? undefined,
    rating: row.rating ?? undefined,
    webhook: row.webhook_url ? { url: row.webhook_url, status: row.webhook_status ?? undefined, error: row.webhook_error ?? undefined } : undefined,
  };
}

const SORT_FIELDS: Record<NonNullable<CallFilters["sort"]>["field"], string> = { startedAt: "started_at", durationSeconds: "duration" };

export async function listCalls(filters: CallFilters): Promise<Page<CallRecord>> {
  const [data, agents] = await Promise.all([
    bolnaApi.get<{ items: Json[]; total: number; page: number; page_size: number }>(
      `/call-history${query(filters, {
        page: filters.page,
        page_size: filters.pageSize,
        sort: filters.sort ? SORT_FIELDS[filters.sort.field] : undefined,
        direction: filters.sort?.dir,
      })}`,
    ),
    names(),
  ]);
  return {
    items: data.items.map((row) => toCall(row, agents.get(row.agent_id) ?? "")),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
  };
}

export async function getCall(id: string): Promise<CallRecord> {
  const [row, agents] = await Promise.all([bolnaApi.get<Json>(`/call-history/${encodeURIComponent(id)}`), names()]);
  return toCall(row, agents.get(row.agent_id) ?? "");
}

export async function callStats(filters: Omit<CallFilters, "page" | "pageSize">): Promise<CallStats> {
  const s = await bolnaApi.get<Json>(`/call-history/stats${query(filters)}`);
  return {
    total: s.total,
    completed: s.completed,
    totalDurationSeconds: s.total_duration_seconds,
    avgDurationSeconds: s.avg_duration_seconds,
    avgLatencyMs: s.avg_latency_ms,
    byStatus: s.by_status ?? {},
  };
}

export interface DayBucket {
  date: string; // YYYY-MM-DD
  total: number;
  completed: number;
}

export async function callsPerDay(days = 14, agentId?: string): Promise<DayBucket[]> {
  const params = new URLSearchParams({ days: String(days) });
  if (agentId) params.set("agent_id", agentId);
  return bolnaApi.get(`/call-history/timeseries?${params}`);
}

export async function setRating(id: string, rating: number | null): Promise<void> {
  await bolnaApi.put(`/call-history/${encodeURIComponent(id)}/rating`, { rating });
}

/** bolna-app path of the CSV of every call matching the filters (all pages); fetch it with fetchBlobUrl. */
export function csvPath(filters: Omit<CallFilters, "page" | "pageSize">): string {
  return `/call-history/export.csv${query(filters)}`;
}
