import os
import re
from urllib.parse import urlparse
import asyncio
import base64
import json
import hashlib
import io
import shutil
import uuid
import wave
import traceback
from datetime import datetime, timezone
import aiohttp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Body, Header, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis
from dotenv import load_dotenv
from bolna.constants import DEFAULT_LANGUAGE_CODE, PREPROCESS_DIR
from bolna.helpers.utils import VARIABLE_PATH, agent_welcome_text, store_file, update_prompt_with_context
from bolna.prompts import *
from bolna.helpers.logger_config import configure_logger
from bolna.models import *
from pydantic import ValidationError
from bolna.llms import LiteLLM
from bolna.agent_manager.assistant_manager import AssistantManager
import call_results
import dashboard_auth
import database

load_dotenv()
logger = configure_logger(__name__)

redis_pool = redis.ConnectionPool.from_url(os.getenv("REDIS_URL"), decode_responses=True)
redis_client = redis.Redis.from_pool(redis_pool)
active_websockets: List[WebSocket] = []

# Rendered welcome and static node audio are cached in Redis under these prefixes (not agent keys)
WELCOME_AUDIO_PREFIX = "welcome_audio:"
STATIC_AUDIO_PREFIX = "static_audio:"
AUDIO_CACHE_PREFIXES = (WELCOME_AUDIO_PREFIX, STATIC_AUDIO_PREFIX)
WELCOME_AUDIO_TTL_S = 30 * 24 * 3600
background_tasks = set()


def run_in_background(coro):
    task = asyncio.create_task(coro)
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)


def prerender_welcome_audio(agent_config):
    """Renders the greeting in the background so the first call does not wait for it. A greeting with
    {variables} is rendered per call instead, once the call's values are known."""
    if has_variables(agent_welcome_text(agent_config)):
        return
    run_in_background(get_welcome_audio(agent_config))


VARIABLE_RE = re.compile(r"\{\{?\s*" + VARIABLE_PATH + r"\s*\}?\}")


def has_variables(text):
    return bool(text) and bool(VARIABLE_RE.search(text))


def prerender_static_audio(agent_config):
    """Renders every static node message in the background so calls play them without live TTS."""
    run_in_background(get_static_audio(agent_config))


app = FastAPI()


#############################################################################################
# Dashboard login (TRACKER F7, local_setup/dashboard_auth.py)
#############################################################################################
# Every HTTP route needs the login cookie or plivo-app's internal token, except /auth/*.
# The call stream (/chat/v1/{agent_id}) is a websocket, which this HTTP middleware never sees:
# Plivo connects to it directly.

if not dashboard_auth.enabled():
    logger.warning("DASHBOARD_USERNAME / DASHBOARD_PASSWORD not set: the dashboard API stays locked until they are")


@app.middleware("http")
async def require_login(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path.startswith("/auth/"):
        return await call_next(request)
    if dashboard_auth.request_session_ok(request) or dashboard_auth.internal_ok(
        request.headers.get(dashboard_auth.INTERNAL_HEADER)
    ):
        return await call_next(request)
    return JSONResponse(status_code=401, content={"detail": "Sign in required"})


# Added after require_login so it wraps it: 401s also carry the CORS headers the browser needs to
# read them. Only the dashboard's sites may call; the token travels in the Authorization header,
# so no cross-site request carries cookies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=dashboard_auth.allowed_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)


class LoginPayload(BaseModel):
    username: str = Field(..., max_length=200)
    password: str = Field(..., max_length=200)


@app.post("/auth/login")
async def auth_login(payload: LoginPayload, request: Request, response: Response):
    if not dashboard_auth.enabled():
        raise HTTPException(
            status_code=503, detail="Sign-in is not set up: DASHBOARD_USERNAME or DASHBOARD_PASSWORD is missing on the server"
        )
    if dashboard_auth.locked_out():
        raise HTTPException(status_code=429, detail="Too many wrong passwords. Try again in 15 minutes.")
    if not dashboard_auth.credentials_ok(payload.username, payload.password):
        dashboard_auth.record_bad_password()
        logger.warning("Dashboard sign-in: wrong username or password")
        # One message for both, so it doesn't reveal which part was right.
        raise HTTPException(status_code=401, detail="Wrong username or password")
    token = dashboard_auth.new_session()
    response.set_cookie(value=token, **dashboard_auth.cookie_options(dashboard_auth.is_https(request)))
    # The token is also returned for dashboards on another site, which send it as "Authorization: Bearer".
    return {"signed_in": True, "token": token}


@app.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    options = dashboard_auth.cookie_options(dashboard_auth.is_https(request))
    response.delete_cookie(options["key"], path=options["path"], secure=options["secure"], httponly=True, samesite="lax")
    return {"signed_in": False}


@app.get("/auth/me")
async def auth_me(request: Request):
    return {
        "signed_in": dashboard_auth.request_session_ok(request),
        "configured": dashboard_auth.enabled(),
    }


@app.on_event("startup")
async def connect_database():
    """Opens the Postgres pool early; a failure is only logged and retried on first use."""
    if not database.is_configured():
        logger.info("DATABASE_URL not set, running without Postgres")
        return
    try:
        await database.get_pool()
    except Exception as e:
        logger.warning(f"Postgres not reachable at startup, will retry on first use: {type(e).__name__}: {e}")


@app.on_event("shutdown")
async def disconnect_database():
    await database.close_pool()


@app.get("/db/health")
async def db_health():
    """Test endpoint: confirms bolna-app can read from and write to Postgres."""
    if not database.is_configured():
        raise HTTPException(status_code=503, detail="DATABASE_URL is not set")
    try:
        return await database.health()
    except Exception as e:
        logger.error(f"Postgres health check failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=503, detail=f"Database unreachable: {type(e).__name__}: {e}")


class CreateAgentPayload(BaseModel):
    agent_config: AgentModel
    # {task: {"system_prompt": str, "multilingual_prompts": {lang: str}}}; TaskManager reads both.
    agent_prompts: Optional[Dict[str, Dict[str, Union[str, Dict[str, str]]]]]


class AiEditPayload(BaseModel):
    prompt: str = Field(..., max_length=100_000)
    instruction: str = Field(..., min_length=1, max_length=4_000)


AI_EDIT_SYSTEM_PROMPT = """You edit the system prompt of a phone voice agent.
Apply the user's instruction to the prompt and change nothing else.
Keep the prompt's language, structure and formatting (headings, lists).
Keep every variable placeholder exactly as written, e.g. {name} or {{name}}.
Reply with the complete revised prompt only: no preamble, no explanation, no code fences."""


class GraphAiEditPayload(BaseModel):
    instruction: str = Field(..., min_length=1, max_length=4_000)
    # The graph part of llm_config: agent_information, routing_instructions, current_node_id, nodes.
    graph: Dict


GRAPH_AI_EDIT_SYSTEM_PROMPT = """You edit the conversation graph of a phone voice agent.
The graph is JSON: {"agent_information", "routing_instructions", "current_node_id", "nodes"}.
Each node: {"id", "node_type" ("llm" speaks with its prompt, "static" says static_message, "router" only routes),
"prompt", "static_message", "edges": [{"to_node_id", "condition", "label"}]}.
"current_node_id" is the start node. Every edge's to_node_id must be the id of a node in "nodes".
A node with no edges ends the conversation.

Apply the user's instruction and change nothing else: keep every other node, edge, prompt and field exactly
as given, including fields you don't recognise. Keep the language of the texts and keep variable placeholders
such as {name} or {{name}} exactly as written. New node ids use letters, digits and underscores.

Reply with the complete edited graph as one JSON object with the same four keys, and nothing else."""

GRAPH_KEYS = ("agent_information", "routing_instructions", "current_node_id", "nodes")


def merge_graph_edit(original, edited):
    """The model's graph, with every field it left out taken back from the original node or edge
    (per-node models, edge types, priorities...). Positions are never sent, so they always come back."""
    old_nodes = {n.get("id"): n for n in original.get("nodes") or [] if isinstance(n, dict)}
    nodes = []
    for node in edited.get("nodes") or []:
        if not isinstance(node, dict):
            raise ValueError("a node is not an object")
        old = old_nodes.get(node.get("id"), {})
        old_edges = {e.get("to_node_id"): e for e in old.get("edges") or [] if isinstance(e, dict)}
        merged = {**old, **node}
        merged["edges"] = [{**old_edges.get(e.get("to_node_id"), {}), **e} for e in node.get("edges") or [] if isinstance(e, dict)]
        nodes.append(merged)
    graph = {key: edited.get(key, original.get(key)) for key in GRAPH_KEYS}
    graph["nodes"] = nodes
    return graph


def check_graph(graph):
    """Raises ValueError with a readable reason when the engine could not run this graph."""
    if not graph["nodes"]:
        raise ValueError("the graph has no nodes")
    config = GraphAgentConfig(
        agent_information=graph.get("agent_information") or "",
        routing_instructions=graph.get("routing_instructions"),
        current_node_id=graph.get("current_node_id") or "",
        nodes=graph["nodes"],
    )
    ids = [n.id for n in config.nodes]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise ValueError(f"duplicate node ids: {', '.join(duplicates)}")
    if config.current_node_id not in ids:
        raise ValueError(f"start node '{config.current_node_id}' is not in the graph")
    for node in config.nodes:
        for edge in node.edges:
            if edge.to_node_id not in ids:
                raise ValueError(f"node '{node.id}' links to missing node '{edge.to_node_id}'")


@app.post("/agent/graph-ai-edit")
async def ai_edit_graph(payload: GraphAiEditPayload):
    """Edits a graph agent's nodes and edges following an instruction. Returns the new graph; nothing is saved."""
    model = os.getenv("AI_EDIT_MODEL", "gpt-4.1-mini")
    original = payload.graph
    if not isinstance(original.get("nodes"), list):
        raise HTTPException(status_code=422, detail="graph.nodes must be a list")
    sent = {key: original.get(key) for key in GRAPH_KEYS}
    sent["nodes"] = [{k: v for k, v in n.items() if k != "position"} for n in original["nodes"] if isinstance(n, dict)]
    try:
        llm = LiteLLM(model=model, max_tokens=16_000, temperature=0.1)
        text = await llm.generate(
            messages=[
                {"role": "system", "content": GRAPH_AI_EDIT_SYSTEM_PROMPT},
                {"role": "user", "content": f"Instruction:\n{payload.instruction}\n\nGraph:\n{json.dumps(sent, ensure_ascii=False)}"},
            ],
            request_json=True,
        )
    except Exception as e:
        logger.error(f"Graph AI edit failed with {model}: {type(e).__name__}: {e}")
        reason = {
            "AuthenticationError": "the API key was rejected",
            "RateLimitError": "rate limit or no credit left on the provider account",
            "NotFoundError": f"model {model} was not found",
        }.get(type(e).__name__, type(e).__name__)
        raise HTTPException(status_code=502, detail=f"AI Edit could not reach {model}: {reason}")

    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`").split("\n", 1)[-1].strip()
    try:
        edited = json.loads(text)
        if not isinstance(edited, dict):
            raise ValueError("the reply is not a JSON object")
        graph = merge_graph_edit(original, edited)
        check_graph(graph)
    except (ValueError, ValidationError) as e:
        # json.JSONDecodeError is a ValueError. Pydantic's message names the bad field.
        logger.error(f"Graph AI edit returned an unusable graph: {e}")
        raise HTTPException(status_code=502, detail=f"AI Edit returned a graph the engine can't run: {str(e)[:300]}")
    return {"graph": graph, "model": model}


#############################################################################################
# Agent records
#############################################################################################
# An agent is its config in Redis (key = agent id) plus its prompts in
# agent_data/{id}/conversation_details.json. created_at / updated_at are stored inside the
# Redis config; the engine reads config keys by name, so the extra keys are ignored at call time.


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def is_agent_id(agent_id):
    """Agent ids are UUIDs; anything else (audio cache keys, paths) is not an agent."""
    try:
        return str(uuid.UUID(agent_id)) == agent_id.lower()
    except (ValueError, AttributeError):
        return False


def prompts_path(agent_id):
    return os.path.join(PREPROCESS_DIR, agent_id, "conversation_details.json")


def with_timestamps(agent_id, agent_config):
    """Fills created_at / updated_at for agents saved before they were stored, from the prompts file's mtime."""
    if not agent_config.get("created_at"):
        try:
            mtime = os.path.getmtime(prompts_path(agent_id))
            agent_config["created_at"] = datetime.fromtimestamp(mtime, timezone.utc).isoformat()
        except OSError:
            agent_config["created_at"] = None
    if not agent_config.get("updated_at"):
        agent_config["updated_at"] = agent_config["created_at"]
    return agent_config


def read_prompts(agent_id):
    try:
        with open(prompts_path(agent_id)) as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


async def load_agent_config(agent_id):
    """The stored config, or a 404 when the id is not an agent."""
    if not is_agent_id(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    agent_data = await redis_client.get(agent_id)
    if not agent_data:
        raise HTTPException(status_code=404, detail="Agent not found")
    return json.loads(agent_data)


@app.post("/agent/ai-edit")
async def ai_edit_prompt(payload: AiEditPayload):
    """Rewrites an agent prompt following an instruction. Returns the new prompt; nothing is saved."""
    model = os.getenv("AI_EDIT_MODEL", "gpt-4.1-mini")
    try:
        llm = LiteLLM(model=model, max_tokens=4000, temperature=0.2)
        text = await llm.generate(
            messages=[
                {"role": "system", "content": AI_EDIT_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Instruction:\n{payload.instruction}\n\nPrompt:\n{payload.prompt or '(empty)'}",
                },
            ]
        )
    except Exception as e:
        # LiteLLM raises typed errors (AuthenticationError, RateLimitError, ...); their names say enough.
        logger.error(f"AI edit failed with {model}: {type(e).__name__}: {e}")
        reason = {
            "AuthenticationError": "the API key was rejected",
            "RateLimitError": "rate limit or no credit left on the provider account",
            "NotFoundError": f"model {model} was not found",
        }.get(type(e).__name__, type(e).__name__)
        raise HTTPException(status_code=502, detail=f"AI Edit could not reach {model}: {reason}")

    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`").split("\n", 1)[-1].strip()
    if not text:
        raise HTTPException(status_code=502, detail=f"AI Edit got an empty reply from {model}")
    return {"prompt": text, "model": model}


@app.get("/agent/{agent_id}")
async def get_agent(agent_id: str):
    """Fetches an agent's config and prompts by ID."""
    try:
        agent_config = await load_agent_config(agent_id)
        return {
            "agent_id": agent_id,
            "agent_config": with_timestamps(agent_id, agent_config),
            "agent_prompts": read_prompts(agent_id),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching agent {agent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


async def prepare_extraction_tasks(data):
    """Makes sure every extraction task has the schema the engine fills, at the place it reads it
    (tools_config.llm_agent.llm_config.extraction_json, see TaskManager.load_prompt).

    The dashboard sends the schema itself ({field: instruction}, built from its categories), so
    this is a no-op for it. Payloads with only extraction_details (free text) get the schema
    generated by an LLM (EXTRACTION_PROMPT_GENERATION_MODEL, default gpt-4.1-mini)."""
    for task in data.get("tasks") or []:
        if task.get("task_type") != "extraction":
            continue
        llm_agent = (task.get("tools_config") or {}).get("llm_agent") or {}
        # Standard shape: {agent_type, agent_flow_type, llm_config: {...}}; older payloads were flat.
        llm_config = llm_agent.get("llm_config") if isinstance(llm_agent.get("llm_config"), dict) else llm_agent
        if llm_config.get("extraction_json"):
            continue
        details = (llm_config.get("extraction_details") or "").strip()
        if not details:
            raise HTTPException(status_code=422, detail="Extraction task has no categories")
        model = os.getenv("EXTRACTION_PROMPT_GENERATION_MODEL") or "gpt-4.1-mini"
        try:
            generated = await LiteLLM(model=model, max_tokens=2000).generate(
                messages=[
                    {"role": "system", "content": EXTRACTION_PROMPT_GENERATION_PROMPT},
                    {"role": "user", "content": details},
                ]
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not build the extraction schema with {model}: {e}")
        # Models often wrap JSON in ``` fences; the schema must be a plain {field: instruction} object.
        text = (generated or "").strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else ""
            text = text.rsplit("```", 1)[0]
        try:
            schema = json.loads(text)
        except ValueError:
            schema = None
        if not isinstance(schema, dict) or not schema:
            raise HTTPException(status_code=502, detail=f"{model} did not return a JSON object for the extraction schema")
        llm_config["extraction_json"] = json.dumps(schema, indent=2, ensure_ascii=False)


@app.post("/agent")
async def create_agent(agent_data: CreateAgentPayload):
    agent_uuid = str(uuid.uuid4())
    data_for_db = agent_data.agent_config.model_dump()
    data_for_db["assistant_status"] = "seeding"
    data_for_db["created_at"] = data_for_db["updated_at"] = now_iso()
    agent_prompts = agent_data.agent_prompts
    logger.info(f"Data for DB {data_for_db}")

    await prepare_extraction_tasks(data_for_db)

    stored_prompt_file_path = f"{agent_uuid}/conversation_details.json"
    await asyncio.gather(
        redis_client.set(agent_uuid, json.dumps(data_for_db)),
        store_file(file_key=stored_prompt_file_path, file_data=agent_prompts, local=True),
    )
    prerender_welcome_audio(data_for_db)
    prerender_static_audio(data_for_db)

    return {"agent_id": agent_uuid, "state": "created"}


@app.put("/agent/{agent_id}")
async def edit_agent(agent_id: str, agent_data: CreateAgentPayload = Body(...)):
    """Edits an existing agent based on the provided agent_id."""
    try:
        existing_data = with_timestamps(agent_id, await load_agent_config(agent_id))

        new_data = agent_data.agent_config.model_dump()
        new_data["assistant_status"] = "updated"
        new_data["created_at"] = existing_data["created_at"] or now_iso()
        new_data["updated_at"] = now_iso()
        agent_prompts = agent_data.agent_prompts

        logger.info(f"Updating Agent {agent_id}: {new_data}")

        await prepare_extraction_tasks(new_data)

        stored_prompt_file_path = f"{agent_id}/conversation_details.json"
        await asyncio.gather(
            redis_client.set(agent_id, json.dumps(new_data)),
            store_file(file_key=stored_prompt_file_path, file_data=agent_prompts, local=True),
        )
        prerender_welcome_audio(new_data)
        prerender_static_audio(new_data)

        return {"agent_id": agent_id, "state": "updated"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent {agent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/agent/{agent_id}")
async def delete_agent(agent_id: str):
    """Deletes an agent by ID."""
    try:
        await load_agent_config(agent_id)
        await redis_client.delete(agent_id)
        # agent_id is a validated UUID, so this path stays inside agent_data/.
        shutil.rmtree(os.path.join(PREPROCESS_DIR, agent_id), ignore_errors=True)
        return {"agent_id": agent_id, "state": "deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting agent {agent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/all")
async def get_all_agents():
    """Fetches all agents stored in Redis."""
    try:
        agent_keys = [k for k in await redis_client.keys("*") if is_agent_id(k)]

        if not agent_keys:
            return {"agents": []}
        agents_data = []
        for key in agent_keys:
            try:
                data = await redis_client.get(key)
                agents_data.append(data)
            except Exception as e:
                logger.error(f"An error occurred with key {key}: {e}")

        agents = [
            {"agent_id": key, "data": with_timestamps(key, json.loads(data))}
            for key, data in zip(agent_keys, agents_data)
            if data
        ]

        return {"agents": agents}

    except Exception as e:
        logger.error(f"Error fetching all agents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


CARTESIA_TTS_URL = "https://api.cartesia.ai/tts/bytes"
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"


def agent_synthesizer(agent_config):
    tasks = agent_config.get("tasks") or []
    return (tasks[0].get("tools_config", {}).get("synthesizer") or {}) if tasks else {}


def synthesizer_config(agent_config, language):
    """The synthesizer that speaks `language`: synthesizer.multilingual[language] if present, else the
    top-level synthesizer, mirroring TaskManager's SynthesizerPool."""
    synthesizer = agent_synthesizer(agent_config)
    return (synthesizer.get("multilingual") or {}).get(language) or synthesizer


def tts_request(synthesizer, transcript, label):
    """(provider, payload) for rendering `transcript` in the synthesizer's voice as PCM16 mono 8kHz,
    or None if the provider is not supported."""
    provider = synthesizer.get("provider")
    provider_config = synthesizer.get("provider_config") or {}
    if provider == "cartesia":
        return provider, {
            "model_id": provider_config.get("model") or "sonic-3",
            "transcript": transcript,
            "voice": {"mode": "id", "id": provider_config.get("voice_id")},
            "language": provider_config.get("language") or "en",
            "output_format": {"container": "raw", "encoding": "pcm_s16le", "sample_rate": 8000},
        }
    if provider == "sarvam":
        # target_language_code is the configured language as is, as SarvamSynthesizer sends it.
        return provider, {
            "text": transcript,
            "target_language_code": provider_config.get("language"),
            "speaker": provider_config.get("voice_id"),
            "model": provider_config.get("model"),
            "speech_sample_rate": 8000,
        }
    logger.warning(f"{label}: synthesizer provider {provider!r} is not supported, skipping")
    return None


def welcome_audio_request(agent_config, context_data=None):
    """(provider, payload) for the agent's welcome message in the active language, or None if there is nothing to render.
    {variables} are filled from the call's context first, as AssistantManager does for the text."""
    welcome_text = agent_welcome_text(agent_config)
    if has_variables(welcome_text):
        welcome_text = update_prompt_with_context(welcome_text, context_data)
    if not welcome_text or not agent_config.get("tasks"):
        logger.warning("Welcome audio: no welcome message or tasks in agent config, skipping")
        return None
    active = agent_synthesizer(agent_config).get("active") or DEFAULT_LANGUAGE_CODE
    return tts_request(synthesizer_config(agent_config, active), welcome_text, "Welcome audio")


async def get_cached_audio(prefix, request, label):
    """Returns base64 audio for a TTS request from the Redis cache, rendering and caching it on a miss.

    The cache key covers text, voice, model, language and format, so editing any of
    them renders new audio."""
    provider, payload = request
    cache_key = prefix + hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            logger.info(f"{label}: served from cache ({len(cached) * 3 // 4} bytes)")
            return cached
    except Exception as e:
        logger.error(f"{label}: cache read failed: {e}")

    audio = await synthesize_audio(provider, payload, label)
    if audio:
        try:
            await redis_client.set(cache_key, audio, ex=WELCOME_AUDIO_TTL_S)
        except Exception as e:
            logger.error(f"{label}: cache write failed: {e}")
    return audio


async def get_welcome_audio(agent_config, context_data=None):
    """Returns the welcome audio from the Redis cache, rendering and caching it on a miss."""
    request = welcome_audio_request(agent_config, context_data)
    if request is None:
        return None
    return await get_cached_audio(WELCOME_AUDIO_PREFIX, request, "Welcome audio")


def static_message_texts(agent_config):
    """(text, language) for every variant of every graph node's static_message, without duplicate texts.
    A plain-string message has no language and is spoken by the top-level synthesizer."""
    texts = []
    for task in agent_config.get("tasks") or []:
        llm_config = (task.get("tools_config", {}).get("llm_agent") or {}).get("llm_config") or {}
        for node in llm_config.get("nodes") or []:
            message = node.get("static_message")
            variants = message.items() if isinstance(message, dict) else [(None, message)]
            for language, text in variants:
                if text and text.strip() and text not in (t for t, _ in texts):
                    texts.append((text, language))
    return texts


async def get_static_audio(agent_config):
    """Returns {text: base64 audio} for the agent's static node messages, rendering any cache misses."""
    requests = [
        (text, tts_request(synthesizer_config(agent_config, language), text, "Static audio"))
        for text, language in static_message_texts(agent_config)
    ]
    requests = [(text, request) for text, request in requests if request is not None]
    audios = await asyncio.gather(
        *(get_cached_audio(STATIC_AUDIO_PREFIX, request, "Static audio") for _, request in requests)
    )
    return {text: audio for (text, _), audio in zip(requests, audios) if audio}


def sarvam_pcm(body):
    """Raw PCM16 mono 8kHz from Sarvam's {"audios": [base64 WAV]} response."""
    audios = json.loads(body).get("audios") or []
    if not audios:
        raise ValueError("Sarvam returned no audio")
    with wave.open(io.BytesIO(base64.b64decode(audios[0]))) as wav:
        params = (wav.getnchannels(), wav.getsampwidth(), wav.getframerate())
        if params != (1, 2, 8000):
            raise ValueError(f"Sarvam returned (channels, sample width, rate) {params}, expected (1, 2, 8000)")
        return wav.readframes(wav.getnframes())


async def synthesize_audio(provider, payload, label):
    """Renders a TTS request as base64 PCM16 mono 8kHz audio, or returns None."""
    if provider == "sarvam":
        url, headers = SARVAM_TTS_URL, {"api-subscription-key": os.getenv("SARVAM_API_KEY")}
    else:
        url, headers = CARTESIA_TTS_URL, {"X-API-Key": os.getenv("CARTESIA_API_KEY"), "Cartesia-Version": "2024-06-10"}
    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, headers=headers, json=payload) as response:
                if response.status != 200:
                    body = await response.text()
                    logger.error(f"{label}: {provider} returned {response.status}: {body}")
                    return None
                body = await response.read()
        audio = sarvam_pcm(body) if provider == "sarvam" else body
        logger.info(f"{label}: synthesized {len(audio)} bytes")
        return base64.b64encode(audio).decode("utf-8")
    except Exception as e:
        logger.error(f"{label}: synthesis failed: {e}", exc_info=True)
        return None


#############################################################################################
# Websocket
#############################################################################################
@app.websocket("/chat/v1/{agent_id}")
async def websocket_endpoint(
    agent_id: str, websocket: WebSocket, user_agent: str = Query(None), ref: Optional[str] = Query(None)
):
    logger.info(f"Connected to ws (ref={ref})")
    await websocket.accept()
    active_websockets.append(websocket)
    agent_config, context_data = None, None
    try:
        retrieved_agent_config = await redis_client.get(agent_id)
        logger.info(f"Retrieved agent config: {retrieved_agent_config}")
        agent_config = json.loads(retrieved_agent_config)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=404, detail="Agent not found")

    # "Initiated At" in Call History: when a tracked call was placed, else when the stream connected.
    started_at = datetime.now(timezone.utc)
    # A tracked call (placed from the dashboard): its variable values become the call's context.
    tracked = await load_tracked_call(ref)
    if tracked and tracked.get("created_at"):
        try:
            started_at = datetime.fromisoformat(tracked["created_at"])
        except ValueError:
            pass
    if tracked:
        context_data = {"recipient_data": tracked.get("user_data") or {}}
        await update_tracked_call(ref, state="live", started_at=now_iso())

    welcome_audio, static_audio = await asyncio.gather(
        get_welcome_audio(agent_config, context_data), get_static_audio(agent_config)
    )
    assistant_manager = AssistantManager(
        agent_config,
        websocket,
        agent_id,
        context_data=context_data,
        welcome_message_audio=welcome_audio,
        static_message_audio=static_audio,
    )

    # Each task's output: the conversation first, then the follow-up tasks (summary, extraction).
    outputs = {}
    try:
        async for index, task_output in assistant_manager.run(local=True):
            logger.info(task_output)
            if index == 0:
                outputs["conversation"] = task_output
                if tracked:
                    await update_tracked_call(
                        ref, state="processing", call_sid=task_output.get("call_sid"), run_id=task_output.get("run_id")
                    )
                # Links the call's transcript and latencies (run_id) to its recording (Plivo CallUUID).
                logger.info(f"call_summary run_id={task_output.get('run_id')} call_sid={task_output.get('call_sid')}")
            elif task_output.get("task_type"):
                outputs[task_output["task_type"]] = task_output
    except WebSocketDisconnect:
        active_websockets.remove(websocket)
    except Exception as e:
        traceback.print_exc()
        logger.error(f"error in executing {e}")
    finally:
        # Stored (and sent to the webhook) even if a follow-up task failed: whatever finished is kept.
        if "conversation" in outputs:
            await call_results.finish_call(
                agent_id, agent_config, outputs, ref=ref if tracked else None, tracked=tracked, started_at=started_at
            )
        if tracked:
            ended = "completed" if "conversation" in outputs else "failed"
            await update_tracked_call(ref, state=ended, ended_at=now_iso())


#############################################################################################
# Tracked calls: test calls placed from the dashboard (plivo-app registers them here)
#############################################################################################
TRACKED_CALL_PREFIX = "tracked_call:"
TRACKED_CALL_TTL_S = 24 * 3600
REF_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")
# Plivo CallStatus values for calls that never reached the agent.
UNANSWERED_STATES = {"busy", "no-answer", "timeout", "failed", "canceled", "cancel"}


async def load_tracked_call(ref):
    if not ref or not REF_RE.match(ref):
        return None
    try:
        raw = await redis_client.get(TRACKED_CALL_PREFIX + ref)
        return json.loads(raw) if raw else None
    except Exception as e:
        logger.error(f"Tracked call {ref}: could not load: {e}")
        return None


async def update_tracked_call(ref, **fields):
    """Merges fields into the tracked call. Never raises: tracking must not affect the call."""
    try:
        current = await load_tracked_call(ref) or {}
        current.update({k: v for k, v in fields.items() if v is not None})
        await redis_client.set(TRACKED_CALL_PREFIX + ref, json.dumps(current), ex=TRACKED_CALL_TTL_S)
    except Exception as e:
        logger.error(f"Tracked call {ref}: could not update: {e}")


class TrackedCallPayload(BaseModel):
    agent_id: str
    phone: Optional[str] = None
    user_data: Optional[Dict[str, Union[str, int, float, bool]]] = None


@app.put("/calls/{ref}")
async def register_tracked_call(ref: str, payload: TrackedCallPayload):
    """Registers a call before it is placed, with the variable values for its prompt."""
    if not REF_RE.match(ref):
        raise HTTPException(status_code=422, detail="Invalid call reference")
    user_data = {k: str(v) for k, v in (payload.user_data or {}).items() if k}
    data = {
        "ref": ref,
        "agent_id": payload.agent_id,
        "phone": payload.phone,
        "user_data": user_data,
        "state": "ringing",
        "created_at": now_iso(),
    }
    await redis_client.set(TRACKED_CALL_PREFIX + ref, json.dumps(data), ex=TRACKED_CALL_TTL_S)
    return data


@app.post("/calls/{ref}/hangup")
async def tracked_call_hangup(ref: str, payload: Dict = Body(...)):
    """Plivo's hangup, forwarded by plivo-app. Only changes the state of a call that never reached
    the agent; a call that did is finished by the websocket handler."""
    tracked = await load_tracked_call(ref)
    if not tracked:
        raise HTTPException(status_code=404, detail="Unknown call")
    status = str(payload.get("status") or "").lower()
    fields = {"hangup_cause": payload.get("cause"), "call_uuid": payload.get("call_uuid")}
    if tracked.get("state") == "ringing":
        fields["state"] = status if status in UNANSWERED_STATES else "failed"
        fields["ended_at"] = now_iso()
        if status not in UNANSWERED_STATES:
            fields["error"] = "The call ended before the agent connected"
        # The call never reached the agent, so the websocket handler stores nothing: record it here.
        await call_results.record_unanswered(
            tracked, status if status in UNANSWERED_STATES else "failed", payload.get("cause"), payload.get("call_uuid")
        )
    await update_tracked_call(ref, **fields)
    return {"ok": True}


@app.get("/calls/{ref}")
async def get_tracked_call(ref: str):
    """State of a tracked call, with its stored result once it is completed."""
    tracked = await load_tracked_call(ref)
    if not tracked:
        raise HTTPException(status_code=404, detail="Unknown call")
    result = None
    if tracked.get("state") == "completed":
        result = await call_results.result_by_ref(ref)
    return {**tracked, "result": result}


#############################################################################################
# Call History (dashboard only: nginx forwards just /chat/ to bolna-app, so none of this is public)
#############################################################################################
def _history_filters(agent_id, status, call_type, provider, voicemail, date_from, date_to, q):
    def when(value, name):
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"{name} must be an ISO date or time")
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

    return {
        "agent_id": agent_id,
        "status": status,
        "call_type": call_type,
        "provider": provider,
        "voicemail": voicemail,
        "from": when(date_from, "from"),
        "to": when(date_to, "to"),
        "q": q,
    }


def _require_database():
    if not database.is_configured():
        raise HTTPException(status_code=503, detail="Call History needs Postgres (DATABASE_URL is not set)")


@app.get("/call-history")
async def call_history(
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    call_type: Optional[str] = None,
    provider: Optional[str] = None,
    voicemail: Optional[str] = None,
    date_from: Optional[str] = Query(None, alias="from"),
    date_to: Optional[str] = Query(None, alias="to"),
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    sort: str = "started_at",
    direction: str = "desc",
):
    _require_database()
    filters = _history_filters(agent_id, status, call_type, provider, voicemail, date_from, date_to, q)
    return await call_results.list_calls(filters, page, page_size, sort, direction)


@app.get("/call-history/stats")
async def call_history_stats(
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    call_type: Optional[str] = None,
    provider: Optional[str] = None,
    voicemail: Optional[str] = None,
    date_from: Optional[str] = Query(None, alias="from"),
    date_to: Optional[str] = Query(None, alias="to"),
    q: Optional[str] = None,
):
    _require_database()
    filters = _history_filters(agent_id, status, call_type, provider, voicemail, date_from, date_to, q)
    return await call_results.call_stats(filters)


@app.get("/call-history/timeseries")
async def call_history_timeseries(days: int = Query(14, ge=1, le=90), agent_id: Optional[str] = None):
    _require_database()
    return await call_results.calls_per_day(days, agent_id)


async def _agent_names():
    names = {}
    for key in await redis_client.keys("*"):
        if not is_agent_id(key):
            continue
        try:
            names[key] = json.loads(await redis_client.get(key)).get("agent_name", "")
        except Exception:
            continue
    return names


@app.get("/call-history/export.csv")
async def call_history_export(
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    call_type: Optional[str] = None,
    provider: Optional[str] = None,
    voicemail: Optional[str] = None,
    date_from: Optional[str] = Query(None, alias="from"),
    date_to: Optional[str] = Query(None, alias="to"),
    q: Optional[str] = None,
):
    _require_database()
    filters = _history_filters(agent_id, status, call_type, provider, voicemail, date_from, date_to, q)
    body = await call_results.export_csv(filters, await _agent_names())
    filename = f"call-history-{datetime.now(timezone.utc):%Y%m%d-%H%M}.csv"
    return Response(content=body, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.get("/call-history/{run_id}")
async def call_history_detail(run_id: str):
    _require_database()
    call = await call_results.get_call(run_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


class RatingPayload(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)


@app.put("/call-history/{run_id}/rating")
async def call_history_rating(run_id: str, payload: RatingPayload):
    _require_database()
    saved = await call_results.set_rating(run_id, payload.rating)
    if not saved:
        raise HTTPException(status_code=404, detail="Call not found")
    return saved


# Recordings stay in Plivo's storage; they are fetched with our Plivo credentials and kept briefly in
# memory so the player can seek (Range requests) without downloading the file again.
RECORDING_CACHE_SIZE = 8
_recording_cache = {}


def _plivo_recording_url(call_uuid):
    import plivo

    client = plivo.RestClient(os.getenv("PLIVO_AUTH_ID"), os.getenv("PLIVO_AUTH_TOKEN"))
    recordings = list(client.recordings.list(call_uuid=call_uuid, limit=1))
    return recordings[0].recording_url if recordings else None


async def _recording_bytes(call_uuid):
    if call_uuid in _recording_cache:
        return _recording_cache[call_uuid]
    url = await asyncio.to_thread(_plivo_recording_url, call_uuid)
    if not url:
        return None
    host = (urlparse(url).hostname or "")
    if urlparse(url).scheme != "https" or not (host == "plivo.com" or host.endswith(".plivo.com")):
        # The request carries our Plivo credentials, so it must only ever go to Plivo.
        logger.error(f"Recording for {call_uuid}: refusing non-Plivo URL {url}")
        return None
    auth = aiohttp.BasicAuth(os.getenv("PLIVO_AUTH_ID"), os.getenv("PLIVO_AUTH_TOKEN"))
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=60)) as session:
        async with session.get(url, auth=auth) as response:
            if response.status != 200:
                logger.error(f"Recording for {call_uuid}: Plivo returned {response.status}")
                return None
            audio = await response.read()
    if len(_recording_cache) >= RECORDING_CACHE_SIZE:
        _recording_cache.pop(next(iter(_recording_cache)))
    _recording_cache[call_uuid] = audio
    return audio


@app.get("/call-history/{run_id}/recording")
async def call_history_recording(run_id: str, range_header: Optional[str] = Header(None, alias="range")):
    _require_database()
    call = await call_results.get_call(run_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if not call.get("call_sid") or call.get("status") != "completed":
        raise HTTPException(status_code=404, detail="No recording for this call")
    try:
        audio = await _recording_bytes(call["call_sid"])
    except Exception as e:
        logger.error(f"Recording for {run_id}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail="Could not fetch the recording from Plivo")
    if not audio:
        raise HTTPException(status_code=404, detail="No recording for this call")

    size = len(audio)
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600"}
    match = re.match(r"bytes=(\d*)-(\d*)$", range_header or "")
    if match and (match.group(1) or match.group(2)):
        if match.group(1):
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else size - 1
        else:  # "bytes=-N": the last N bytes
            start, end = max(0, size - int(match.group(2))), size - 1
        if start >= size:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        end = min(end, size - 1)
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        return Response(content=audio[start : end + 1], status_code=206, media_type="audio/mpeg", headers=headers)
    return Response(content=audio, media_type="audio/mpeg", headers=headers)
