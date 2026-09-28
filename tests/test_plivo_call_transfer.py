"""Call transfer in local_setup/telephony_server/plivo_api_server.py: /transfer_call moves the caller's
leg to /plivo_transfer_xml, which dials the number. The Plivo client and ngrok lookup are mocked."""

import importlib.util
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import pytest
from plivo import exceptions as plivo_exceptions

SERVER_PATH = Path(__file__).resolve().parent.parent / "local_setup" / "telephony_server" / "plivo_api_server.py"
HOST = "https://tunnel.example"


@pytest.fixture(scope="module")
def server():
    with pytest.MonkeyPatch.context() as mp:
        # Its load_dotenv() would pull local_setup/.env's real keys into the whole test session.
        mp.setattr("dotenv.load_dotenv", lambda *args, **kwargs: False)
        # The module builds a Plivo client at import, which needs a well-formed auth id.
        mp.setenv("PLIVO_AUTH_ID", "MAPLACEHOLDER0000000")
        mp.setenv("PLIVO_AUTH_TOKEN", "placeholder-token")
        mp.setenv("PLIVO_PHONE_NUMBER", "+918000000000")
        spec = importlib.util.spec_from_file_location("plivo_api_server", SERVER_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module


@pytest.fixture
def plivo(server, monkeypatch):
    client = MagicMock()
    monkeypatch.setattr(server, "plivo_client", client)
    monkeypatch.setattr(server, "populate_ngrok_tunnels", lambda: (HOST, "wss://bolna.example"))
    return client


async def _request(server, method, url, **kwargs):
    transport = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://plivo-app") as client:
        return await client.request(method, url, **kwargs)


async def test_transfer_call_moves_the_caller_leg_to_the_dial_xml(server, plivo):
    response = await _request(
        server,
        "POST",
        "/transfer_call",
        json={"call_sid": "call-uuid-1", "call_transfer_number": "+919330724843", "provider": "plivo"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "transferred"}
    plivo.calls.transfer.assert_called_once_with(
        call_uuid="call-uuid-1",
        legs="aleg",
        aleg_url=f"{HOST}/plivo_transfer_xml?number=%2B919330724843",
        aleg_method="POST",
    )


@pytest.mark.parametrize("missing", ["call_sid", "call_transfer_number"])
async def test_transfer_call_requires_both_fields(server, plivo, missing):
    body = {"call_sid": "call-uuid-1", "call_transfer_number": "+919330724843"}
    body.pop(missing)

    response = await _request(server, "POST", "/transfer_call", json=body)

    assert response.status_code == 400
    plivo.calls.transfer.assert_not_called()


async def test_transfer_call_rejects_a_number_that_is_not_e164(server, plivo):
    response = await _request(
        server, "POST", "/transfer_call", json={"call_sid": "call-uuid-1", "call_transfer_number": "919330724843"}
    )

    assert response.status_code == 400
    plivo.calls.transfer.assert_not_called()


async def test_transfer_call_plivo_error_returns_502(server, plivo):
    plivo.calls.transfer.side_effect = plivo_exceptions.PlivoRestError("call not found")

    response = await _request(
        server, "POST", "/transfer_call", json={"call_sid": "gone", "call_transfer_number": "+919330724843"}
    )

    assert response.status_code == 502


@pytest.mark.parametrize("method", ["GET", "POST"])
async def test_transfer_xml_dials_the_number(server, method):
    response = await _request(server, method, "/plivo_transfer_xml", params={"number": "+919330724843"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/xml")
    assert response.text == (
        '<Response><Dial callerId="+918000000000"><Number>+919330724843</Number></Dial></Response>'
    )


@pytest.mark.parametrize(
    "number",
    ["919330724843", "+91 93307 24843", "+1234567", "+1234567890123456", "+9193<Hangup/>", "+919330724843\n"],
)
async def test_transfer_xml_rejects_a_bad_number(server, number):
    response = await _request(server, "POST", "/plivo_transfer_xml", params={"number": number})

    assert response.status_code == 400
