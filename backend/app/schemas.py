"""Request and response models (validation layer 1: shape).

Every request object uses `extra="forbid"` so an unexpected field (for
example an email address) is rejected rather than silently dropped, and
`strict=True` so values are never coerced ("12" is not 12, 1 is not true).
Numbers must be finite. Cross-field and protocol rules live in validation.py.
"""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

DATA_SCHEMA_VERSION = 1

# performance.now() values are milliseconds since page load. 10^9 ms is about
# 11.6 days, far beyond any real session, and rejects absurd values.
MAX_TIMESTAMP_MS = 1_000_000_000.0
MAX_TRIALS = 500
MAX_SCHEDULE_ENTRIES = 200

ExperimentIdValue = Literal["stroop", "flanker"]
SessionStatus = Literal["complete", "incomplete", "interrupted", "technical_error"]
ScheduleStatus = Literal["not_started", "generated", "failed"]
Phase = Literal["practice", "main"]
ConditionValue = Literal["congruent", "incongruent", "neutral"]
Outcome = Literal["correct", "incorrect", "timeout", "invalid"]
# engine/contracts.ts TrialOutcome "invalid" reasons.
InvalidReason = Literal[
    "focus_lost",
    "visibility_lost",
    "presentation_failed",
    "input_failed",
    "timing_error",
    "deadline_unavailable",
    "interrupt",
    "protocol_error",
]

Identifier = Annotated[
    str, StringConstraints(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
]
ResponseKey = Annotated[str, StringConstraints(min_length=1, max_length=16, pattern=r"^[a-z]$")]
TimestampMs = Annotated[float, Field(ge=0, le=MAX_TIMESTAMP_MS, allow_inf_nan=False)]
DurationMs = Annotated[float, Field(ge=0, le=MAX_TIMESTAMP_MS, allow_inf_nan=False)]
TrialIndex = Annotated[int, Field(ge=1, le=MAX_SCHEDULE_ENTRIES)]
# Allocation-detail values: small integers, short strings, or short lists of them.
AllocationScalar = (
    Annotated[int, Field(ge=0, le=4_294_967_295)] | Annotated[str, StringConstraints(max_length=64)]
)
AllocationValue = AllocationScalar | Annotated[list[AllocationScalar], Field(max_length=64)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)


class ConsentIn(StrictModel):
    confirmed: bool
    notice_version: Identifier


class PlannedTrialIn(StrictModel):
    trial_index: TrialIndex
    condition: ConditionValue
    stimulus: dict[str, Any]
    correct_response: ResponseKey


class RandomizationIn(StrictModel):
    seed: Annotated[int, Field(ge=0, le=4_294_967_295)] | None
    prng_id: Identifier | None
    randomization_version: Identifier | None
    schedule_generation_status: ScheduleStatus
    allocation_details: (
        Annotated[dict[Identifier, AllocationValue], Field(max_length=16)] | None
    ) = None
    practice_order: Annotated[list[PlannedTrialIn], Field(max_length=MAX_SCHEDULE_ENTRIES)]
    main_order: Annotated[list[PlannedTrialIn], Field(max_length=MAX_SCHEDULE_ENTRIES)]


class TimingIn(StrictModel):
    fixation_onset_ms: TimestampMs | None
    stimulus_onset_ms: TimestampMs | None
    response_timestamp_ms: TimestampMs | None
    deadline_ms: TimestampMs | None
    stimulus_offset_ms: TimestampMs | None
    iti_end_ms: TimestampMs | None


class TrialIn(StrictModel):
    phase: Phase
    trial_index: TrialIndex
    condition: ConditionValue
    stimulus: dict[str, Any]
    correct_response: ResponseKey
    response_key: ResponseKey | None
    outcome: Outcome
    invalid_reason: InvalidReason | None
    reaction_time_ms: DurationMs | None
    timing: TimingIn


class SessionCreate(StrictModel):
    """POST /api/v1/sessions body. See docs/backend/API.md."""

    data_schema_version: Literal[1]
    # strict=False only here: JSON carries UUIDs as strings, and FastAPI
    # validates the parsed body in Python mode. The format is still checked.
    client_session_id: Annotated[UUID, Field(strict=False)]
    consent: ConsentIn
    experiment_id: ExperimentIdValue
    protocol_id: Identifier
    protocol_version: Identifier
    configuration_id: Identifier
    configuration_version: Identifier
    status: SessionStatus
    break_taken: bool
    break_duration_ms: DurationMs | None
    randomization: RandomizationIn
    trials: Annotated[list[TrialIn], Field(max_length=MAX_TRIALS)]

    @field_validator("client_session_id")
    @classmethod
    def _random_uuid(cls, value: UUID) -> UUID:
        # Must be a random (version 4) UUID such as crypto.randomUUID() makes.
        if value.version != 4:
            raise ValueError("client_session_id must be a version 4 (random) UUID")
        return value


# --- Responses ---------------------------------------------------------------


class TrialCounts(BaseModel):
    practice: int
    main: int


class SessionCreated(BaseModel):
    session_id: UUID
    experiment_id: str
    status: str
    created_at: datetime
    trials_stored: TrialCounts


class TimingOut(BaseModel):
    fixation_onset_ms: float | None
    stimulus_onset_ms: float | None
    response_timestamp_ms: float | None
    deadline_ms: float | None
    stimulus_offset_ms: float | None
    iti_end_ms: float | None


class TrialOut(BaseModel):
    phase: str
    trial_index: int
    condition: str
    stimulus: dict[str, Any]
    correct_response: str
    response_key: str | None
    outcome: str
    invalid_reason: str | None
    reaction_time_ms: float | None
    timing: TimingOut


class RandomizationOut(BaseModel):
    seed: int | None
    prng_id: str | None
    randomization_version: str | None
    schedule_generation_status: str
    allocation_details: dict[str, Any] | None
    practice_order: list[dict[str, Any]]
    main_order: list[dict[str, Any]]


class SessionDetail(BaseModel):
    session_id: UUID
    data_schema_version: int
    experiment_id: str
    protocol_id: str
    protocol_version: str
    configuration_id: str
    configuration_version: str
    status: str
    consent_notice_version: str
    break_taken: bool
    break_duration_ms: float | None
    created_at: datetime
    randomization: RandomizationOut
    trials: list[TrialOut]


class HealthOut(BaseModel):
    status: Literal["ok", "unavailable"]
    api_version: Literal["v1"]
    database: Literal["ok", "unreachable", "schema_not_current"]
