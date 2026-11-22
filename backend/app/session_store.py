"""Transactional persistence for sessions and their trials.

Callers pass payloads that already passed validation layers 1 and 2. Each
operation is one transaction: a session and all of its trials are stored
together or not at all.
"""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .models import ExperimentSession, Trial
from .protocols import PROTOCOLS
from .schemas import PlannedTrialIn, SessionCreate, TrialIn


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


def get_session(db: Session, session_id: uuid.UUID) -> ExperimentSession | None:
    return db.scalar(
        select(ExperimentSession)
        .where(ExperimentSession.id == session_id)
        .options(selectinload(ExperimentSession.trials))
    )


def delete_session(db: Session, session_id: uuid.UUID) -> bool:
    """Hard-deletes a session; the database cascade removes its trials."""
    session = db.get(ExperimentSession, session_id)
    if session is None:
        return False
    db.delete(session)
    db.commit()
    return True
