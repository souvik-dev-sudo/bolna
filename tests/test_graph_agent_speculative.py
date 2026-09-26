"""Speculative parallel routing in GraphAgent.generate(): an LLM node streams its reply while the
routing call runs. A turn that stays uses that stream and calls the LLM once; a transition cancels
it and the new node generates; an exception in the speculative stream reaches the caller."""

import asyncio

import pytest
from unittest.mock import MagicMock, patch

from bolna.agent_types.graph_agent import GraphAgent


async def _collect(agen):
    return [item async for item in agen]


def _make_agent(nodes, current_node_id="ask"):
    mock_llm = MagicMock()
    mock_llm.trigger_function_call = False
    config = {
        "agent_information": "Test agent",
        "model": "gpt-4o-mini",
        "provider": "openai",
        "temperature": 0.7,
        "max_tokens": 150,
        "current_node_id": current_node_id,
        "nodes": nodes,
    }
    with (
        patch("bolna.agent_types.graph_agent.SUPPORTED_LLM_PROVIDERS", {"openai": MagicMock(return_value=mock_llm)}),
        patch("bolna.agent_types.graph_agent.OpenAiLLM", return_value=MagicMock()),
    ):
        agent = GraphAgent(config)
    # Past the node's first reply, so the turn routes instead of holding.
    agent._active_node_first_response_delivered = True
    agent._mock_llm = mock_llm
    return agent


NODES = [
    {
        "id": "ask",
        "prompt": "Ask for the reason.",
        "edges": [{"to_node_id": "close", "condition": "the caller wants to end the call"}],
    },
    {"id": "close", "prompt": "Say goodbye.", "edges": []},
]
HISTORY = [{"role": "user", "content": "I was travelling"}]


def _route_once_started(llm_started: asyncio.Event, next_node_id):
    """Routing that only returns after the speculative stream has begun, proving they overlap."""

    async def decide(history):
        await llm_started.wait()
        return next_node_id, None, 42.0, None, None, "because", 0.9, None

    return decide


def _stream(chunks, started=None, block=None, error=None, closed=None):
    async def gen():
        try:
            if started is not None:
                started.set()
            if block is not None:
                await block.wait()
            for chunk in chunks:
                yield chunk
            if error is not None:
                raise error
        finally:
            if closed is not None:
                closed.append(True)

    return gen()


async def test_stay_yields_speculative_chunks_and_calls_llm_once():
    agent = _make_agent(NODES)
    started = asyncio.Event()
    agent._mock_llm.generate_stream = MagicMock(side_effect=lambda *a, **k: _stream(["Why", " though?"], started))
    agent.decide_next_node_with_functions = _route_once_started(started, None)

    out = await _collect(agent.generate(HISTORY))

    assert agent.current_node_id == "ask"
    assert agent._mock_llm.generate_stream.call_count == 1
    assert out[0]["routing_info"]["transitioned"] is False
    assert "Ask for the reason." in out[1]["messages"][0]["content"]
    assert out[2:] == ["Why", " though?"]


async def test_transition_cancels_speculation_and_new_node_generates():
    agent = _make_agent(NODES)
    started = asyncio.Event()
    never = asyncio.Event()
    closed = []
    streams = iter(
        [
            _stream(["stale"], started=started, block=never, closed=closed),
            _stream(["Goodbye."]),
        ]
    )
    agent._mock_llm.generate_stream = MagicMock(side_effect=lambda *a, **k: next(streams))
    agent.decide_next_node_with_functions = _route_once_started(started, "close")

    out = await _collect(agent.generate(HISTORY))
    await asyncio.sleep(0)  # let the cancelled speculative task unwind

    assert agent.current_node_id == "close"
    assert closed == [True]
    assert "stale" not in out
    assert out[0]["routing_info"]["transitioned"] is True
    assert "Say goodbye." in out[1]["messages"][0]["content"]
    assert out[2:] == ["Goodbye."]
    assert agent._mock_llm.generate_stream.call_count == 2


async def test_speculative_exception_propagates():
    agent = _make_agent(NODES)
    started = asyncio.Event()
    agent._mock_llm.generate_stream = MagicMock(
        side_effect=lambda *a, **k: _stream(["partial"], started, error=RuntimeError("llm down"))
    )
    agent.decide_next_node_with_functions = _route_once_started(started, None)

    out = []
    with pytest.raises(RuntimeError, match="llm down"):
        async for item in agent.generate(HISTORY):
            out.append(item)
    assert out[-1] == "partial"
