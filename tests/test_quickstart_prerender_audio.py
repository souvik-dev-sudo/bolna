"""Pre-rendered welcome and static audio in local_setup/quickstart_server.py: the Sarvam request and
its WAV-to-raw-PCM decoding, and picking each message's synthesizer by language. HTTP is mocked."""

import base64
import importlib.util
import io
import json
import wave
from pathlib import Path

import pytest

SERVER_PATH = Path(__file__).resolve().parent.parent / "local_setup" / "quickstart_server.py"

CARTESIA_EN = {
    "provider": "cartesia",
    "provider_config": {"voice": "Nithya", "voice_id": "voice-en", "model": "sonic-3", "language": "en"},
}
SARVAM_HI = {
    "provider": "sarvam",
    "provider_config": {"voice": "Suhani", "voice_id": "suhani", "model": "bulbul:v3", "language": "hi-IN"},
}


@pytest.fixture(scope="module")
def server():
    with pytest.MonkeyPatch.context() as mp:
        # The module builds its Redis pool at import; nothing connects until a command runs.
        mp.setenv("REDIS_URL", "redis://localhost:6379")
        # Its load_dotenv() would pull local_setup/.env's real keys into the whole test session.
        mp.setattr("dotenv.load_dotenv", lambda *args, **kwargs: False)
        spec = importlib.util.spec_from_file_location("quickstart_server", SERVER_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module


def _agent(synthesizer, nodes=(), welcome="Good morning"):
    return {
        "agent_welcome_message": welcome,
        "tasks": [
            {
                "tools_config": {
                    "synthesizer": synthesizer,
                    "llm_agent": {"llm_config": {"nodes": list(nodes)}},
                }
            }
        ],
    }


def _wav(frames, rate=8000):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(frames)
    return buffer.getvalue()


def _sarvam_body(wav_bytes):
    return json.dumps({"audios": [base64.b64encode(wav_bytes).decode()]}).encode()


class FakeResponse:
    def __init__(self, status, body):
        self.status = status
        self._body = body

    async def read(self):
        return self._body

    async def text(self):
        return self._body.decode()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


@pytest.fixture
def fake_http(server, monkeypatch):
    """Answers every POST with the queued (status, body) and records the requests."""
    calls = []
    reply = {}

    class FakeSession:
        def __init__(self, **kwargs):
            pass

        def post(self, url, headers=None, json=None):
            calls.append({"url": url, "headers": headers, "json": json})
            return FakeResponse(*reply["value"])

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

    monkeypatch.setattr(server.aiohttp, "ClientSession", FakeSession)
    monkeypatch.setenv("SARVAM_API_KEY", "placeholder-key")
    return calls, reply


def test_sarvam_request_body(server):
    provider, payload = server.tts_request(SARVAM_HI, "नमस्ते", "Test")

    assert provider == "sarvam"
    assert payload == {
        "text": "नमस्ते",
        "target_language_code": "hi-IN",
        "speaker": "suhani",
        "model": "bulbul:v3",
        "speech_sample_rate": 8000,
    }


async def test_sarvam_wav_is_returned_as_raw_pcm(server, fake_http):
    calls, reply = fake_http
    frames = bytes(range(256)) * 4
    reply["value"] = (200, _sarvam_body(_wav(frames)))

    audio = await server.synthesize_audio("sarvam", {"text": "hi"}, "Test")

    assert base64.b64decode(audio) == frames
    assert calls[0]["url"] == "https://api.sarvam.ai/text-to-speech"
    assert calls[0]["headers"] == {"api-subscription-key": "placeholder-key"}
    assert calls[0]["json"] == {"text": "hi"}


async def test_sarvam_audio_at_another_rate_is_rejected(server, fake_http):
    _, reply = fake_http
    reply["value"] = (200, _sarvam_body(_wav(b"\x00\x01" * 10, rate=22050)))

    assert await server.synthesize_audio("sarvam", {"text": "hi"}, "Test") is None


async def test_sarvam_http_error_returns_none(server, fake_http):
    _, reply = fake_http
    reply["value"] = (400, b'{"error": "bad speaker"}')

    assert await server.synthesize_audio("sarvam", {"text": "hi"}, "Test") is None


def test_welcome_uses_the_active_language_synthesizer(server):
    agent = _agent({**CARTESIA_EN, "multilingual": {"en": CARTESIA_EN, "hi": SARVAM_HI}, "active": "hi"})

    provider, payload = server.welcome_audio_request(agent)

    assert provider == "sarvam"
    assert payload["target_language_code"] == "hi-IN"


def test_welcome_without_multilingual_uses_the_top_level_synthesizer(server):
    provider, payload = server.welcome_audio_request(_agent(SARVAM_HI))

    assert provider == "sarvam"
    assert payload["text"] == "Good morning"


async def test_static_variants_use_the_synthesizer_for_their_language(server, monkeypatch):
    nodes = [{"id": "close", "static_message": {"en": "Goodbye.", "hi": "अलविदा।", "ta": "Goodbye."}}]
    agent = _agent({**CARTESIA_EN, "multilingual": {"hi": SARVAM_HI}}, nodes)
    requests = []

    async def fake_cached_audio(prefix, request, label):
        requests.append(request)
        return f"audio-{len(requests)}"

    monkeypatch.setattr(server, "get_cached_audio", fake_cached_audio)

    audio = await server.get_static_audio(agent)

    # "ta" repeats the English text, so it is rendered once, by the first variant's synthesizer.
    assert [provider for provider, _ in requests] == ["cartesia", "sarvam"]
    assert requests[1][1]["text"] == "अलविदा।"
    assert audio == {"Goodbye.": "audio-1", "अलविदा।": "audio-2"}
