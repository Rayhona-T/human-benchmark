"""Validation layer 2: protocol and cross-field consistency rules.

Pure functions: given a shape-valid SessionCreate, return every problem
found (location + message). An empty list means the session may be stored.
Rules are documented in docs/backend/BACKEND_ARCHITECTURE.md §6. Messages
never contain submitted values.
"""

import json
from collections import Counter
from dataclasses import dataclass

from pydantic import BaseModel

from .consent import is_accepted_notice
from .protocols import PROTOCOLS, ProtocolSpec
from .schemas import PlannedTrialIn, SessionCreate, TrialIn

# Tolerance for comparing derived times, e.g. RT = response - onset.
# Generous enough for a client that rounds to 0.001 ms (as the CSV export does).
TIME_TOLERANCE_MS = 0.001
MAX_ALLOCATION_JSON_CHARS = 2048
RESPONDED = ("correct", "incorrect")


@dataclass(frozen=True)
class Issue:
    location: str
    message: str


class _Collector:
    def __init__(self) -> None:
        self.issues: list[Issue] = []

    def add(self, location: str, message: str) -> None:
        self.issues.append(Issue(location, message))


def validate_session(payload: SessionCreate) -> list[Issue]:
    found = _Collector()
    spec = PROTOCOLS[payload.experiment_id]

    if not payload.consent.confirmed:
        found.add("consent.confirmed", "must be true; a session is stored only with consent")
    if not is_accepted_notice(payload.consent.notice_version):
        found.add(
            "consent.notice_version",
            "is not a recognized consent notice version (see app/consent.py)",
        )

    _check_identity(payload, spec, found)
    planned = _check_schedule(payload, spec, found)
    _check_trials(payload, spec, planned, found)
    _check_session_shape(payload, spec, found)
    return found.issues


def _check_identity(payload: SessionCreate, spec: ProtocolSpec, found: _Collector) -> None:
    expected = {
        "protocol_id": spec.protocol_id,
        "protocol_version": spec.protocol_version,
        "configuration_id": spec.configuration_id,
        "configuration_version": spec.configuration_version,
    }
    for field, value in expected.items():
        if getattr(payload, field) != value:
            found.add(field, f"is not an approved value for experiment '{spec.experiment_id}'")


def _stimulus_matches(
    spec: ProtocolSpec,
    raw_stimulus: dict[str, object],
    condition: str,
    correct_response: str,
    location: str,
    found: _Collector,
) -> BaseModel | None:
    stimulus, problems = spec.parse_stimulus(raw_stimulus)
    for problem in problems:
        found.add(f"{location}.stimulus", problem)
    if stimulus is None or problems:
        return None
    if spec.condition_of(stimulus) != condition:
        found.add(f"{location}.condition", "does not match the stimulus")
    if spec.correct_key_of(stimulus) != correct_response:
        found.add(f"{location}.correct_response", "does not match the stimulus")
    return stimulus


def _check_schedule(
    payload: SessionCreate, spec: ProtocolSpec, found: _Collector
) -> dict[tuple[str, int], PlannedTrialIn]:
    """Validates the realized schedule; returns planned entries by (phase, index)."""
    randomization = payload.randomization
    planned: dict[tuple[str, int], PlannedTrialIn] = {}

    if randomization.schedule_generation_status != "generated":
        if randomization.practice_order or randomization.main_order:
            found.add("randomization", "a schedule that was not generated cannot have entries")
        return planned

    if randomization.seed is None:
        found.add("randomization.seed", "is required when the schedule was generated")
    if randomization.prng_id != spec.prng_id:
        found.add("randomization.prng_id", "is not the approved PRNG for this experiment")
    if randomization.randomization_version != spec.randomization_version:
        found.add("randomization.randomization_version", "is not the approved version")
    details = randomization.allocation_details
    if details is not None and len(json.dumps(details)) > MAX_ALLOCATION_JSON_CHARS:
        found.add("randomization.allocation_details", "is too large")

    phases = (
        (
            "practice",
            randomization.practice_order,
            spec.practice_trials,
            spec.practice_condition_counts,
        ),
        ("main", randomization.main_order, spec.main_trials, spec.main_condition_counts),
    )
    for phase, entries, expected_count, expected_conditions in phases:
        location = f"randomization.{phase}_order"
        if len(entries) != expected_count:
            found.add(location, f"must contain exactly {expected_count} planned trials")
        for position, entry in enumerate(entries):
            entry_location = f"{location}[{position}]"
            if entry.trial_index != position + 1:
                found.add(
                    f"{entry_location}.trial_index", "planned trials must be numbered 1..N in order"
                )
            _stimulus_matches(
                spec, entry.stimulus, entry.condition, entry.correct_response, entry_location, found
            )
            planned[(phase, entry.trial_index)] = entry
        counts = Counter(entry.condition for entry in entries)
        if len(entries) == expected_count and dict(counts) != expected_conditions:
            found.add(location, "condition counts do not match the protocol's balanced design")
    return planned


def _check_trials(
    payload: SessionCreate,
    spec: ProtocolSpec,
    planned: dict[tuple[str, int], PlannedTrialIn],
    found: _Collector,
) -> None:
    generated = payload.randomization.schedule_generation_status == "generated"
    if payload.trials and not generated:
        found.add("trials", "trials cannot exist without a generated schedule")

    seen: set[tuple[str, int]] = set()
    for position, trial in enumerate(payload.trials):
        location = f"trials[{position}]"
        key = (trial.phase, trial.trial_index)
        if key in seen:
            found.add(f"{location}.trial_index", "duplicate trial index within this phase")
        seen.add(key)

        if generated:
            entry = planned.get(key)
            if entry is None:
                found.add(f"{location}.trial_index", "is not in the realized schedule")
            elif (
                entry.condition != trial.condition
                or entry.stimulus != trial.stimulus
                or entry.correct_response != trial.correct_response
            ):
                found.add(location, "does not match its planned trial in the realized schedule")
        _stimulus_matches(
            spec, trial.stimulus, trial.condition, trial.correct_response, location, found
        )
        _check_outcome(trial, spec, location, found)
        _check_timing(trial, spec, location, found)


def _check_outcome(trial: TrialIn, spec: ProtocolSpec, location: str, found: _Collector) -> None:
    if trial.response_key is not None and trial.response_key not in spec.response_keys:
        found.add(f"{location}.response_key", "is not a mapped response key for this experiment")

    if trial.outcome in RESPONDED:
        if trial.response_key is None:
            found.add(f"{location}.response_key", "is required for a correct or incorrect trial")
        if trial.reaction_time_ms is None:
            found.add(
                f"{location}.reaction_time_ms", "is required for a correct or incorrect trial"
            )
        if trial.timing.response_timestamp_ms is None:
            found.add(f"{location}.timing.response_timestamp_ms", "is required for a response")
    else:
        if trial.response_key is not None:
            found.add(f"{location}.response_key", f"must be null for a {trial.outcome} trial")
        if trial.reaction_time_ms is not None:
            found.add(f"{location}.reaction_time_ms", f"must be null for a {trial.outcome} trial")
        if trial.timing.response_timestamp_ms is not None:
            found.add(
                f"{location}.timing.response_timestamp_ms",
                f"must be null for a {trial.outcome} trial",
            )

    if trial.response_key is not None:
        if trial.outcome == "correct" and trial.response_key != trial.correct_response:
            found.add(f"{location}.outcome", "is correct but the response key does not match")
        if trial.outcome == "incorrect" and trial.response_key == trial.correct_response:
            found.add(f"{location}.outcome", "is incorrect but the response key matches")

    if (trial.outcome == "invalid") != (trial.invalid_reason is not None):
        found.add(f"{location}.invalid_reason", "is required for invalid trials and only for them")


def _check_timing(trial: TrialIn, spec: ProtocolSpec, location: str, found: _Collector) -> None:
    timing = trial.timing
    loc = f"{location}.timing"
    deadline_window = spec.response_deadline_ms

    if trial.reaction_time_ms is not None and trial.reaction_time_ms >= deadline_window:
        found.add(
            f"{location}.reaction_time_ms",
            f"must be below the {deadline_window:g} ms response deadline",
        )

    onset = timing.stimulus_onset_ms
    if trial.outcome in (*RESPONDED, "timeout") and onset is None:
        found.add(f"{loc}.stimulus_onset_ms", f"is required for a {trial.outcome} trial")
    if trial.outcome in (*RESPONDED, "timeout") and timing.deadline_ms is None:
        found.add(f"{loc}.deadline_ms", f"is required for a {trial.outcome} trial")

    if onset is not None:
        if timing.fixation_onset_ms is not None and timing.fixation_onset_ms > onset:
            found.add(f"{loc}.fixation_onset_ms", "must not be after stimulus onset")
        if (
            timing.deadline_ms is not None
            and abs(timing.deadline_ms - onset - deadline_window) > TIME_TOLERANCE_MS
        ):
            found.add(f"{loc}.deadline_ms", "must equal stimulus onset plus the response deadline")
        response = timing.response_timestamp_ms
        if response is not None:
            if response < onset:
                found.add(f"{loc}.response_timestamp_ms", "must not be before stimulus onset")
            if timing.deadline_ms is not None and response >= timing.deadline_ms:
                found.add(f"{loc}.response_timestamp_ms", "must be before the deadline")
            if (
                trial.reaction_time_ms is not None
                and abs(trial.reaction_time_ms - (response - onset)) > TIME_TOLERANCE_MS
            ):
                found.add(
                    f"{location}.reaction_time_ms",
                    "must equal response timestamp minus stimulus onset",
                )
        if timing.stimulus_offset_ms is not None and timing.stimulus_offset_ms < onset:
            found.add(f"{loc}.stimulus_offset_ms", "must not be before stimulus onset")
    elif timing.response_timestamp_ms is not None or timing.stimulus_offset_ms is not None:
        found.add(f"{loc}.stimulus_onset_ms", "is required when later timestamps are present")

    if timing.iti_end_ms is not None:
        if timing.stimulus_offset_ms is None:
            found.add(f"{loc}.iti_end_ms", "requires a stimulus offset")
        elif timing.iti_end_ms < timing.stimulus_offset_ms:
            found.add(f"{loc}.iti_end_ms", "must not be before stimulus offset")


def _check_session_shape(payload: SessionCreate, spec: ProtocolSpec, found: _Collector) -> None:
    indices: dict[str, set[int]] = {"practice": set(), "main": set()}
    for trial in payload.trials:
        indices[trial.phase].add(trial.trial_index)
    planned_counts = {"practice": spec.practice_trials, "main": spec.main_trials}

    for phase, recorded in indices.items():
        if recorded and recorded != set(range(1, max(recorded) + 1)):
            found.add("trials", f"{phase} trials must be numbered 1..k without gaps")
        if len(recorded) > planned_counts[phase]:
            found.add("trials", f"more {phase} trials than the protocol plans")

    practice_done = len(indices["practice"]) == spec.practice_trials
    main_count = len(indices["main"])
    if main_count and not practice_done:
        found.add("trials", "main trials require a complete practice phase")
    if payload.status == "complete" and not (practice_done and main_count == spec.main_trials):
        found.add(
            "status",
            f"complete requires {spec.practice_trials} practice and {spec.main_trials} main trials",
        )

    if payload.break_taken and payload.break_duration_ms is None:
        found.add("break_duration_ms", "is required when the break was taken")
    if payload.break_duration_ms is not None and main_count < spec.break_after_main_trial:
        found.add(
            "break_duration_ms",
            f"a break is only offered after main trial {spec.break_after_main_trial}",
        )
