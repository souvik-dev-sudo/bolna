"""GeminiTranscriber's Vertex AI mode: the global/regional Live URL, the bearer header from ADC and
the full publisher model path, with the AI Studio API-key connection left unchanged when it is off."""

import json

import pytest

from bolna.transcriber import gemini_transcriber
from bolna.transcriber.gemini_transcriber import GEMINI_LIVE_URL, GeminiTranscriber

VERTEX_PATH = "/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent"


def _make(**kwargs):
    return GeminiTranscriber(telephony_provider="plivo", model="gemini-3.5-transcribe-live", **kwargs)


@pytest.fixture
def vertex_env(monkeypatch):
    monkeypatch.setenv("GEMINI_USE_VERTEX", "true")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    monkeypatch.delenv("GEMINI_STT_LOCATION", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    async def fake_credentials():
        return "fake-token", "adc-project"

    monkeypatch.setattr(gemini_transcriber, "get_gcp_credentials", fake_credentials)


@pytest.fixture
def api_key_env(monkeypatch):
    monkeypatch.delenv("GEMINI_USE_VERTEX", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "placeholder-key")


class FakeSocket:
    def __init__(self):
        self.sent = []

    async def send(self, data):
        self.sent.append(json.loads(data))

    async def recv(self):
        return json.dumps({"setupComplete": {}})


@pytest.fixture
def fake_connect(monkeypatch):
    calls = []

    async def connect(url, **kwargs):
        socket = FakeSocket()
        calls.append({"url": url, "kwargs": kwargs, "socket": socket})
        return socket

    monkeypatch.setattr(gemini_transcriber.websockets, "connect", connect)
    return calls


async def test_vertex_global_connects_with_bearer_and_no_key(vertex_env, fake_connect):
    await _make().gemini_connect()

    call = fake_connect[0]
    assert call["url"] == f"wss://aiplatform.googleapis.com{VERTEX_PATH}"
    assert "key=" not in call["url"]
    assert call["kwargs"]["additional_headers"] == {"Authorization": "Bearer fake-token"}
    assert call["kwargs"]["max_size"] is None
    assert call["socket"].sent[0]["setup"]["model"] == (
        "projects/test-project/locations/global/publishers/google/models/gemini-3.5-transcribe-live"
    )


async def test_vertex_regional_location_uses_regional_host(vertex_env, monkeypatch, fake_connect):
    monkeypatch.setenv("GEMINI_STT_LOCATION", "us-central1")
    await _make().gemini_connect()

    call = fake_connect[0]
    assert call["url"] == f"wss://us-central1-aiplatform.googleapis.com{VERTEX_PATH}"
    assert call["socket"].sent[0]["setup"]["model"] == (
        "projects/test-project/locations/us-central1/publishers/google/models/gemini-3.5-transcribe-live"
    )


async def test_vertex_leaves_rest_of_setup_unchanged(vertex_env, monkeypatch):
    vertex_setup = _make(endpointing="300")._build_setup()
    monkeypatch.setenv("GEMINI_USE_VERTEX", "false")
    api_key_setup = _make(endpointing="300")._build_setup()

    vertex_setup.pop("model")
    api_key_setup.pop("model")
    assert vertex_setup == api_key_setup


async def test_api_key_mode_is_unchanged(api_key_env, fake_connect):
    await _make().gemini_connect()

    call = fake_connect[0]
    assert call["url"] == f"{GEMINI_LIVE_URL}?key=placeholder-key"
    assert call["kwargs"]["additional_headers"] is None
    assert call["socket"].sent[0]["setup"]["model"] == "models/gemini-3.5-transcribe-live"


async def test_api_key_mode_still_requires_a_key(monkeypatch, fake_connect):
    monkeypatch.delenv("GEMINI_USE_VERTEX", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    with pytest.raises(ConnectionError, match="No Gemini API key"):
        await _make().gemini_connect()
    assert fake_connect == []
