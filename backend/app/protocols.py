"""Approved protocol facts the server needs to validate stored sessions.

The browser remains the authority for running experiments; these values are
re-stated here so the server never trusts a client blindly. Each value cites
its source. tests/test_protocols.py pins them to the approved values.

Sources:
  - docs/experiments/STROOP_PROTOCOL.md (HB-STROOP-1.0)
  - docs/experiments/FLANKER_PROTOCOL.md (HB-FLANKER-1.0)
  - frontend/src/experiments/stroop/stroop.ts, stroopSchedule.ts
  - frontend/src/experiments/flanker/flanker.ts, flankerSchedule.ts
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, ValidationError

Condition = Literal["congruent", "incongruent", "neutral"]

# --- Stroop (HB-STROOP-1.0) -------------------------------------------------

StroopColor = Literal["red", "blue", "green", "yellow"]
StroopWord = Literal["RED", "BLUE", "GREEN", "YELLOW", "BOOK", "CHAIR", "HOUSE", "TABLE", "MUSIC"]
STROOP_COLOR_WORDS = frozenset({"RED", "BLUE", "GREEN", "YELLOW"})
# stroopSchedule.ts getCorrectKey: D = red, F = blue, J = green, K = yellow.
STROOP_KEY_FOR_INK = {"red": "d", "blue": "f", "green": "j", "yellow": "k"}


class StroopStimulus(BaseModel):
    """Task-relevant Stroop attributes. Presentation constants (font, size,
    hex colors, background) are fixed by the protocol ID and not stored."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    word: StroopWord
    ink_color: StroopColor


def _stroop_condition(stimulus: BaseModel) -> Condition:
    assert isinstance(stimulus, StroopStimulus)
    if stimulus.word not in STROOP_COLOR_WORDS:
        return "neutral"
    return "congruent" if stimulus.word.lower() == stimulus.ink_color else "incongruent"


def _stroop_key(stimulus: BaseModel) -> str:
    assert isinstance(stimulus, StroopStimulus)
    return STROOP_KEY_FOR_INK[stimulus.ink_color]


# --- Flanker (HB-FLANKER-1.0) -----------------------------------------------

Direction = Literal["left", "right"]
FlankerType = Literal["left", "right", "neutral"]
# flanker.ts FLANKER_SYMBOLS: U+2190, U+2192, em dash U+2014.
FLANKER_SYMBOL = {"left": "←", "right": "→", "neutral": "—"}
# flanker.ts getFlankerCorrectKey: F = left, J = right.
FLANKER_KEY_FOR_DIRECTION = {"left": "f", "right": "j"}


class FlankerStimulus(BaseModel):
    """Task-relevant Flanker attributes; `symbols` is the five-cell array."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    target_direction: Direction
    flanker_type: FlankerType
    symbols: str


def expected_flanker_symbols(target: str, flanker_type: str) -> str:
    flanker = FLANKER_SYMBOL[flanker_type]
    return flanker * 2 + FLANKER_SYMBOL[target] + flanker * 2


def _flanker_condition(stimulus: BaseModel) -> Condition:
    assert isinstance(stimulus, FlankerStimulus)
    if stimulus.flanker_type == "neutral":
        return "neutral"
    if stimulus.flanker_type == stimulus.target_direction:
        return "congruent"
    return "incongruent"


def _flanker_key(stimulus: BaseModel) -> str:
    assert isinstance(stimulus, FlankerStimulus)
    return FLANKER_KEY_FOR_DIRECTION[stimulus.target_direction]


def _flanker_extra_checks(stimulus: BaseModel) -> list[str]:
    assert isinstance(stimulus, FlankerStimulus)
    expected = expected_flanker_symbols(stimulus.target_direction, stimulus.flanker_type)
    if stimulus.symbols != expected:
        return ["symbols do not match target_direction and flanker_type"]
    return []


# --- Registry ----------------------------------------------------------------


@dataclass(frozen=True)
class ProtocolSpec:
    experiment_id: str
    protocol_id: str
    protocol_version: str
    configuration_id: str
    configuration_version: str
    prng_id: str
    randomization_version: str
    practice_trials: int
    main_trials: int
    response_deadline_ms: float
    break_after_main_trial: int
    response_keys: frozenset[str]
    practice_condition_counts: dict[str, int]
    main_condition_counts: dict[str, int]
    stimulus_model: type[BaseModel]
    condition_of: Callable[[BaseModel], Condition]
    correct_key_of: Callable[[BaseModel], str]
    extra_stimulus_checks: Callable[[BaseModel], list[str]] = lambda _: []

    def parse_stimulus(self, raw: object) -> tuple[BaseModel | None, list[str]]:
        """Strictly validates a stimulus; returns (model, problems)."""
        try:
            stimulus = self.stimulus_model.model_validate(raw)
        except ValidationError as error:
            problems = []
            for item in error.errors(include_input=False, include_url=False):
                field = ".".join(str(part) for part in item["loc"])
                problems.append(f"{field}: {item['msg']}" if field else item["msg"])
            return None, problems
        return stimulus, self.extra_stimulus_checks(stimulus)


_BALANCED = {"congruent": 4, "incongruent": 4, "neutral": 4}
_BALANCED_MAIN = {"congruent": 20, "incongruent": 20, "neutral": 20}

PROTOCOLS: dict[str, ProtocolSpec] = {
    "stroop": ProtocolSpec(
        experiment_id="stroop",
        protocol_id="HB-STROOP-1.0",
        protocol_version="1.0",
        configuration_id="HB-STROOP-1.0",
        configuration_version="1.0",
        prng_id="HB-STROOP-shuffle-v1",
        randomization_version="1",
        practice_trials=12,
        main_trials=60,
        response_deadline_ms=2000.0,
        break_after_main_trial=30,
        response_keys=frozenset(STROOP_KEY_FOR_INK.values()),
        practice_condition_counts=_BALANCED,
        main_condition_counts=_BALANCED_MAIN,
        stimulus_model=StroopStimulus,
        condition_of=_stroop_condition,
        correct_key_of=_stroop_key,
    ),
    "flanker": ProtocolSpec(
        experiment_id="flanker",
        protocol_id="HB-FLANKER-1.0",
        protocol_version="1.0",
        configuration_id="HB-FLANKER-1.0",
        configuration_version="1.0",
        prng_id="HB-FLANKER-shuffle-v1",
        randomization_version="1",
        practice_trials=12,
        main_trials=60,
        response_deadline_ms=2000.0,
        break_after_main_trial=30,
        response_keys=frozenset(FLANKER_KEY_FOR_DIRECTION.values()),
        practice_condition_counts=_BALANCED,
        main_condition_counts=_BALANCED_MAIN,
        stimulus_model=FlankerStimulus,
        condition_of=_flanker_condition,
        correct_key_of=_flanker_key,
        extra_stimulus_checks=_flanker_extra_checks,
    ),
}

EXPERIMENT_IDS = tuple(PROTOCOLS)
