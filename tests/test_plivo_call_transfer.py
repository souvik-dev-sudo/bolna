"""Call transfer in local_setup/telephony_server/plivo_api_server.py: /transfer_call moves the caller's
leg to /plivo_transfer_xml, which dials the number. The Plivo client and ngrok lookup are mocked."""

from unittest.mock import MagicMock

import pytest
from plivo import exceptions as plivo_exceptions

HOST = "https://tunnel.example"


@pytest.fixture
def plivo(plivo_server, monkeypatch):
    client = MagicMock()
    monkeypatch.setattr(plivo_server, "plivo_client", client)
    monkeypatch.setattr(plivo_server, "populate_ngrok_tunnels", lambda: (HOST, "wss://bolna.example"))
    return client


async def test_transfer_call_moves_the_caller_leg_to_the_dial_xml(plivo_request, plivo):
    response = await plivo_request(
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
async def test_transfer_call_requires_both_fields(plivo_request, plivo, missing):
    body = {"call_sid": "call-uuid-1", "call_transfer_number": "+919330724843"}
    body.pop(missing)

    response = await plivo_request("POST", "/transfer_call", json=body)

    assert response.status_code == 400
    plivo.calls.transfer.assert_not_called()


async def test_transfer_call_rejects_a_number_that_is_not_e164(plivo_request, plivo):
    response = await plivo_request(
        "POST", "/transfer_call", json={"call_sid": "call-uuid-1", "call_transfer_number": "919330724843"}
    )

    assert response.status_code == 400
    plivo.calls.transfer.assert_not_called()


async def test_transfer_call_plivo_error_returns_502(plivo_request, plivo):
    plivo.calls.transfer.side_effect = plivo_exceptions.PlivoRestError("call not found")

    response = await plivo_request(
        "POST", "/transfer_call", json={"call_sid": "gone", "call_transfer_number": "+919330724843"}
    )

    assert response.status_code == 502


@pytest.mark.parametrize("method", ["GET", "POST"])
async def test_transfer_xml_dials_the_number(plivo_request, method):
    response = await plivo_request(method, "/plivo_transfer_xml", params={"number": "+919330724843"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/xml")
    assert response.text == (
        '<Response><Dial callerId="+918000000000"><Number>+919330724843</Number></Dial></Response>'
    )


@pytest.mark.parametrize(
    "number",
    ["919330724843", "+91 93307 24843", "+1234567", "+1234567890123456", "+9193<Hangup/>", "+919330724843\n"],
)
async def test_transfer_xml_rejects_a_bad_number(plivo_request, number):
    response = await plivo_request("POST", "/plivo_transfer_xml", params={"number": number})

    assert response.status_code == 400
