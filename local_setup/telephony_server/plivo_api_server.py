import os
import re
import hmac
import json
import time
import requests
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse
from dotenv import load_dotenv
import redis.asyncio as redis
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request
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


async def _form(request: Request):
    """Plivo posts application/x-www-form-urlencoded; parsed here so python-multipart is not needed."""
    return {key: values[0] for key, values in parse_qs((await request.body()).decode()).items()}


@app.post("/plivo_connect")
async def plivo_connect(request: Request, bolna_host: str = Query(...), agent_id: str = Query(...)):
    try:
        form = await _form(request)
        print(f"plivo_connect CallUUID={form.get('CallUUID')} agent_id={agent_id}")
        bolna_websocket_url = f"{bolna_host}/chat/v1/{agent_id}"

        # Records both legs in the background; the call goes on to the Stream at once. A failed
        # tunnel lookup only loses the recording, not the call.
        record = ""
        try:
            telephony_host, _ = populate_ngrok_tunnels()
            record = (
                '<Record recordSession="true" redirect="false" maxLength="3600" fileFormat="mp3" '
                f'callbackUrl="{telephony_host}/plivo_recording_callback" callbackMethod="POST" />'
            )
        except Exception as e:
            print(f"Exception occurred looking up the recording callback host: {e}")

        response = """
        <Response>
            {}
            <Stream bidirectional="true" keepCallAlive="true">{}</Stream>
        </Response>
        """.format(record, bolna_websocket_url)

        return PlainTextResponse(str(response), status_code=200, media_type="text/xml")

    except Exception as e:
        print(f"Exception occurred in plivo_connect: {e}")


@app.post("/plivo_hangup_callback")
async def plivo_hangup_callback(request: Request):
    # add any post call hangup processing
    return PlainTextResponse("", status_code=200)


# --- Call recording ----------------------------------------------------------
# Plivo posts here once a <Record recordSession> file is ready. The MP3 is copied to
# gs://$RECORDINGS_BUCKET/recordings/<IST date>/<CallUUID>.mp3; the call_summary line
# bolna-app logs maps that CallUUID (call_sid) to the run_id of its transcript.
IST = timezone(timedelta(hours=5, minutes=30))
CALL_UUID = re.compile(r"[A-Za-z0-9-]+")


def _is_plivo_url(url):
    # The download carries our Plivo credentials, so it must only ever go to Plivo.
    parsed = urlparse(url)
    host = parsed.hostname or ""
    return parsed.scheme == "https" and (host == "plivo.com" or host.endswith(".plivo.com"))


def _gcs_client():
    from google.cloud import storage  # Application Default Credentials: the VM service account

    return storage.Client()


def save_recording(record_url, call_uuid, recording_id, duration_s):
    bucket = os.getenv("RECORDINGS_BUCKET")
    if not bucket:
        print(f"RECORDINGS_BUCKET unset, not uploading {record_url} (CallUUID={call_uuid})")
        return

    path = f"recordings/{datetime.now(IST):%Y-%m-%d}/{call_uuid}.mp3"
    try:
        audio = requests.get(record_url, auth=(plivo_auth_id, plivo_auth_token), timeout=60)
        audio.raise_for_status()
        blob = _gcs_client().bucket(bucket).blob(path)
        blob.metadata = {"call_uuid": call_uuid, "recording_id": recording_id, "duration_s": duration_s}
        blob.upload_from_string(audio.content, content_type="audio/mpeg")
        print(f"recording saved gs://{bucket}/{path}")
    except Exception as e:
        print(f"Exception occurred saving recording {record_url} to gs://{bucket}/{path}: {e}")


@app.post("/plivo_recording_callback")
async def plivo_recording_callback(request: Request, background_tasks: BackgroundTasks):
    form = await _form(request)
    record_url = form.get("RecordUrl")
    call_uuid = form.get("CallUUID", "")
    if not record_url or not _is_plivo_url(record_url):
        raise HTTPException(status_code=400, detail="RecordUrl must be a Plivo https URL")
    if not CALL_UUID.fullmatch(call_uuid):
        raise HTTPException(status_code=400, detail="Invalid CallUUID")

    background_tasks.add_task(
        save_recording, record_url, call_uuid, form.get("RecordingID"), form.get("RecordingDuration")
    )
    return PlainTextResponse("", status_code=200)


# --- Call transfer -----------------------------------------------------------
# Bolna POSTs here (CALL_TRANSFER_WEBHOOK_URL) when a transfer tool has no url of its
# own. The caller's leg is moved to /plivo_transfer_xml, which dials the transfer number.
E164_NUMBER = re.compile(r"^\+\d{8,15}$", re.ASCII)


@app.post("/transfer_call")
async def transfer_call(request: Request):
    body = await request.json()
    call_sid = body.get("call_sid")
    number = body.get("call_transfer_number")
    if not call_sid or not number:
        raise HTTPException(status_code=400, detail="call_sid and call_transfer_number are required")
    # Checked here too: Plivo drops the caller if the transfer XML it fetches is an error.
    if not E164_NUMBER.fullmatch(str(number)):
        raise HTTPException(status_code=400, detail="call_transfer_number must be E.164, e.g. +919876543210")

    try:
        telephony_host, _ = populate_ngrok_tunnels()
        plivo_client.calls.transfer(
            call_uuid=call_sid,
            legs="aleg",
            aleg_url=f"{telephony_host}/plivo_transfer_xml?number={quote(number, safe='')}",
            aleg_method="POST",
        )
    except Exception as e:
        print(f"Exception occurred in transfer_call for {call_sid}: {e}")
        raise HTTPException(status_code=502, detail="Could not transfer the call")

    print(f"Transferred call {call_sid} to {number}")
    return JSONResponse({"status": "transferred"})


@app.api_route("/plivo_transfer_xml", methods=["GET", "POST"])
async def plivo_transfer_xml(number: str = Query(...)):
    # Validated before it goes into the XML.
    if not E164_NUMBER.fullmatch(number):
        raise HTTPException(status_code=400, detail="Invalid transfer number")

    response = f'<Response><Dial callerId="{plivo_phone_number}"><Number>{number}</Number></Dial></Response>'
    return PlainTextResponse(response, status_code=200, media_type="text/xml")


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
