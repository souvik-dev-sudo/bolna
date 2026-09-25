import os
import re
import hmac
import json
import time
import requests
import uuid
from collections import deque
from pathlib import Path
from dotenv import load_dotenv
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
import plivo

app = FastAPI()
load_dotenv()
port = 8002

plivo_auth_id = os.getenv("PLIVO_AUTH_ID")
plivo_auth_token = os.getenv("PLIVO_AUTH_TOKEN")
plivo_phone_number = os.getenv("PLIVO_PHONE_NUMBER")

# Initialize Plivo client
plivo_client = plivo.RestClient(os.getenv("PLIVO_AUTH_ID"), os.getenv("PLIVO_AUTH_TOKEN"))


def populate_ngrok_tunnels():
    response = requests.get("http://ngrok:4040/api/tunnels")  # ngrok interface
    telephony_url, bolna_url = None, None

    if response.status_code == 200:
        data = response.json()

        for tunnel in data["tunnels"]:
            if tunnel["name"] == "plivo-app":
                telephony_url = tunnel["public_url"]
            elif tunnel["name"] == "bolna-app":
                bolna_url = tunnel["public_url"].replace("https:", "wss:")

        return telephony_url, bolna_url
    else:
        print(f"Error: Unable to fetch data. Status code: {response.status_code}")


def place_call(agent_id, recipient_phone_number):
    telephony_host, bolna_host = populate_ngrok_tunnels()

    print(f"telephony_host: {telephony_host}")
    print(f"bolna_host: {bolna_host}")

    # adding hangup_url since plivo opens a 2nd websocket once the call is cut.
    # https://github.com/bolna-ai/bolna/issues/148#issuecomment-2127980509
    plivo_client.calls.create(
        from_=plivo_phone_number,
        to_=recipient_phone_number,
        answer_url=f"{telephony_host}/plivo_connect?bolna_host={bolna_host}&agent_id={agent_id}",
        hangup_url=f"{telephony_host}/plivo_hangup_callback",
        answer_method="POST",
    )


@app.post("/call")
async def make_call(request: Request):
    try:
        call_details = await request.json()
        agent_id = call_details.get("agent_id", None)

        if not agent_id:
            raise HTTPException(status_code=404, detail="Agent not provided")

        if not call_details or "recipient_phone_number" not in call_details:
            raise HTTPException(status_code=404, detail="Recipient phone number not provided")

        place_call(agent_id, call_details.get("recipient_phone_number"))

        return PlainTextResponse("done", status_code=200)

    except Exception as e:
        print(f"Exception occurred in make_call: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.post("/plivo_connect")
async def plivo_connect(request: Request, bolna_host: str = Query(...), agent_id: str = Query(...)):
    try:
        bolna_websocket_url = f"{bolna_host}/chat/v1/{agent_id}"

        response = """
        <Response>
            <Stream bidirectional="true" keepCallAlive="true">{}</Stream>
        </Response>
        """.format(bolna_websocket_url)

        return PlainTextResponse(str(response), status_code=200, media_type="text/xml")

    except Exception as e:
        print(f"Exception occurred in plivo_connect: {e}")


@app.post("/plivo_hangup_callback")
async def plivo_hangup_callback(request: Request):
    # add any post call hangup processing
    return PlainTextResponse("", status_code=200)


# --- Browser test page: /test-call -------------------------------------------
# Lets someone place a test call from a browser. Enabled only when TEST_CALL_PIN
# is set; limited to a few calls, with a lockout after repeated wrong PINs.
TEST_CALL_PIN = os.getenv("TEST_CALL_PIN", "")
TEST_CALL_PAGE = Path(__file__).with_name("test_call.html")
BOLNA_AGENTS_URL = "http://bolna-app:5001/all"
MAX_CALLS, CALL_WINDOW_S = 5, 600
MAX_BAD_PINS, LOCKOUT_S = 5, 900

recent_calls = deque()
bad_pins = deque()


def _prune(times, window_s):
    now = time.time()
    while times and now - times[0] > window_s:
        times.popleft()


async def _check_pin(request: Request):
    if not TEST_CALL_PIN:
        raise HTTPException(status_code=404, detail="Not found")

    _prune(bad_pins, LOCKOUT_S)
    if len(bad_pins) >= MAX_BAD_PINS:
        raise HTTPException(status_code=429, detail="Too many wrong PINs. Try again in 15 minutes.")

    body = await request.json()
    if not hmac.compare_digest(str(body.get("pin", "")), TEST_CALL_PIN):
        bad_pins.append(time.time())
        raise HTTPException(status_code=403, detail="Wrong PIN")
    return body


@app.get("/test-call", response_class=HTMLResponse)
async def test_call_page():
    if not TEST_CALL_PIN:
        raise HTTPException(status_code=404, detail="Not found")
    return HTMLResponse(TEST_CALL_PAGE.read_text())


@app.post("/test-call/agents")
async def test_call_agents(request: Request):
    await _check_pin(request)
    try:
        agents = requests.get(BOLNA_AGENTS_URL, timeout=5).json().get("agents", [])
    except Exception as e:
        print(f"Exception occurred fetching agents: {e}")
        raise HTTPException(status_code=502, detail="Could not load agents")
    return JSONResponse(
        [{"agent_id": a["agent_id"], "name": a["data"].get("agent_name", a["agent_id"])} for a in agents]
    )


@app.post("/test-call")
async def test_call(request: Request):
    body = await _check_pin(request)

    agent_id = str(body.get("agent_id", "")).strip()
    phone = re.sub(r"[\s+\-()]", "", str(body.get("phone", "")))
    if not agent_id:
        raise HTTPException(status_code=400, detail="Choose an agent")
    if not re.fullmatch(r"\d{10,15}", phone):
        raise HTTPException(status_code=400, detail="Enter the number with country code, e.g. 919876543210")

    _prune(recent_calls, CALL_WINDOW_S)
    if len(recent_calls) >= MAX_CALLS:
        raise HTTPException(status_code=429, detail="Too many test calls. Try again in a few minutes.")

    try:
        place_call(agent_id, phone)
    except Exception as e:
        print(f"Exception occurred in test_call: {e}")
        raise HTTPException(status_code=500, detail="Could not place the call")

    recent_calls.append(time.time())
    return JSONResponse({"status": "calling", "phone": phone})
