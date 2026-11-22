"""Deterministic, protocol-valid session payloads for tests.

No randomness: the schedule is a fixed balanced order and outcomes follow a
fixed pattern, so every test sees the same data.
"""

import copy
from typing import Any

from app.consent import PROVISIONAL_NOTICE_VERSION

STROOP_COLORS = ["red", "blue", "green", "yellow"]
STROOP_KEYS = {"red": "d", "blue": "f", "green": "j", "yellow": "k"}
STROOP_NEUTRAL = ["BOOK", "CHAIR", "HOUSE", "TABLE", "MUSIC"]
FLANKER_SYMBOL = {"left": "←", "right": "→", "neutral": "—"}
CONDITIONS = ["congruent", "incongruent", "neutral"]

# Fixed UUIDv4 values (not personal data; chosen for reproducibility).
CLIENT_ID_A = "0f8b8f4e-3b7a-4c55-9a6e-5d2c1b0a9f01"
CLIENT_ID_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"


def _stroop_stimulus(condition: str, n: int) -> tuple[dict[str, str], str]:
    ink = STROOP_COLORS[n % 4]
    if condition == "congruent":
        word = ink.upper()
    elif condition == "incongruent":
        word = STROOP_COLORS[(n + 1) % 4].upper()
    else:
        word = STROOP_NEUTRAL[n % 5]
    return {"word": word, "ink_color": ink}, STROOP_KEYS[ink]


def _flanker_stimulus(condition: str, n: int) -> tuple[dict[str, str], str]:
    target = "left" if n % 2 == 0 else "right"
    if condition == "neutral":
        flanker = "neutral"
    elif condition == "congruent":
        flanker = target
    else:
        flanker = "right" if target == "left" else "left"
    f, t = FLANKER_SYMBOL[flanker], FLANKER_SYMBOL[target]
    stimulus = {"target_direction": target, "flanker_type": flanker, "symbols": f + f + t + f + f}
    return stimulus, ("f" if target == "left" else "j")


def planned_order(experiment: str, count: int) -> list[dict[str, Any]]:
    make = _stroop_stimulus if experiment == "stroop" else _flanker_stimulus
    entries = []
    for i in range(count):
        condition = CONDITIONS[i % 3]
        stimulus, key = make(condition, i // 3)
        entries.append(
            {
                "trial_index": i + 1,
                "condition": condition,
                "stimulus": stimulus,
                "correct_response": key,
            }
        )
    return entries


def _other_key(experiment: str, key: str) -> str:
    keys = ["d", "f", "j", "k"] if experiment == "stroop" else ["f", "j"]
    return next(k for k in keys if k != key)


def _trial(experiment: str, phase: str, entry: dict[str, Any], clock: float) -> dict[str, Any]:
    """Outcome pattern by index: every 7th incorrect, 11th timeout, 13th invalid."""
    index = entry["trial_index"]
    fixation = clock
    onset = clock + 500.0
    deadline = onset + 2000.0
    trial: dict[str, Any] = {
        "phase": phase,
        **copy.deepcopy(entry),
        "response_key": None,
        "outcome": "timeout",
        "invalid_reason": None,
        "reaction_time_ms": None,
    }
    if index % 13 == 0:
        trial["outcome"] = "invalid"
        trial["invalid_reason"] = "visibility_lost"
        timing = [fixation, onset, None, deadline, None, None]
    elif index % 11 == 0:
        offset = deadline + 4.0
        timing = [fixation, onset, None, deadline, offset, offset + 500.0]
    else:
        rt = 400.0 + (index * 7) % 300 + 0.25
        response = onset + rt
        incorrect = index % 7 == 0
        trial["outcome"] = "incorrect" if incorrect else "correct"
        trial["response_key"] = (
            _other_key(experiment, entry["correct_response"])
            if incorrect
            else entry["correct_response"]
        )
        trial["reaction_time_ms"] = rt
        offset = response + 10.0
        timing = [fixation, onset, response, deadline, offset, offset + 500.0]
    names = [
        "fixation_onset_ms",
        "stimulus_onset_ms",
        "response_timestamp_ms",
        "deadline_ms",
        "stimulus_offset_ms",
        "iti_end_ms",
    ]
    trial["timing"] = dict(zip(names, timing, strict=True))
    return trial


def session_payload(
    experiment: str = "stroop",
    *,
    status: str = "complete",
    practice_recorded: int = 12,
    main_recorded: int = 60,
    client_session_id: str = CLIENT_ID_A,
) -> dict[str, Any]:
    practice_order = planned_order(experiment, 12)
    main_order = planned_order(experiment, 60)
    trials = []
    clock = 1000.0
    for entry in practice_order[:practice_recorded]:
        trials.append(_trial(experiment, "practice", entry, clock))
        clock += 3000.0
    for entry in main_order[:main_recorded]:
        trials.append(_trial(experiment, "main", entry, clock))
        clock += 3000.0

    upper = experiment.upper()
    allocation: dict[str, Any] = (
        {"selectedDerangement": [1, 0, 3, 2], "practiceSeedUnsigned32": 2654435769}
        if experiment == "stroop"
        else {"practiceSeedUnsigned32": 2654435769, "baseItemOrder": ["congruent-left"]}
    )
    break_taken = main_recorded >= 30
    return {
        "data_schema_version": 1,
        "client_session_id": client_session_id,
        "consent": {"confirmed": True, "notice_version": PROVISIONAL_NOTICE_VERSION},
        "experiment_id": experiment,
        "protocol_id": f"HB-{upper}-1.0",
        "protocol_version": "1.0",
        "configuration_id": f"HB-{upper}-1.0",
        "configuration_version": "1.0",
        "status": status,
        "break_taken": break_taken,
        "break_duration_ms": 15000.5 if break_taken else None,
        "randomization": {
            "seed": 123456789,
            "prng_id": f"HB-{upper}-shuffle-v1",
            "randomization_version": "1",
            "schedule_generation_status": "generated",
            "allocation_details": allocation,
            "practice_order": practice_order,
            "main_order": main_order,
        },
        "trials": trials,
    }


def technical_error_payload(experiment: str = "flanker") -> dict[str, Any]:
    """A session whose schedule could not be generated: no seed, no trials."""
    payload = session_payload(experiment, client_session_id=CLIENT_ID_B)
    payload.update(status="technical_error", break_taken=False, break_duration_ms=None, trials=[])
    payload["randomization"] = {
        "seed": None,
        "prng_id": None,
        "randomization_version": None,
        "schedule_generation_status": "failed",
        "allocation_details": None,
        "practice_order": [],
        "main_order": [],
    }
    return payload
