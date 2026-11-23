"""GET /api/v1/sessions (summaries, keyset pagination) and
DELETE /api/v1/sessions (delete-all with explicit confirmation).

`client` runs in development with local-owner access on (tests/conftest.py).
"""

import base64
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import ExperimentSession, Participant, Trial
from app.schemas import DELETE_ALL_CONFIRMATION, MAX_PAGE_SIZE
from app.session_store import Cursor, decode_cursor, encode_cursor
from tests.factories import session_payload

SESSIONS = "/api/v1/sessions"
CONFIRM = {"confirm": "delete-all-local-sessions"}
SUMMARY_FIELDS = {
    "session_id",
    "data_schema_version",
    "experiment_id",
    "protocol_id",
    "protocol_version",
    "configuration_id",
    "configuration_version",
    "status",
    "consent_notice_version",
    "created_at",
    "trial_counts",
}


def save(client: TestClient, experiment: str = "stroop") -> str:
    response = client.post(
        SESSIONS, json=session_payload(experiment, client_session_id=str(uuid.uuid4()))
    )
    assert response.status_code == 201, response.text
    return str(response.json()["session_id"])


def set_created_at(db: Session, session_id: str, when: datetime) -> None:
    db.execute(
        update(ExperimentSession)
        .where(ExperimentSession.id == uuid.UUID(session_id))
        .values(created_at=when)
    )
    db.commit()


def rows(db: Session) -> tuple[int, int]:
    db.expire_all()
    sessions = db.scalar(select(func.count()).select_from(ExperimentSession))
    trials = db.scalar(select(func.count()).select_from(Trial))
    return int(sessions or 0), int(trials or 0)


def all_pages(client: TestClient, **params: Any) -> list[list[str]]:
    pages: list[list[str]] = []
    cursor = None
    while True:
        query = dict(params)
        if cursor:
            query["cursor"] = cursor
        response = client.get(SESSIONS, params=query)
        assert response.status_code == 200, response.text
        body = response.json()
        pages.append([entry["session_id"] for entry in body["sessions"]])
        cursor = body["next_cursor"]
        if cursor is None:
            return pages
        assert len(pages) < 50, "pagination did not terminate"


def locations(response: Any) -> list[str]:
    return [detail["location"] for detail in response.json()["error"].get("details", [])]


# --- Summaries -------------------------------------------------------------


def test_empty_database_gives_an_empty_page(client: TestClient) -> None:
    response = client.get(SESSIONS)
    assert response.status_code == 200
    assert response.json() == {"sessions": [], "next_cursor": None}


@pytest.mark.parametrize("experiment", ["stroop", "flanker"])
def test_summary_has_exactly_the_documented_fields(client: TestClient, experiment: str) -> None:
    payload = session_payload(experiment, client_session_id=str(uuid.uuid4()))
    created = client.post(SESSIONS, json=payload).json()

    body = client.get(SESSIONS).json()

    [entry] = body["sessions"]
    assert set(entry) == SUMMARY_FIELDS
    assert entry["session_id"] == created["session_id"]
    assert entry["created_at"] == created["created_at"]
    assert entry["trial_counts"] == {"practice": 12, "main": 60}
    assert entry["status"] == "complete"
    assert entry["data_schema_version"] == 1
    for field in (
        "experiment_id",
        "protocol_id",
        "protocol_version",
        "configuration_id",
        "configuration_version",
    ):
        assert entry[field] == payload[field]
    assert entry["consent_notice_version"] == payload["consent"]["notice_version"]


def test_summary_contains_no_trial_level_or_identifying_data(client: TestClient) -> None:
    payload = session_payload(client_session_id=str(uuid.uuid4()))
    client.post(SESSIONS, json=payload)

    text = client.get(SESSIONS).text

    for absent in (
        "trials",
        "stimulus",
        "reaction_time",
        "response_key",
        "randomization",
        "seed",
        "allocation",
        "practice_order",
        "client_session_id",
        "participant",
        "break_",
        payload["client_session_id"],
        payload["client_session_id"].replace("-", ""),
        str(payload["randomization"]["seed"]),
    ):
        assert absent not in text


def test_trial_counts_reflect_each_session(client: TestClient, db: Session) -> None:
    first = save(client)
    second = save(client, "flanker")
    set_created_at(db, first, datetime(2026, 1, 1, tzinfo=UTC))
    set_created_at(db, second, datetime(2026, 1, 2, tzinfo=UTC))
    # Remove some trials of the first session directly, to prove counts are per session.
    db.execute(
        Trial.__table__.delete().where(
            Trial.session_id == uuid.UUID(first), Trial.phase == "main", Trial.trial_index > 50
        )
    )
    db.commit()

    entries = client.get(SESSIONS).json()["sessions"]

    assert [e["session_id"] for e in entries] == [second, first]
    assert entries[0]["trial_counts"] == {"practice": 12, "main": 60}
    assert entries[1]["trial_counts"] == {"practice": 12, "main": 50}


# --- Ordering and pagination -----------------------------------------------


def test_newest_first(client: TestClient, db: Session) -> None:
    ids = [save(client) for _ in range(3)]
    base = datetime(2026, 3, 1, 12, 0, tzinfo=UTC)
    for offset, session_id in enumerate(ids):
        set_created_at(db, session_id, base + timedelta(minutes=offset))
    listed = [e["session_id"] for e in client.get(SESSIONS).json()["sessions"]]
    assert listed == list(reversed(ids))


def test_ties_on_created_at_are_ordered_by_id_across_pages(client: TestClient, db: Session) -> None:
    tied = datetime(2026, 5, 5, 5, 5, 5, 123456, tzinfo=UTC)
    ids = [save(client, "stroop" if n % 2 else "flanker") for n in range(7)]
    for session_id in ids[:5]:
        set_created_at(db, session_id, tied)  # five identical timestamps
    set_created_at(db, ids[5], tied + timedelta(microseconds=1))
    set_created_at(db, ids[6], tied - timedelta(microseconds=1))

    pages = all_pages(client, limit=2)

    tied_order = sorted(ids[:5], key=lambda value: uuid.UUID(value).int, reverse=True)
    expected = [ids[5], *tied_order, ids[6]]
    assert [len(page) for page in pages] == [2, 2, 2, 1]
    assert [entry for page in pages for entry in page] == expected


@pytest.mark.parametrize("limit", [1, 2, 3, 4, 5, 6])
def test_every_page_size_visits_each_session_exactly_once(
    client: TestClient, db: Session, limit: int
) -> None:
    ids = [save(client) for _ in range(5)]
    for offset, session_id in enumerate(ids):
        set_created_at(db, session_id, datetime(2026, 2, 1, tzinfo=UTC) + timedelta(seconds=offset))
    flat = [entry for page in all_pages(client, limit=limit) for entry in page]
    assert flat == list(reversed(ids))


def test_last_full_page_has_no_next_cursor(client: TestClient) -> None:
    for _ in range(4):
        save(client)
    first = client.get(SESSIONS, params={"limit": 2}).json()
    assert first["next_cursor"] is not None
    second = client.get(SESSIONS, params={"limit": 2, "cursor": first["next_cursor"]}).json()
    assert len(second["sessions"]) == 2
    assert second["next_cursor"] is None


def test_default_page_size_is_20(client: TestClient) -> None:
    for _ in range(21):
        save(client)
    body = client.get(SESSIONS).json()
    assert len(body["sessions"]) == 20
    assert body["next_cursor"] is not None


def test_maximum_page_size_is_accepted(client: TestClient) -> None:
    save(client)
    response = client.get(SESSIONS, params={"limit": MAX_PAGE_SIZE})
    assert response.status_code == 200
    assert len(response.json()["sessions"]) == 1


def test_cursor_stays_valid_after_its_session_is_deleted(client: TestClient, db: Session) -> None:
    ids = [save(client) for _ in range(3)]
    for offset, session_id in enumerate(ids):
        set_created_at(db, session_id, datetime(2026, 4, 1, tzinfo=UTC) + timedelta(hours=offset))
    first = client.get(SESSIONS, params={"limit": 1}).json()
    assert client.delete(f"{SESSIONS}/{first['sessions'][0]['session_id']}").status_code == 204
    rest = client.get(SESSIONS, params={"limit": 5, "cursor": first["next_cursor"]}).json()
    assert [e["session_id"] for e in rest["sessions"]] == [ids[1], ids[0]]


def test_cursor_round_trips() -> None:
    cursor = Cursor(
        created_at=datetime(2026, 11, 22, 20, 29, 1, 201217, tzinfo=UTC),
        session_id=uuid.UUID("8a90268339ef4a7a9d779632b92070fa"),
    )
    assert decode_cursor(encode_cursor(cursor)) == cursor


# --- Filtering -------------------------------------------------------------


def test_experiment_filter(client: TestClient, db: Session) -> None:
    stroop = [save(client, "stroop") for _ in range(3)]
    flanker = [save(client, "flanker") for _ in range(2)]
    for offset, session_id in enumerate(stroop + flanker):
        set_created_at(db, session_id, datetime(2026, 6, 1, tzinfo=UTC) + timedelta(minutes=offset))

    only_stroop = [e for page in all_pages(client, experiment_id="stroop", limit=2) for e in page]
    only_flanker = [e for page in all_pages(client, experiment_id="flanker") for e in page]

    assert only_stroop == list(reversed(stroop))
    assert only_flanker == list(reversed(flanker))


# --- Invalid query strings -------------------------------------------------


@pytest.mark.parametrize(
    ("params", "location"),
    [
        ({"limit": "0"}, "query.limit"),
        ({"limit": "-1"}, "query.limit"),
        ({"limit": str(MAX_PAGE_SIZE + 1)}, "query.limit"),
        ({"limit": "abc"}, "query.limit"),
        ({"limit": "1.5"}, "query.limit"),
        ({"limit": ""}, "query.limit"),
        ({"experiment_id": "go-nogo"}, "query.experiment_id"),
        ({"experiment_id": "STROOP"}, "query.experiment_id"),
        ({"experiment_id": ""}, "query.experiment_id"),
        ({"cursor": ""}, "query.cursor"),
        ({"cursor": "a" * 129}, "query.cursor"),
        ({"participant_id": "x"}, "query.participant_id"),
        ({"order": "asc"}, "query.order"),
    ],
)
def test_invalid_query_parameters_are_rejected(
    client: TestClient, params: dict[str, str], location: str
) -> None:
    response = client.get(SESSIONS, params=params)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert location in locations(response)


def _b64(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode()).decode().rstrip("=")


GOOD_ID = "8a90268339ef4a7a9d779632b92070fa"


@pytest.mark.parametrize(
    "cursor",
    [
        "not a cursor!",
        "%%%%",
        "abc",  # valid base64 alphabet, not a cursor
        _b64("hello"),
        _b64(f"2|2026-11-22T20:29:01+00:00|{GOOD_ID}"),  # unknown version
        _b64(f"1|2026-11-22T20:29:01|{GOOD_ID}"),  # naive time
        _b64(f"1|2026-11-22T22:29:01+02:00|{GOOD_ID}"),  # not UTC
        _b64(f"1|yesterday|{GOOD_ID}"),
        _b64(f"1|2026-11-22T20:29:01+00:00|{GOOD_ID.upper()}"),
        _b64("1|2026-11-22T20:29:01+00:00|not-hex"),
        _b64(f"1|2026-11-22T20:29:01+00:00|{GOOD_ID}|extra"),
        _b64(f"1|2026-11-22T20:29:01+00:00|{GOOD_ID}' OR '1'='1"),
        base64.urlsafe_b64encode(b"\xff\xfe\x00").decode().rstrip("="),
    ],
)
def test_invalid_cursors_are_rejected(client: TestClient, cursor: str) -> None:
    save(client)
    response = client.get(SESSIONS, params={"cursor": cursor})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert locations(response) == ["query.cursor"]
    assert cursor not in response.text  # input is never echoed


# --- Delete all --------------------------------------------------------------


def test_confirmation_constant_matches_the_schema() -> None:
    assert CONFIRM["confirm"] == DELETE_ALL_CONFIRMATION


@pytest.mark.parametrize(
    "kwargs",
    [
        {},  # no body
        {"json": {}},
        {"json": {"confirm": "delete-all"}},
        {"json": {"confirm": "DELETE-ALL-LOCAL-SESSIONS"}},
        {"json": {"confirm": " delete-all-local-sessions"}},
        {"json": {"confirm": True}},
        {"json": {"confirm": ["delete-all-local-sessions"]}},
        {"json": "delete-all-local-sessions"},
        {"json": {"confirm": "delete-all-local-sessions", "also": "this"}},
        {"json": {"Confirm": "delete-all-local-sessions"}},
        {"content": b"{not json", "headers": {"Content-Type": "application/json"}},
        # A cross-site "simple" request a page could send without preflight.
        {
            "content": b'{"confirm": "delete-all-local-sessions"}',
            "headers": {"Content-Type": "text/plain"},
        },
        {
            "content": b"confirm=delete-all-local-sessions",
            "headers": {"Content-Type": "application/x-www-form-urlencoded"},
        },
    ],
)
def test_delete_all_without_exact_confirmation_deletes_nothing(
    client: TestClient, db: Session, kwargs: dict[str, Any]
) -> None:
    save(client)
    response = client.request("DELETE", SESSIONS, **kwargs)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert rows(db) == (1, 72)


def test_delete_all_removes_every_session_and_trial(client: TestClient, db: Session) -> None:
    ids = [save(client, "stroop"), save(client, "flanker"), save(client, "stroop")]

    response = client.request("DELETE", SESSIONS, json=CONFIRM)

    assert response.status_code == 200
    assert response.json() == {"deleted_sessions": 3, "deleted_trials": 216}
    assert rows(db) == (0, 0)
    assert client.get(SESSIONS).json() == {"sessions": [], "next_cursor": None}
    for session_id in ids:
        assert client.get(f"{SESSIONS}/{session_id}").status_code == 404


def test_delete_all_on_an_empty_database_is_predictable(client: TestClient) -> None:
    for _ in range(2):
        response = client.request("DELETE", SESSIONS, json=CONFIRM)
        assert response.status_code == 200
        assert response.json() == {"deleted_sessions": 0, "deleted_trials": 0}


def test_saving_works_again_after_delete_all(client: TestClient, db: Session) -> None:
    save(client)
    client.request("DELETE", SESSIONS, json=CONFIRM)
    save(client, "flanker")
    assert rows(db) == (1, 72)


def test_delete_all_cascades_through_the_database_not_application_code(
    client: TestClient, db: Session
) -> None:
    # A session linked to a participant row (none are created by the API
    # today) is deleted with its trials; the participant row stays.
    participant = Participant()
    db.add(participant)
    db.commit()
    session_id = save(client)
    db.execute(
        update(ExperimentSession)
        .where(ExperimentSession.id == uuid.UUID(session_id))
        .values(participant_id=participant.id)
    )
    db.commit()

    assert client.request("DELETE", SESSIONS, json=CONFIRM).json() == {
        "deleted_sessions": 1,
        "deleted_trials": 72,
    }
    assert rows(db) == (0, 0)
    assert db.scalar(select(func.count()).select_from(Participant)) == 1


@pytest.mark.parametrize("params", [{"experiment_id": "stroop"}, {"limit": "1"}, {"x": ""}])
def test_delete_all_refuses_any_query_string(
    client: TestClient, db: Session, params: dict[str, str]
) -> None:
    # There is no filtered delete. A caller who expects ?experiment_id= to
    # narrow it must not silently delete everything instead.
    save(client, "stroop")
    save(client, "flanker")
    response = client.request("DELETE", SESSIONS, params=params, json=CONFIRM)
    assert response.status_code == 422
    assert locations(response) == ["query"]
    assert rows(db) == (2, 144)
