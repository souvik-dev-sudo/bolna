"""AgentModel keeps synthesizer.multilingual and synthesizer.active, so the model_dump POST /agent
stores no longer drops per-language TTS."""

from bolna.models import AgentModel

CARTESIA_EN = {
    "provider": "cartesia",
    "provider_config": {"voice": "Nithya", "voice_id": "voice-en", "model": "sonic-3", "language": "en"},
}
SARVAM_HI = {
    "provider": "sarvam",
    "provider_config": {"voice": "Suhani", "voice_id": "suhani", "model": "bulbul:v3", "language": "hi-IN"},
}


def _dumped_synthesizer(synthesizer):
    agent = AgentModel(
        agent_name="test",
        tasks=[
            {
                "tools_config": {"synthesizer": synthesizer},
                "toolchain": {"execution": "parallel", "pipelines": [["synthesizer"]]},
            }
        ],
    )
    return agent.model_dump()["tasks"][0]["tools_config"]["synthesizer"]


def test_multilingual_and_active_survive_model_dump():
    multilingual = {"en": CARTESIA_EN, "hi": SARVAM_HI}
    synthesizer = _dumped_synthesizer({**CARTESIA_EN, "multilingual": multilingual, "active": "hi"})

    assert synthesizer["multilingual"] == multilingual
    assert synthesizer["active"] == "hi"


def test_single_language_synthesizer_dumps_them_as_none():
    synthesizer = _dumped_synthesizer(CARTESIA_EN)

    assert synthesizer["multilingual"] is None
    assert synthesizer["active"] is None
