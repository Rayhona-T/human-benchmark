"""Session endpoints.

- `router`: POST /api/v1/sessions (opt-in save). Always registered.
- `owner_router`: every endpoint that reads or deletes stored sessions. All
  of them depend on the owner scope (app/scope.py), and `create_app`
  registers them only when local-owner access is enabled in development.

Local-owner mode is NOT ownership proof; see app/scope.py and
docs/backend/BACKEND_ARCHITECTURE.md section 9 before any deployment.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from .. import session_store
from ..database import get_db
from ..errors import ApiError
from ..models import ExperimentSession
from ..schemas import (
    DeleteAllConfirmation,
    DeleteAllResult,
    RandomizationOut,
    SessionCreate,
    SessionCreated,
    SessionDetail,
    SessionListQuery,
    SessionPage,
    SessionSummary,
    TimingOut,
    TrialCounts,
    TrialOut,
)
from ..scope import Scope, require_owner_scope
from ..validation import validate_session
from . import API_PREFIX

router = APIRouter(prefix=f"{API_PREFIX}/sessions", tags=["sessions"])
# The router-level dependency guarantees the scope check on every route here,
# even one that forgets to take `scope`; FastAPI runs it once per request.
owner_router = APIRouter(
    prefix=f"{API_PREFIX}/sessions",
    tags=["sessions (local owner, development only)"],
    dependencies=[Depends(require_owner_scope)],
)
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


@owner_router.get("", response_model=SessionPage)
def list_sessions(query: Annotated[SessionListQuery, Query()], scope: Scope, db: Db) -> SessionPage:
    after = None
    if query.cursor is not None:
        try:
            after = session_store.decode_cursor(query.cursor)
        except session_store.InvalidCursorError:
            raise ApiError(
                422,
                "invalid_request",
                "The query string is not valid. See details.",
                [{"location": "query.cursor", "message": "Not a cursor returned by this API."}],
            ) from None
    page = session_store.list_sessions(
        db, scope, limit=query.limit, experiment_id=query.experiment_id, after=after
    )
    return SessionPage(
        sessions=[
            SessionSummary(
                session_id=row.session_id,
                data_schema_version=row.data_schema_version,
                experiment_id=row.experiment_id,
                protocol_id=row.protocol_id,
                protocol_version=row.protocol_version,
                configuration_id=row.configuration_id,
                configuration_version=row.configuration_version,
                status=row.status,
                consent_notice_version=row.consent_notice_version,
                created_at=row.created_at,
                trial_counts=TrialCounts(practice=row.practice_trials, main=row.main_trials),
            )
            for row in page.sessions
        ],
        next_cursor=(session_store.encode_cursor(page.next_cursor) if page.next_cursor else None),
    )


@owner_router.delete("", response_model=DeleteAllResult)
def delete_all_sessions(
    confirmation: DeleteAllConfirmation, request: Request, scope: Scope, db: Db
) -> DeleteAllResult:
    # `confirmation` is validated before this runs: the body must be exactly
    # {"confirm": "delete-all-local-sessions"}. There is no filtered delete,
    # so any query string (for example ?experiment_id=stroop) is refused
    # rather than ignored: ignoring it would delete more than was asked.
    if request.url.query:
        raise ApiError(
            422,
            "invalid_request",
            "Delete-all takes no query parameters.",
            [{"location": "query", "message": "No query parameters are accepted."}],
        )
    deleted = session_store.delete_all_sessions(db, scope)
    return DeleteAllResult(deleted_sessions=deleted.sessions, deleted_trials=deleted.trials)


@owner_router.get("/{session_id}", response_model=SessionDetail)
def read_session(session_id: uuid.UUID, scope: Scope, db: Db) -> SessionDetail:
    stored = session_store.get_session(db, session_id, scope)
    if stored is None:
        raise _not_found()
    return _detail(stored)


@owner_router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: uuid.UUID, scope: Scope, db: Db) -> Response:
    if not session_store.delete_session(db, session_id, scope):
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
