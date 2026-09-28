"""Call recording in local_setup/telephony_server/plivo_api_server.py: /plivo_connect starts a session
<Record> before the <Stream>, and /plivo_recording_callback copies the MP3 to GCS under the IST date
and CallUUID. Plivo, the download and GCS are mocked."""

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

HOST = "https://tunnel.example"
RECORD_URL = "https://media.plivo.com/v1/Account/MA0/Recording/rec-1.mp3"
CALLBACK = {"RecordUrl": RECORD_URL, "CallUUID": "call-uuid-1", "RecordingID": "rec-1", "RecordingDuration": "42"}


@pytest.fixture
def tunnels(plivo_server, monkeypatch):
    monkeypatch.setattr(plivo_server, "populate_ngrok_tunnels", lambda: (HOST, "wss://bolna.example"))


@pytest.fixture
def storage(plivo_server, monkeypatch):
    """Mocks the download and GCS; the clock reads 20:00 UTC, already the next day in IST."""
    monkeypatch.setenv("RECORDINGS_BUCKET", "test-recordings")
    download = MagicMock(return_value=MagicMock(content=b"mp3-bytes"))
    monkeypatch.setattr(plivo_server.requests, "get", download)
    gcs = MagicMock()
    monkeypatch.setattr(plivo_server, "_gcs_client", lambda: gcs)

    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 9, 27, 20, 0, tzinfo=timezone.utc).astimezone(tz)

    monkeypatch.setattr(plivo_server, "datetime", FrozenDatetime)
    return download, gcs


async def test_connect_records_the_session_before_the_stream(plivo_request, tunnels):
    response = await plivo_request(
        "POST",
        "/plivo_connect",
        params={"bolna_host": "wss://bolna.example", "agent_id": "agent-1"},
        data={"CallUUID": "call-uuid-1"},
    )

    xml = response.text
    assert response.status_code == 200
    assert '<Record recordSession="true" redirect="false" maxLength="3600" fileFormat="mp3"' in xml
    assert f'callbackUrl="{HOST}/plivo_recording_callback" callbackMethod="POST"' in xml
    assert '<Stream bidirectional="true" keepCallAlive="true">wss://bolna.example/chat/v1/agent-1</Stream>' in xml
    assert xml.index("<Record") < xml.index("<Stream")


async def test_connect_still_streams_when_the_tunnel_lookup_fails(plivo_request, plivo_server, monkeypatch):
    def no_tunnel():
        raise ConnectionError("ngrok down")

    monkeypatch.setattr(plivo_server, "populate_ngrok_tunnels", no_tunnel)

    response = await plivo_request(
        "POST", "/plivo_connect", params={"bolna_host": "wss://bolna.example", "agent_id": "agent-1"}
    )

    assert "<Record" not in response.text
    assert "wss://bolna.example/chat/v1/agent-1</Stream>" in response.text


async def test_recording_is_uploaded_under_the_ist_date_and_call_uuid(plivo_request, storage):
    download, gcs = storage

    response = await plivo_request("POST", "/plivo_recording_callback", data=CALLBACK)

    assert response.status_code == 200
    download.assert_called_once_with(RECORD_URL, auth=("MAPLACEHOLDER0000000", "placeholder-token"), timeout=60)
    gcs.bucket.assert_called_once_with("test-recordings")
    gcs.bucket.return_value.blob.assert_called_once_with("recordings/2026-09-28/call-uuid-1.mp3")
    blob = gcs.bucket.return_value.blob.return_value
    assert blob.metadata == {"call_uuid": "call-uuid-1", "recording_id": "rec-1", "duration_s": "42"}
    blob.upload_from_string.assert_called_once_with(b"mp3-bytes", content_type="audio/mpeg")


@pytest.mark.parametrize(
    "overrides",
    [
        {"RecordUrl": None},
        # The download sends our Plivo credentials, so a non-Plivo host must never be fetched.
        {"RecordUrl": "https://attacker.example/rec.mp3"},
        {"RecordUrl": "http://media.plivo.com/rec.mp3"},
        {"CallUUID": "../other/call"},
    ],
)
async def test_bad_callback_is_rejected_without_download(plivo_request, storage, overrides):
    download, gcs = storage
    form = {key: value for key, value in {**CALLBACK, **overrides}.items() if value is not None}

    response = await plivo_request("POST", "/plivo_recording_callback", data=form)

    assert response.status_code == 400
    download.assert_not_called()
    gcs.bucket.assert_not_called()


async def test_unset_bucket_skips_the_upload(plivo_request, storage, monkeypatch):
    download, gcs = storage
    monkeypatch.delenv("RECORDINGS_BUCKET")

    response = await plivo_request("POST", "/plivo_recording_callback", data=CALLBACK)

    assert response.status_code == 200
    download.assert_not_called()
    gcs.bucket.assert_not_called()
