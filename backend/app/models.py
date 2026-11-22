"""Database tables (validation layer 3: constraints the database enforces).

These constraints are the last line of defense if code ever bypasses the API.
Only portable types and constraints are used so the same schema works on
SQLite (development and tests) and PostgreSQL (later deployment).
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    TypeDecorator,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Deterministic constraint names so migrations are reviewable and portable.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def _in(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({quoted})"


EXPERIMENTS = ("stroop", "flanker")
SESSION_STATUSES = ("complete", "incomplete", "interrupted", "technical_error")
SCHEDULE_STATUSES = ("not_started", "generated", "failed")
PHASES = ("practice", "main")
CONDITIONS = ("congruent", "incongruent", "neutral")
OUTCOMES = ("correct", "incorrect", "timeout", "invalid")
INVALID_REASONS = (
    "focus_lost",
    "visibility_lost",
    "presentation_failed",
    "input_failed",
    "timing_error",
    "deadline_unavailable",
    "interrupt",
    "protocol_error",
)
TIMING_COLUMNS = (
    "fixation_onset_ms",
    "stimulus_onset_ms",
    "response_timestamp_ms",
    "deadline_ms",
    "stimulus_offset_ms",
    "iti_end_ms",
)


class UTCDateTime(TypeDecorator[datetime]):
    """Stores UTC; always returns timezone-aware UTC (SQLite drops tzinfo)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("naive datetimes are not allowed; use UTC")
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


# none_as_null: Python None becomes SQL NULL (so NOT NULL applies), never the
# JSON value null, which would otherwise slip past NOT NULL constraints.
JSONValue = JSON(none_as_null=True)


def utc_now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class Participant(Base):
    """Reserved for a future pseudonymous identifier (Cycle 8 Task 3 decision).

    No endpoint creates participants yet; every stored session is unlinked.
    Holds no personal data by design.
    """

    __tablename__ = "participants"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now, nullable=False)

    sessions: Mapped[list["ExperimentSession"]] = relationship(
        back_populates="participant", cascade="all, delete-orphan", passive_deletes=True
    )


class ExperimentSession(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        CheckConstraint(_in("experiment_id", EXPERIMENTS), name="experiment_id"),
        CheckConstraint(_in("status", SESSION_STATUSES), name="status"),
        CheckConstraint(
            _in("schedule_generation_status", SCHEDULE_STATUSES), name="schedule_generation_status"
        ),
        CheckConstraint("data_schema_version >= 1", name="data_schema_version"),
        CheckConstraint("seed IS NULL OR (seed >= 0 AND seed <= 4294967295)", name="seed_range"),
        CheckConstraint(
            "schedule_generation_status <> 'generated'"
            " OR (seed IS NOT NULL AND prng_id IS NOT NULL)",
            name="generated_has_seed",
        ),
        CheckConstraint(
            "break_duration_ms IS NULL OR break_duration_ms >= 0", name="break_duration_nonnegative"
        ),
        CheckConstraint(
            "NOT break_taken OR break_duration_ms IS NOT NULL", name="break_taken_has_duration"
        ),
        Index("ix_sessions_participant_created", "participant_id", "created_at"),
        Index("ix_sessions_experiment_created", "experiment_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_session_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, unique=True)
    participant_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("participants.id", ondelete="CASCADE"), nullable=True
    )
    data_schema_version: Mapped[int] = mapped_column(Integer, nullable=False)
    experiment_id: Mapped[str] = mapped_column(String(32), nullable=False)
    protocol_id: Mapped[str] = mapped_column(String(64), nullable=False)
    protocol_version: Mapped[str] = mapped_column(String(64), nullable=False)
    configuration_id: Mapped[str] = mapped_column(String(64), nullable=False)
    configuration_version: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    consent_notice_version: Mapped[str] = mapped_column(String(64), nullable=False)
    seed: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    prng_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    randomization_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    schedule_generation_status: Mapped[str] = mapped_column(String(16), nullable=False)
    allocation_details: Mapped[dict[str, Any] | None] = mapped_column(JSONValue, nullable=True)
    realized_schedule: Mapped[dict[str, Any]] = mapped_column(JSONValue, nullable=False)
    break_taken: Mapped[bool] = mapped_column(Boolean, nullable=False)
    break_duration_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now, nullable=False)

    participant: Mapped[Participant | None] = relationship(back_populates="sessions")
    trials: Mapped[list["Trial"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        # Practice before main ("practice" > "main" alphabetically), then index.
        order_by=lambda: (Trial.phase.desc(), Trial.trial_index),
    )


class Trial(Base):
    __tablename__ = "trials"
    __table_args__ = (
        UniqueConstraint(
            "session_id", "phase", "trial_index", name="uq_trials_session_phase_index"
        ),
        CheckConstraint(_in("phase", PHASES), name="phase"),
        CheckConstraint("trial_index >= 1", name="trial_index_positive"),
        CheckConstraint(_in("condition", CONDITIONS), name="condition"),
        CheckConstraint(_in("outcome", OUTCOMES), name="outcome"),
        CheckConstraint(
            f"invalid_reason IS NULL OR {_in('invalid_reason', INVALID_REASONS)}",
            name="invalid_reason_value",
        ),
        CheckConstraint(
            "(outcome = 'invalid' AND invalid_reason IS NOT NULL)"
            " OR (outcome <> 'invalid' AND invalid_reason IS NULL)",
            name="invalid_reason_iff_invalid",
        ),
        CheckConstraint(
            "(outcome IN ('correct', 'incorrect')"
            " AND response_key IS NOT NULL AND reaction_time_ms IS NOT NULL)"
            " OR (outcome IN ('timeout', 'invalid')"
            " AND response_key IS NULL AND reaction_time_ms IS NULL)",
            name="response_matches_outcome",
        ),
        CheckConstraint(
            "outcome <> 'correct' OR response_key = correct_response", name="correct_key_matches"
        ),
        CheckConstraint(
            "outcome <> 'incorrect' OR response_key <> correct_response",
            name="incorrect_key_differs",
        ),
        CheckConstraint(
            "reaction_time_ms IS NULL OR reaction_time_ms >= 0", name="reaction_time_nonnegative"
        ),
        *(
            CheckConstraint(f"{column} IS NULL OR {column} >= 0", name=f"{column}_nonnegative")
            for column in TIMING_COLUMNS
        ),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    phase: Mapped[str] = mapped_column(String(16), nullable=False)
    trial_index: Mapped[int] = mapped_column(Integer, nullable=False)
    condition: Mapped[str] = mapped_column(String(16), nullable=False)
    stimulus: Mapped[dict[str, Any]] = mapped_column(JSONValue, nullable=False)
    correct_response: Mapped[str] = mapped_column(String(16), nullable=False)
    response_key: Mapped[str | None] = mapped_column(String(16), nullable=True)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    invalid_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reaction_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    fixation_onset_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    stimulus_onset_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    response_timestamp_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    deadline_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    stimulus_offset_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    iti_end_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    session: Mapped[ExperimentSession] = relationship(back_populates="trials")
