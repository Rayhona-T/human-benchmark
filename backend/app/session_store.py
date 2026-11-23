"""Transactional persistence for sessions and their trials.

Callers pass payloads that already passed validation layers 1 and 2. Each
operation is one transaction: a session and all of its trials are stored
together or not at all.

Every read and delete of stored sessions takes an `OwnerScope` (app/scope.py)
and filters by it, so no query can reach sessions outside the caller's scope.
"""

import base64
import binascii
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .models import ExperimentSession, Trial
from .protocols import PROTOCOLS
from .schemas import PlannedTrialIn, SessionCreate, TrialIn
from .scope import OwnerScope


class DuplicateSessionError(Exception):
    """The client_session_id has already been stored."""


def _canonical_stimulus(experiment_id: str, raw: dict[str, Any]) -> dict[str, Any]:
    # Re-serialize through the strict experiment model so only known,
    # validated attributes are stored, in a stable form.
    return PROTOCOLS[experiment_id].stimulus_model.model_validate(raw).model_dump()


def _planned(experiment_id: str, entry: PlannedTrialIn) -> dict[str, Any]:
    return {
        "trial_index": entry.trial_index,
        "condition": entry.condition,
        "stimulus": _canonical_stimulus(experiment_id, entry.stimulus),
        "correct_response": entry.correct_response,
    }


def _trial_row(experiment_id: str, trial: TrialIn) -> Trial:
    return Trial(
        phase=trial.phase,
        trial_index=trial.trial_index,
        condition=trial.condition,
        stimulus=_canonical_stimulus(experiment_id, trial.stimulus),
        correct_response=trial.correct_response,
        response_key=trial.response_key,
        outcome=trial.outcome,
        invalid_reason=trial.invalid_reason,
        reaction_time_ms=trial.reaction_time_ms,
        **trial.timing.model_dump(),
    )


def create_session(db: Session, payload: SessionCreate) -> ExperimentSession:
    randomization = payload.randomization
    experiment_id = payload.experiment_id
    session = ExperimentSession(
        id=uuid.uuid4(),
        client_session_id=payload.client_session_id,
        participant_id=None,  # Anonymous by default (DATA_AND_PRIVACY.md D2).
        data_schema_version=payload.data_schema_version,
        experiment_id=experiment_id,
        protocol_id=payload.protocol_id,
        protocol_version=payload.protocol_version,
        configuration_id=payload.configuration_id,
        configuration_version=payload.configuration_version,
        status=payload.status,
        consent_notice_version=payload.consent.notice_version,
        seed=randomization.seed,
        prng_id=randomization.prng_id,
        randomization_version=randomization.randomization_version,
        schedule_generation_status=randomization.schedule_generation_status,
        allocation_details=randomization.allocation_details,
        realized_schedule={
            "practice": [_planned(experiment_id, e) for e in randomization.practice_order],
            "main": [_planned(experiment_id, e) for e in randomization.main_order],
        },
        break_taken=payload.break_taken,
        break_duration_ms=payload.break_duration_ms,
        trials=[_trial_row(experiment_id, trial) for trial in payload.trials],
    )
    db.add(session)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if _client_session_exists(db, payload.client_session_id):
            raise DuplicateSessionError from None
        raise
    return session


def _client_session_exists(db: Session, client_session_id: uuid.UUID) -> bool:
    found = db.scalar(
        select(ExperimentSession.id).where(ExperimentSession.client_session_id == client_session_id)
    )
    return found is not None


def get_session(db: Session, session_id: uuid.UUID, scope: OwnerScope) -> ExperimentSession | None:
    return db.scalar(
        select(ExperimentSession)
        .where(ExperimentSession.id == session_id, *scope.session_conditions())
        .options(selectinload(ExperimentSession.trials))
    )


def delete_session(db: Session, session_id: uuid.UUID, scope: OwnerScope) -> bool:
    """Hard-deletes a session; the database cascade removes its trials."""
    session = db.scalar(
        select(ExperimentSession).where(
            ExperimentSession.id == session_id, *scope.session_conditions()
        )
    )
    if session is None:
        return False
    db.delete(session)
    db.commit()
    return True


@dataclass(frozen=True)
class DeletedCounts:
    sessions: int
    trials: int


def delete_all_sessions(db: Session, scope: OwnerScope) -> DeletedCounts:
    """Hard-deletes every session in scope, in one transaction.

    Trials go through the database cascade (ON DELETE CASCADE), the same
    mechanism delete_session relies on. Participant rows are left alone:
    none are created today, and they hold no session data.
    """
    conditions = scope.session_conditions()
    in_scope = select(ExperimentSession.id).where(*conditions)
    trials = db.scalar(
        select(func.count()).select_from(Trial).where(Trial.session_id.in_(in_scope))
    )
    sessions = db.scalar(select(func.count()).select_from(ExperimentSession).where(*conditions))
    db.execute(
        delete(ExperimentSession).where(*conditions),
        execution_options={"synchronize_session": False},
    )
    db.commit()
    db.expunge_all()
    return DeletedCounts(sessions=int(sessions or 0), trials=int(trials or 0))


# --- Listing: summaries only, newest first, keyset pagination ----------------

# The cursor is opaque to clients. It encodes the last row's sort key,
# (created_at, id). It is not signed: a crafted cursor can only select a
# different page inside the same scope, never widen the scope.
_CURSOR_VERSION = "1"
_CURSOR_TEXT = re.compile(r"[A-Za-z0-9_-]{1,128}")
_HEX_ID = re.compile(r"[0-9a-f]{32}")


class InvalidCursorError(Exception):
    """The cursor was not produced by this API."""


@dataclass(frozen=True)
class Cursor:
    created_at: datetime
    session_id: uuid.UUID


def encode_cursor(cursor: Cursor) -> str:
    created_at = cursor.created_at.astimezone(UTC).isoformat()
    text = f"{_CURSOR_VERSION}|{created_at}|{cursor.session_id.hex}"
    return base64.urlsafe_b64encode(text.encode("ascii")).decode("ascii").rstrip("=")


def decode_cursor(value: str) -> Cursor:
    if not _CURSOR_TEXT.fullmatch(value):
        raise InvalidCursorError
    try:
        raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        text = raw.decode("ascii")
    except (binascii.Error, UnicodeDecodeError, ValueError):
        raise InvalidCursorError from None
    parts = text.split("|")
    if len(parts) != 3 or parts[0] != _CURSOR_VERSION or not _HEX_ID.fullmatch(parts[2]):
        raise InvalidCursorError
    try:
        created_at = datetime.fromisoformat(parts[1])
    except ValueError:
        raise InvalidCursorError from None
    if created_at.utcoffset() != timedelta(0):
        raise InvalidCursorError  # naive or not UTC: never produced by encode_cursor
    return Cursor(created_at=created_at, session_id=uuid.UUID(hex=parts[2]))


@dataclass(frozen=True)
class SessionSummaryRow:
    session_id: uuid.UUID
    data_schema_version: int
    experiment_id: str
    protocol_id: str
    protocol_version: str
    configuration_id: str
    configuration_version: str
    status: str
    consent_notice_version: str
    created_at: datetime
    practice_trials: int
    main_trials: int


@dataclass(frozen=True)
class SessionPageRows:
    sessions: list[SessionSummaryRow]
    next_cursor: Cursor | None


def list_sessions(
    db: Session,
    scope: OwnerScope,
    *,
    limit: int,
    experiment_id: str | None = None,
    after: Cursor | None = None,
) -> SessionPageRows:
    """Newest first by server save time. Ties are broken by session ID, so
    the order is total and pages never repeat or skip a session."""
    conditions = list(scope.session_conditions())
    if experiment_id is not None:
        conditions.append(ExperimentSession.experiment_id == experiment_id)
    if after is not None:
        conditions.append(
            or_(
                ExperimentSession.created_at < after.created_at,
                and_(
                    ExperimentSession.created_at == after.created_at,
                    ExperimentSession.id < after.session_id,
                ),
            )
        )
    # Only summary columns are read: no trials, schedule, seed, allocation
    # details, client_session_id or participant_id.
    rows = db.execute(
        select(
            ExperimentSession.id,
            ExperimentSession.data_schema_version,
            ExperimentSession.experiment_id,
            ExperimentSession.protocol_id,
            ExperimentSession.protocol_version,
            ExperimentSession.configuration_id,
            ExperimentSession.configuration_version,
            ExperimentSession.status,
            ExperimentSession.consent_notice_version,
            ExperimentSession.created_at,
        )
        .where(*conditions)
        .order_by(ExperimentSession.created_at.desc(), ExperimentSession.id.desc())
        .limit(limit + 1)
    ).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    counts: dict[tuple[uuid.UUID, str], int] = {}
    if rows:
        for session_id, phase, count in db.execute(
            select(Trial.session_id, Trial.phase, func.count())
            .where(Trial.session_id.in_([row.id for row in rows]))
            .group_by(Trial.session_id, Trial.phase)
        ):
            counts[(session_id, phase)] = int(count)

    summaries = [
        SessionSummaryRow(
            session_id=row.id,
            data_schema_version=row.data_schema_version,
            experiment_id=row.experiment_id,
            protocol_id=row.protocol_id,
            protocol_version=row.protocol_version,
            configuration_id=row.configuration_id,
            configuration_version=row.configuration_version,
            status=row.status,
            consent_notice_version=row.consent_notice_version,
            created_at=row.created_at,
            practice_trials=counts.get((row.id, "practice"), 0),
            main_trials=counts.get((row.id, "main"), 0),
        )
        for row in rows
    ]
    last = rows[-1] if rows else None
    next_cursor = (
        Cursor(created_at=last.created_at, session_id=last.id)
        if has_more and last is not None
        else None
    )
    return SessionPageRows(sessions=summaries, next_cursor=next_cursor)
