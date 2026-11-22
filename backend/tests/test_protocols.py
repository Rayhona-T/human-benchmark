"""The server's protocol facts must match the approved frontend configuration.

These tests read the frontend source (read-only) so that a protocol change in
one place without the other fails loudly instead of rejecting real sessions.
"""

import re
from pathlib import Path

import pytest

from app.protocols import (
    FLANKER_KEY_FOR_DIRECTION,
    FLANKER_SYMBOL,
    PROTOCOLS,
    STROOP_KEY_FOR_INK,
)

FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src" / "experiments"


def source(relative: str) -> str:
    return (FRONTEND / relative).read_text(encoding="utf-8")


def constant(text: str, name: str) -> str:
    match = re.search(rf'export const {name} = "([^"]+)"', text)
    assert match, name
    return match.group(1)


@pytest.mark.parametrize(
    ("experiment", "config_file", "schedule_file", "prefix"),
    [
        ("stroop", "stroop/stroop.ts", "stroop/stroopSchedule.ts", "STROOP"),
        ("flanker", "flanker/flanker.ts", "flanker/flankerSchedule.ts", "FLANKER"),
    ],
)
def test_identity_counts_and_deadline_match_frontend(
    experiment: str, config_file: str, schedule_file: str, prefix: str
) -> None:
    spec = PROTOCOLS[experiment]
    text = source(config_file)
    assert constant(text, f"{prefix}_PROTOCOL_ID") == spec.protocol_id
    assert constant(text, f"{prefix}_CONFIG_ID") == spec.configuration_id
    assert constant(text, f"{prefix}_PRNG_ID") == spec.prng_id
    assert f'protocolVersion: "{spec.protocol_version}"' in text
    assert f'configurationVersion: "{spec.configuration_version}"' in text
    assert f"trialCount: {spec.practice_trials}," in text
    assert f"trialCount: {spec.main_trials}," in text
    assert f"responseDeadlineMs: {spec.response_deadline_ms:g}," in text
    assert f"breakAfterTrialIndex: {spec.break_after_main_trial}," in text
    randomization_text = text + source(schedule_file)
    assert re.search(
        rf'randomizationConfigurationVersion: "{spec.randomization_version}"|'
        rf'RANDOMIZATION_VERSION = "{spec.randomization_version}"',
        randomization_text,
    )


def test_stroop_key_mapping_matches_frontend() -> None:
    text = source("stroop/stroopSchedule.ts")
    for color, key in STROOP_KEY_FOR_INK.items():
        assert f'{color}: "{key}"' in text


def test_flanker_key_mapping_and_symbols_match_frontend() -> None:
    text = source("flanker/flanker.ts")
    assert 'direction === "left" ? "f" : "j"' in text
    assert FLANKER_KEY_FOR_DIRECTION == {"left": "f", "right": "j"}
    for name, symbol in FLANKER_SYMBOL.items():
        assert f'{name}: "{symbol}"' in text


def test_invalid_reasons_match_the_engine_contract() -> None:
    from app.models import INVALID_REASONS

    contracts = (FRONTEND.parent / "engine" / "contracts.ts").read_text(encoding="utf-8")
    block = contracts.split('category: "invalid";')[1].split("};")[0]
    assert set(re.findall(r'"([a-z_]+)"', block)) == set(INVALID_REASONS)


@pytest.mark.parametrize(
    ("raw", "condition", "key"),
    [
        ({"word": "RED", "ink_color": "red"}, "congruent", "d"),
        ({"word": "BLUE", "ink_color": "yellow"}, "incongruent", "k"),
        ({"word": "CHAIR", "ink_color": "green"}, "neutral", "j"),
    ],
)
def test_stroop_condition_and_key_rules(raw: dict[str, str], condition: str, key: str) -> None:
    spec = PROTOCOLS["stroop"]
    stimulus, problems = spec.parse_stimulus(raw)
    assert stimulus is not None and problems == []
    assert spec.condition_of(stimulus) == condition
    assert spec.correct_key_of(stimulus) == key


@pytest.mark.parametrize(
    ("target", "flankers", "symbols", "condition", "key"),
    [
        ("left", "left", "←←←←←", "congruent", "f"),
        ("right", "left", "←←→←←", "incongruent", "j"),
        ("left", "neutral", "——←——", "neutral", "f"),
    ],
)
def test_flanker_condition_and_key_rules(
    target: str, flankers: str, symbols: str, condition: str, key: str
) -> None:
    spec = PROTOCOLS["flanker"]
    raw = {"target_direction": target, "flanker_type": flankers, "symbols": symbols}
    stimulus, problems = spec.parse_stimulus(raw)
    assert stimulus is not None and problems == []
    assert spec.condition_of(stimulus) == condition
    assert spec.correct_key_of(stimulus) == key


def test_presentation_constants_are_not_accepted_in_stimuli() -> None:
    spec = PROTOCOLS["stroop"]
    stimulus, problems = spec.parse_stimulus({"word": "RED", "ink_color": "red", "fontSizePx": 48})
    assert stimulus is None
    assert problems
