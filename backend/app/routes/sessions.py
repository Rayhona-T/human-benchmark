"""Session endpoints. Backend-only: the frontend does not call these yet.

GET and DELETE have no ownership proof. They exist for local development and
tests only; see docs/backend/BACKEND_ARCHITECTURE.md section 9 before any
deployment.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from .. import session_store
from ..database import get_db
from ..errors import ApiError
from ..models import ExperimentSession
from ..schemas import (
    RandomizationOut,
    SessionCreate,
    SessionCreated,
    SessionDetail,
    TimingOut,
    TrialCounts,
    TrialOut,
)
from ..validation import validate_session
from . import API_PREFIX

router = APIRouter(prefix=f"{API_PREFIX}/sessions", tags=["sessions"])
Db = Annotated[Session, Depends(get_db)]


def _not_found() -> ApiError:
    return ApiError(404, "not_found", "No session with this ID exists.")


@router.post("", status_code=status.HTTP_201_CREATED, response_model=SessionCreated)
def create_session(payload: SessionCreate, db: Db) -> SessionCreated:
    issues = validate_session(payload)
    if issues:
        raise ApiError(
            422,
            "invalid_session",
            "The session breaks protocol or consistency rules. See details.",
            [{"location": issue.location, "message": issue.message} for issue in issues],
        )
    try:
        stored = session_store.create_session(db, payload)
    except session_store.DuplicateSessionError:
        raise ApiError(
            409, "duplicate_session", "A session with this client_session_id is already stored."
        ) from None
    return SessionCreated(
        session_id=stored.id,
        experiment_id=stored.experiment_id,
        status=stored.status,
        created_at=stored.created_at,
        trials_stored=TrialCounts(
            practice=sum(1 for trial in stored.trials if trial.phase == "practice"),
            main=sum(1 for trial in stored.trials if trial.phase == "main"),
        ),
    )


@router.get("/{session_id}", response_model=SessionDetail)
def read_session(session_id: uuid.UUID, db: Db) -> SessionDetail:
    stored = session_store.get_session(db, session_id)
    if stored is None:
        raise _not_found()
    return _detail(stored)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: uuid.UUID, db: Db) -> Response:
    if not session_store.delete_session(db, session_id):
        raise _not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _detail(stored: ExperimentSession) -> SessionDetail:
    schedule = stored.realized_schedule
    return SessionDetail(
        session_id=stored.id,
        data_schema_version=stored.data_schema_version,
        experiment_id=stored.experiment_id,
        protocol_id=stored.protocol_id,
        protocol_version=stored.protocol_version,
        configuration_id=stored.configuration_id,
        configuration_version=stored.configuration_version,
        status=stored.status,
        consent_notice_version=stored.consent_notice_version,
        break_taken=stored.break_taken,
        break_duration_ms=stored.break_duration_ms,
        created_at=stored.created_at,
        randomization=RandomizationOut(
            seed=stored.seed,
            prng_id=stored.prng_id,
            randomization_version=stored.randomization_version,
            schedule_generation_status=stored.schedule_generation_status,
            allocation_details=stored.allocation_details,
            practice_order=schedule["practice"],
            main_order=schedule["main"],
        ),
        trials=[
            TrialOut(
                phase=trial.phase,
                trial_index=trial.trial_index,
                condition=trial.condition,
                stimulus=trial.stimulus,
                correct_response=trial.correct_response,
                response_key=trial.response_key,
                outcome=trial.outcome,
                invalid_reason=trial.invalid_reason,
                reaction_time_ms=trial.reaction_time_ms,
                timing=TimingOut(
                    fixation_onset_ms=trial.fixation_onset_ms,
                    stimulus_onset_ms=trial.stimulus_onset_ms,
                    response_timestamp_ms=trial.response_timestamp_ms,
                    deadline_ms=trial.deadline_ms,
                    stimulus_offset_ms=trial.stimulus_offset_ms,
                    iti_end_ms=trial.iti_end_ms,
                ),
            )
            for trial in stored.trials
        ],
    )
