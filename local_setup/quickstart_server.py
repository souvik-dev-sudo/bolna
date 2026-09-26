import os
import asyncio
import base64
import hashlib
import uuid
import traceback
import aiohttp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis
from dotenv import load_dotenv
from bolna.helpers.utils import store_file
from bolna.prompts import *
from bolna.helpers.logger_config import configure_logger
from bolna.models import *
from bolna.llms import LiteLLM
from bolna.agent_manager.assistant_manager import AssistantManager

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
    """Renders the greeting in the background so the first call does not wait for it."""
    run_in_background(get_welcome_audio(agent_config))


def prerender_static_audio(agent_config):
    """Renders every static node message in the background so calls play them without live TTS."""
    run_in_background(get_static_audio(agent_config))


app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)


class CreateAgentPayload(BaseModel):
    agent_config: AgentModel
    agent_prompts: Optional[Dict[str, Dict[str, str]]]


@app.get("/agent/{agent_id}")
async def get_agent(agent_id: str):
    """Fetches an agent's information by ID."""
    try:
        agent_data = await redis_client.get(agent_id)
        if not agent_data:
            raise HTTPException(status_code=404, detail="Agent not found")

        return json.loads(agent_data)

    except Exception as e:
        logger.error(f"Error fetching agent {agent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/agent")
async def create_agent(agent_data: CreateAgentPayload):
    agent_uuid = str(uuid.uuid4())
    data_for_db = agent_data.agent_config.model_dump()
    data_for_db["assistant_status"] = "seeding"
    agent_prompts = agent_data.agent_prompts
    logger.info(f"Data for DB {data_for_db}")

    if len(data_for_db["tasks"]) > 0:
        logger.info("Setting up follow up tasks")
        for index, task in enumerate(data_for_db["tasks"]):
            if task["task_type"] == "extraction":
                extraction_prompt_llm = os.getenv("EXTRACTION_PROMPT_GENERATION_MODEL")
                extraction_prompt_generation_llm = LiteLLM(model=extraction_prompt_llm, max_tokens=2000)
                extraction_prompt = await extraction_prompt_generation_llm.generate(
                    messages=[
                        {"role": "system", "content": EXTRACTION_PROMPT_GENERATION_PROMPT},
                        {
                            "role": "user",
                            "content": data_for_db["tasks"][index]["tools_config"]["llm_agent"]["extraction_details"],
                        },
                    ]
                )
                data_for_db["tasks"][index]["tools_config"]["llm_agent"]["extraction_json"] = extraction_prompt

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
        existing_data = await redis_client.get(agent_id)
        if not existing_data:
            raise HTTPException(status_code=404, detail="Agent not found")

        existing_data = json.loads(existing_data)

        new_data = agent_data.agent_config.model_dump()
        new_data["assistant_status"] = "updated"
        agent_prompts = agent_data.agent_prompts

        logger.info(f"Updating Agent {agent_id}: {new_data}")

        for index, task in enumerate(new_data.get("tasks", [])):
            if task.get("task_type") == "extraction":
                extraction_prompt_llm = os.getenv("EXTRACTION_PROMPT_GENERATION_MODEL")
                if not extraction_prompt_llm:
                    raise HTTPException(status_code=500, detail="Extraction model not configured")

                extraction_prompt_generation_llm = LiteLLM(model=extraction_prompt_llm, max_tokens=2000)
                extraction_details = task["tools_config"]["llm_agent"].get("extraction_details", "")

                extraction_prompt = await extraction_prompt_generation_llm.generate(
                    messages=[
                        {"role": "system", "content": EXTRACTION_PROMPT_GENERATION_PROMPT},
                        {"role": "user", "content": extraction_details},
                    ]
                )

                new_data["tasks"][index]["tools_config"]["llm_agent"]["extraction_json"] = extraction_prompt

        stored_prompt_file_path = f"{agent_id}/conversation_details.json"
        await asyncio.gather(
            redis_client.set(agent_id, json.dumps(new_data)),
            store_file(file_key=stored_prompt_file_path, file_data=agent_prompts, local=True),
        )
        prerender_welcome_audio(new_data)
        prerender_static_audio(new_data)

        return {"agent_id": agent_id, "state": "updated"}

    except Exception as e:
        logger.error(f"Error updating agent {agent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/agent/{agent_id}")
async def delete_agent(agent_id: str):
    """Deletes an agent by ID."""
    try:
        agent_exists = await redis_client.exists(agent_id)
        if not agent_exists:
            raise HTTPException(status_code=404, detail="Agent not found")

        await redis_client.delete(agent_id)
        return {"agent_id": agent_id, "state": "deleted"}

    except Exception as e:
        logger.error(f"Error deleting agent {agent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/all")
async def get_all_agents():
    """Fetches all agents stored in Redis."""
    try:
        agent_keys = [k for k in await redis_client.keys("*") if not k.startswith(AUDIO_CACHE_PREFIXES)]

        if not agent_keys:
            return {"agents": []}
        agents_data = []
        for key in agent_keys:
            try:
                data = await redis_client.get(key)
                agents_data.append(data)
            except Exception as e:
                logger.error(f"An error occurred with key {key}: {e}")

        agents = [{"agent_id": key, "data": json.loads(data)} for key, data in zip(agent_keys, agents_data) if data]

        return {"agents": agents}

    except Exception as e:
        logger.error(f"Error fetching all agents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


def cartesia_request(agent_config, transcript, label):
    """Builds the Cartesia request for `transcript` in the agent's voice, or None if the agent does not use Cartesia."""
    tasks = agent_config.get("tasks") or []
    synthesizer = (tasks[0].get("tools_config", {}).get("synthesizer") or {}) if tasks else {}
    if synthesizer.get("provider") != "cartesia":
        logger.warning(f"{label}: synthesizer provider {synthesizer.get('provider')!r} is not 'cartesia', skipping")
        return None

    provider_config = synthesizer.get("provider_config") or {}
    return {
        "model_id": provider_config.get("model") or "sonic-3",
        "transcript": transcript,
        "voice": {"mode": "id", "id": provider_config.get("voice_id")},
        "language": provider_config.get("language") or "en",
        "output_format": {"container": "raw", "encoding": "pcm_s16le", "sample_rate": 8000},
    }


def welcome_audio_request(agent_config):
    """Builds the Cartesia request for the agent's welcome message, or returns None if there is nothing to render."""
    welcome_text = agent_config.get("agent_welcome_message")
    if not welcome_text or not agent_config.get("tasks"):
        logger.warning("Welcome audio: no welcome message or tasks in agent config, skipping")
        return None
    return cartesia_request(agent_config, welcome_text, "Welcome audio")


async def get_cached_audio(prefix, payload, label):
    """Returns base64 audio for a Cartesia request from the Redis cache, rendering and caching it on a miss.

    The cache key covers text, voice, model, language and format, so editing any of
    them renders new audio."""
    cache_key = prefix + hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            logger.info(f"{label}: served from cache ({len(cached) * 3 // 4} bytes)")
            return cached
    except Exception as e:
        logger.error(f"{label}: cache read failed: {e}")

    audio = await synthesize_audio(payload, label)
    if audio:
        try:
            await redis_client.set(cache_key, audio, ex=WELCOME_AUDIO_TTL_S)
        except Exception as e:
            logger.error(f"{label}: cache write failed: {e}")
    return audio


async def get_welcome_audio(agent_config):
    """Returns the welcome audio from the Redis cache, rendering and caching it on a miss."""
    payload = welcome_audio_request(agent_config)
    if payload is None:
        return None
    return await get_cached_audio(WELCOME_AUDIO_PREFIX, payload, "Welcome audio")


def static_message_texts(agent_config):
    """Every language variant of every graph node's static_message, without duplicates."""
    texts = []
    for task in agent_config.get("tasks") or []:
        llm_config = (task.get("tools_config", {}).get("llm_agent") or {}).get("llm_config") or {}
        for node in llm_config.get("nodes") or []:
            message = node.get("static_message")
            variants = message.values() if isinstance(message, dict) else [message]
            texts.extend(text for text in variants if text and text.strip() and text not in texts)
    return texts


async def get_static_audio(agent_config):
    """Returns {text: base64 audio} for the agent's static node messages, rendering any cache misses."""
    texts = static_message_texts(agent_config)
    payloads = [(text, cartesia_request(agent_config, text, "Static audio")) for text in texts]
    payloads = [(text, payload) for text, payload in payloads if payload is not None]
    audios = await asyncio.gather(
        *(get_cached_audio(STATIC_AUDIO_PREFIX, payload, "Static audio") for _, payload in payloads)
    )
    return {text: audio for (text, _), audio in zip(payloads, audios) if audio}


async def synthesize_audio(payload, label):
    """Renders a Cartesia request as base64 PCM16 mono 8kHz audio, or returns None."""
    headers = {"X-API-Key": os.getenv("CARTESIA_API_KEY"), "Cartesia-Version": "2024-06-10"}
    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post("https://api.cartesia.ai/tts/bytes", headers=headers, json=payload) as response:
                if response.status != 200:
                    body = await response.text()
                    logger.error(f"{label}: Cartesia returned {response.status}: {body}")
                    return None
                audio = await response.read()
        logger.info(f"{label}: synthesized {len(audio)} bytes")
        return base64.b64encode(audio).decode("utf-8")
    except Exception as e:
        logger.error(f"{label}: synthesis failed: {e}", exc_info=True)
        return None


#############################################################################################
# Websocket
#############################################################################################
@app.websocket("/chat/v1/{agent_id}")
async def websocket_endpoint(agent_id: str, websocket: WebSocket, user_agent: str = Query(None)):
    logger.info("Connected to ws")
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

    welcome_audio, static_audio = await asyncio.gather(get_welcome_audio(agent_config), get_static_audio(agent_config))
    assistant_manager = AssistantManager(
        agent_config,
        websocket,
        agent_id,
        welcome_message_audio=welcome_audio,
        static_message_audio=static_audio,
    )

    try:
        async for index, task_output in assistant_manager.run(local=True):
            logger.info(task_output)
    except WebSocketDisconnect:
        active_websockets.remove(websocket)
    except Exception as e:
        traceback.print_exc()
        logger.error(f"error in executing {e}")
