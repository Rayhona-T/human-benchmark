"""Database constraints hold even when code bypasses API validation."""

import json
import uuid
from datetime import datetime
from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import session_store
from app.models import ExperimentSession, Participant, Trial
from app.schemas import SessionCreate
from tests.factories import session_payload


def make_session(**overrides: Any) -> ExperimentSession:
    values: dict[str, Any] = {
        "client_session_id": uuid.uuid4(),
        "data_schema_version": 1,
        "experiment_id": "stroop",
        "protocol_id": "HB-STROOP-1.0",
        "protocol_version": "1.0",
        "configuration_id": "HB-STROOP-1.0",
        "configuration_version": "1.0",
        "status": "complete",
        "consent_notice_version": "HB-NOTICE-TEST",
        "seed": 1,
        "prng_id": "HB-STROOP-shuffle-v1",
        "randomization_version": "1",
        "schedule_generation_status": "generated",
        "realized_schedule": {"practice": [], "main": []},
        "break_taken": False,
        "break_duration_ms": None,
    }
    values.update(overrides)
    return ExperimentSession(**values)


def make_trial(**overrides: Any) -> Trial:
    values: dict[str, Any] = {
        "phase": "main",
        "trial_index": 1,
        "condition": "congruent",
        "stimulus": {"word": "RED", "ink_color": "red"},
        "correct_response": "d",
        "response_key": "d",
        "outcome": "correct",
        "invalid_reason": None,
        "reaction_time_ms": 500.0,
    }
    values.update(overrides)
    return Trial(**values)


def counts(db: Session) -> tuple[int, int, int]:
    return (
        int(db.scalar(select(func.count()).select_from(Participant)) or 0),
        int(db.scalar(select(func.count()).select_from(ExperimentSession)) or 0),
        int(db.scalar(select(func.count()).select_from(Trial)) or 0),
    )


def assert_rejected(db: Session, *objects: object) -> None:
    db.add_all(objects)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert counts(db) == (0, 0, 0)


def test_a_valid_row_set_is_accepted(db: Session) -> None:
    db.add(make_session(trials=[make_trial()]))
    db.commit()
    assert counts(db) == (0, 1, 1)


@pytest.mark.parametrize(
    "overrides",
    [
        {"experiment_id": "go_no_go"},
        {"status": "finished"},
        {"schedule_generation_status": "maybe"},
        {"data_schema_version": 0},
        {"seed": -1},
        {"seed": 4_294_967_296},
        {"seed": None},  # generated schedule requires a seed
        {"break_taken": True, "break_duration_ms": None},
        {"break_duration_ms": -5.0},
        {"consent_notice_version": None},
        {"realized_schedule": None},
    ],
)
def test_session_constraints(db: Session, overrides: dict[str, Any]) -> None:
    assert_rejected(db, make_session(**overrides))


@pytest.mark.parametrize(
    "overrides",
    [
        {"phase": "warmup"},
        {"trial_index": 0},
        {"condition": "mixed"},
        {"outcome": "skipped"},
        {
            "invalid_reason": "bored",
            "outcome": "invalid",
            "response_key": None,
            "reaction_time_ms": None,
        },
        # invalid reason exactly when invalid
        {"outcome": "invalid", "response_key": None, "reaction_time_ms": None},
        {"invalid_reason": "focus_lost"},
        # responses and RTs only for correct/incorrect
        {"reaction_time_ms": None},
        {"response_key": None},
        {"outcome": "timeout"},
        {"outcome": "timeout", "response_key": None},
        # correctness agrees with keys
        {"response_key": "f"},
        {"outcome": "incorrect"},
        # non-negative times
        {"reaction_time_ms": -0.5},
        {"stimulus_onset_ms": -1.0},
        {"iti_end_ms": -1.0},
        {"stimulus": None},
    ],
)
def test_trial_constraints(db: Session, overrides: dict[str, Any]) -> None:
    assert_rejected(db, make_session(trials=[make_trial(**overrides)]))


def test_duplicate_trial_index_in_a_session_is_rejected(db: Session) -> None:
    assert_rejected(db, make_session(trials=[make_trial(), make_trial()]))


def test_same_index_in_different_phases_or_sessions_is_allowed(db: Session) -> None:
    db.add(make_session(trials=[make_trial(), make_trial(phase="practice")]))
    db.add(make_session(trials=[make_trial()]))
    db.commit()
    assert counts(db) == (0, 2, 3)


def test_duplicate_client_session_id_is_rejected(db: Session) -> None:
    shared = uuid.uuid4()
    assert_rejected(
        db, make_session(client_session_id=shared), make_session(client_session_id=shared)
    )


def test_trial_must_reference_an_existing_session(db: Session) -> None:
    orphan = make_trial()
    orphan.session_id = uuid.uuid4()
    assert_rejected(db, orphan)


def test_session_must_reference_an_existing_participant(db: Session) -> None:
    assert_rejected(db, make_session(participant_id=uuid.uuid4()))


def test_deleting_a_participant_cascades_to_sessions_and_trials(db: Session) -> None:
    participant = Participant()
    db.add(participant)
    db.flush()
    db.add(make_session(participant_id=participant.id, trials=[make_trial()]))
    db.add(make_session(trials=[make_trial()]))  # unlinked; must survive
    db.commit()
    assert counts(db) == (1, 2, 2)

    db.delete(participant)
    db.commit()

    assert counts(db) == (0, 1, 1)


def test_created_at_is_timezone_aware_utc(db: Session) -> None:
    session = make_session()
    db.add(session)
    db.commit()
    db.expire_all()
    stored = db.scalar(select(ExperimentSession))
    assert stored is not None
    assert isinstance(stored.created_at, datetime)
    offset = stored.created_at.utcoffset()
    assert offset is not None
    assert offset.total_seconds() == 0


def test_naive_datetimes_are_refused(db: Session) -> None:
    db.add(make_session(created_at=datetime(2026, 1, 1)))  # intentionally naive
    with pytest.raises(Exception, match="naive"):
        db.commit()
    db.rollback()


def test_store_is_atomic_when_a_trial_fails(db: Session) -> None:
    """If any trial row is rejected, neither the session nor other trials persist."""
    payload = SessionCreate.model_validate_json(json.dumps(session_payload()))
    # Bypass layer 2 by building a payload whose last trial violates a DB check.
    bad_trials = list(payload.trials)
    bad_trials[-1] = bad_trials[-1].model_copy(update={"reaction_time_ms": None})
    bad = payload.model_copy(update={"trials": bad_trials})

    with pytest.raises(IntegrityError):
        session_store.create_session(db, bad)

    assert counts(db) == (0, 0, 0)
