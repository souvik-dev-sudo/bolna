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

# Rendered welcome audio is cached in Redis under this prefix (not an agent key)
WELCOME_AUDIO_PREFIX = "welcome_audio:"
WELCOME_AUDIO_TTL_S = 30 * 24 * 3600
background_tasks = set()


def prerender_welcome_audio(agent_config):
    """Renders the greeting in the background so the first call does not wait for it."""
    task = asyncio.create_task(get_welcome_audio(agent_config))
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)

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
        agent_keys = [k for k in await redis_client.keys("*") if not k.startswith(WELCOME_AUDIO_PREFIX)]

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


def welcome_audio_request(agent_config):
    """Builds the Cartesia request for the agent's welcome message, or returns None if there is nothing to render."""
    welcome_text = agent_config.get("agent_welcome_message")
    tasks = agent_config.get("tasks") or []
    if not welcome_text or not tasks:
        logger.warning("Welcome audio: no welcome message or tasks in agent config, skipping")
        return None

    synthesizer = tasks[0].get("tools_config", {}).get("synthesizer") or {}
    if synthesizer.get("provider") != "cartesia":
        logger.warning(f"Welcome audio: synthesizer provider {synthesizer.get('provider')!r} is not 'cartesia', skipping")
        return None

    provider_config = synthesizer.get("provider_config") or {}
    return {
        "model_id": provider_config.get("model") or "sonic-3",
        "transcript": welcome_text,
        "voice": {"mode": "id", "id": provider_config.get("voice_id")},
        "language": provider_config.get("language") or "en",
        "output_format": {"container": "raw", "encoding": "pcm_s16le", "sample_rate": 8000},
    }


async def get_welcome_audio(agent_config):
    """Returns the welcome audio from the Redis cache, rendering and caching it on a miss.

    The cache key covers text, voice, model, language and format, so editing any of
    them renders a new greeting."""
    payload = welcome_audio_request(agent_config)
    if payload is None:
        return None

    cache_key = WELCOME_AUDIO_PREFIX + hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            logger.info(f"Welcome audio: served from cache ({len(cached) * 3 // 4} bytes)")
            return cached
    except Exception as e:
        logger.error(f"Welcome audio: cache read failed: {e}")

    audio = await synthesize_welcome_audio(payload)
    if audio:
        try:
            await redis_client.set(cache_key, audio, ex=WELCOME_AUDIO_TTL_S)
        except Exception as e:
            logger.error(f"Welcome audio: cache write failed: {e}")
    return audio


async def synthesize_welcome_audio(payload):
    """Renders the welcome message as base64 PCM16 mono 8kHz audio via Cartesia, or returns None."""
    headers = {"X-API-Key": os.getenv("CARTESIA_API_KEY"), "Cartesia-Version": "2024-06-10"}
    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post("https://api.cartesia.ai/tts/bytes", headers=headers, json=payload) as response:
                if response.status != 200:
                    body = await response.text()
                    logger.error(f"Welcome audio: Cartesia returned {response.status}: {body}")
                    return None
                audio = await response.read()
        logger.info(f"Welcome audio: synthesized {len(audio)} bytes")
        return base64.b64encode(audio).decode("utf-8")
    except Exception as e:
        logger.error(f"Welcome audio: synthesis failed: {e}", exc_info=True)
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

    welcome_audio = await get_welcome_audio(agent_config)
    assistant_manager = AssistantManager(agent_config, websocket, agent_id, welcome_message_audio=welcome_audio)

    try:
        async for index, task_output in assistant_manager.run(local=True):
            logger.info(task_output)
    except WebSocketDisconnect:
        active_websockets.remove(websocket)
    except Exception as e:
        traceback.print_exc()
        logger.error(f"error in executing {e}")
