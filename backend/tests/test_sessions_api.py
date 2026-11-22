"""API behavior of /api/v1/sessions against an isolated, migrated database."""

import copy
import json
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.consent import ACCEPTED_NOTICES, PROVISIONAL_NOTICE_VERSION
from app.models import ExperimentSession, Trial
from tests.factories import CLIENT_ID_B, session_payload, technical_error_payload

URL = "/api/v1/sessions"


def locations(response: Any) -> list[str]:
    return [detail["location"] for detail in response.json()["error"].get("details", [])]


def count_rows(db: Session) -> tuple[int, int]:
    sessions = db.scalar(select(func.count()).select_from(ExperimentSession))
    trials = db.scalar(select(func.count()).select_from(Trial))
    return int(sessions or 0), int(trials or 0)


# --- Valid sessions ----------------------------------------------------------


@pytest.mark.parametrize("experiment", ["stroop", "flanker"])
def test_complete_session_is_stored_with_all_trials(
    client: TestClient, db: Session, experiment: str
) -> None:
    response = client.post(URL, json=session_payload(experiment))

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["experiment_id"] == experiment
    assert body["status"] == "complete"
    assert body["trials_stored"] == {"practice": 12, "main": 60}
    assert uuid.UUID(body["session_id"]).version == 4
    assert body["created_at"].endswith(("Z", "+00:00"))
    assert count_rows(db) == (1, 72)


def test_session_id_is_server_generated_not_the_client_id(client: TestClient) -> None:
    payload = session_payload()
    body = client.post(URL, json=payload).json()
    assert body["session_id"] != payload["client_session_id"]


@pytest.mark.parametrize("experiment", ["stroop", "flanker"])
def test_read_back_round_trips_every_stored_value(client: TestClient, experiment: str) -> None:
    payload = session_payload(experiment)
    session_id = client.post(URL, json=payload).json()["session_id"]

    stored = client.get(f"{URL}/{session_id}").json()

    assert stored["consent_notice_version"] == PROVISIONAL_NOTICE_VERSION
    assert stored["data_schema_version"] == 1
    for field in ("experiment_id", "protocol_id", "status", "break_taken", "break_duration_ms"):
        assert stored[field] == payload[field]
    expected_randomization = payload["randomization"]
    assert stored["randomization"] == expected_randomization
    # Trials come back practice first, then by index, exactly as submitted.
    assert stored["trials"] == payload["trials"]
    # Nothing identifying or client-side is echoed back.
    assert "client_session_id" not in stored
    assert "participant_id" not in stored


def test_incomplete_session_with_a_prefix_of_trials_is_accepted(
    client: TestClient, db: Session
) -> None:
    payload = session_payload("flanker", status="incomplete", main_recorded=17)
    response = client.post(URL, json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["trials_stored"] == {"practice": 12, "main": 17}


def test_session_that_ended_during_practice_is_accepted(client: TestClient) -> None:
    payload = session_payload("stroop", status="interrupted", practice_recorded=5, main_recorded=0)
    assert client.post(URL, json=payload).status_code == 201


def test_technical_error_without_a_schedule_is_accepted(client: TestClient) -> None:
    response = client.post(URL, json=technical_error_payload())
    assert response.status_code == 201, response.text
    assert response.json()["trials_stored"] == {"practice": 0, "main": 0}


# --- Shape validation (layer 1) ---------------------------------------------


def test_unknown_fields_such_as_identifiers_are_rejected(client: TestClient, db: Session) -> None:
    payload = session_payload()
    payload["email"] = "person@example.com"
    payload["trials"][0]["user_agent"] = "Mozilla/5.0"

    response = client.post(URL, json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert set(locations(response)) == {"email", "trials[0].user_agent"}
    # The submitted values are never echoed back.
    assert "person@example.com" not in response.text
    assert "Mozilla" not in response.text
    assert count_rows(db) == (0, 0)


@pytest.mark.parametrize(
    ("mutate", "location"),
    [
        (lambda p: p.update(experiment_id="go_no_go"), "experiment_id"),
        (lambda p: p.update(status="finished"), "status"),
        (lambda p: p.update(data_schema_version=2), "data_schema_version"),
        (lambda p: p.update(client_session_id="not-a-uuid"), "client_session_id"),
        (lambda p: p["trials"][0].update(outcome="skipped"), "trials[0].outcome"),
        (lambda p: p["trials"][0].update(phase="warmup"), "trials[0].phase"),
        (lambda p: p["trials"][0].update(trial_index=0), "trials[0].trial_index"),
        (lambda p: p["trials"][0].update(reaction_time_ms=-1.0), "trials[0].reaction_time_ms"),
        (lambda p: p["trials"][0].update(invalid_reason="bored"), "trials[0].invalid_reason"),
        (lambda p: p["randomization"].update(seed=2**32), "randomization.seed"),
        (lambda p: p["randomization"].update(seed=-1), "randomization.seed"),
        (lambda p: p["consent"].update(notice_version=""), "consent.notice_version"),
    ],
)
def test_out_of_range_or_unknown_values_are_rejected(
    client: TestClient, mutate: Any, location: str
) -> None:
    payload = session_payload()
    mutate(payload)
    response = client.post(URL, json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert location in locations(response)


@pytest.mark.parametrize(
    "field", ["client_session_id", "consent", "experiment_id", "status", "randomization", "trials"]
)
def test_missing_required_fields_are_rejected(client: TestClient, field: str) -> None:
    payload = session_payload()
    del payload[field]
    response = client.post(URL, json=payload)
    assert response.status_code == 422
    assert field in locations(response)


def test_values_are_not_coerced_from_strings_or_numbers(client: TestClient) -> None:
    payload = session_payload()
    payload["trials"][0]["trial_index"] = "1"
    payload["break_taken"] = 1
    response = client.post(URL, json=payload)
    assert response.status_code == 422
    assert {"trials[0].trial_index", "break_taken"} <= set(locations(response))


def test_nan_and_infinity_are_rejected(client: TestClient) -> None:
    payload = session_payload()
    body = json.dumps(payload)
    rt = payload["trials"][0]["reaction_time_ms"]
    body = body.replace(f'"reaction_time_ms": {rt}', '"reaction_time_ms": NaN', 1)
    body = body.replace('"break_duration_ms": 15000.5', '"break_duration_ms": Infinity')
    response = client.post(URL, content=body, headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert {"trials[0].reaction_time_ms", "break_duration_ms"} <= set(locations(response))


def test_non_random_client_uuid_is_rejected(client: TestClient) -> None:
    payload = session_payload()
    payload["client_session_id"] = str(uuid.uuid1())
    response = client.post(URL, json=payload)
    assert response.status_code == 422
    assert "client_session_id" in locations(response)


def test_malformed_json_gets_the_standard_envelope(client: TestClient) -> None:
    response = client.post(URL, content="{not json", headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


# --- Protocol and consistency validation (layer 2) --------------------------


def post_mutated(client: TestClient, mutate: Any, experiment: str = "stroop") -> Any:
    payload = session_payload(experiment)
    mutate(payload)
    return client.post(URL, json=payload)


def test_duplicate_trial_index_within_a_phase_is_rejected(client: TestClient, db: Session) -> None:
    def duplicate(p: dict[str, Any]) -> None:
        p["trials"][13] = copy.deepcopy(p["trials"][12])  # main 2 becomes main 1 again

    response = post_mutated(client, duplicate)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_session"
    assert "trials[13].trial_index" in locations(response)
    assert count_rows(db) == (0, 0)


def test_reaction_time_at_or_beyond_the_deadline_is_rejected(client: TestClient) -> None:
    def too_slow(p: dict[str, Any]) -> None:
        trial = p["trials"][0]
        trial["reaction_time_ms"] = 2000.0
        trial["timing"]["response_timestamp_ms"] = trial["timing"]["stimulus_onset_ms"] + 2000.0

    response = post_mutated(client, too_slow)
    assert response.status_code == 422
    assert "trials[0].reaction_time_ms" in locations(response)


def test_reaction_time_must_match_the_timestamps(client: TestClient) -> None:
    response = post_mutated(client, lambda p: p["trials"][0].update(reaction_time_ms=300.0))
    assert response.status_code == 422
    assert "trials[0].reaction_time_ms" in locations(response)


def test_correct_outcome_with_the_wrong_key_is_rejected(client: TestClient) -> None:
    def wrong(p: dict[str, Any]) -> None:
        p["trials"][0]["response_key"] = "k" if p["trials"][0]["correct_response"] != "k" else "d"

    response = post_mutated(client, wrong)
    assert response.status_code == 422
    assert "trials[0].outcome" in locations(response)


def test_timeout_with_a_reaction_time_is_rejected(client: TestClient) -> None:
    # Practice trial 11 is a timeout in the factory pattern.
    response = post_mutated(client, lambda p: p["trials"][10].update(reaction_time_ms=450.0))
    assert response.status_code == 422
    assert "trials[10].reaction_time_ms" in locations(response)


def test_stimulus_contradicting_its_condition_is_rejected(client: TestClient) -> None:
    def contradict(p: dict[str, Any]) -> None:
        for entry in (p["randomization"]["practice_order"][0], p["trials"][0]):
            entry["condition"] = "incongruent"  # first entry is congruent (RED in red)

    response = post_mutated(client, contradict)
    assert response.status_code == 422
    assert "trials[0].condition" in locations(response)


def test_flanker_symbols_must_match_target_and_flankers(client: TestClient) -> None:
    def tamper(p: dict[str, Any]) -> None:
        p["trials"][0]["stimulus"]["symbols"] = "→→→→→"

    response = post_mutated(client, tamper, "flanker")
    assert response.status_code == 422
    assert "trials[0].stimulus" in locations(response)


def test_trial_must_match_its_realized_schedule_entry(client: TestClient) -> None:
    def swap(p: dict[str, Any]) -> None:
        p["trials"][0], p["trials"][1] = p["trials"][1], p["trials"][0]
        p["trials"][0]["trial_index"], p["trials"][1]["trial_index"] = 1, 2

    response = post_mutated(client, swap)
    assert response.status_code == 422
    assert "trials[0]" in locations(response)


def test_complete_status_requires_every_planned_trial(client: TestClient) -> None:
    payload = session_payload(main_recorded=59)
    response = client.post(URL, json=payload)
    assert response.status_code == 422
    assert "status" in locations(response)


def test_gaps_in_recorded_trials_are_rejected(client: TestClient) -> None:
    payload = session_payload(status="incomplete", main_recorded=40)
    del payload["trials"][20]
    response = client.post(URL, json=payload)
    assert response.status_code == 422
    assert "trials" in locations(response)


def test_wrong_protocol_for_experiment_is_rejected(client: TestClient) -> None:
    response = post_mutated(client, lambda p: p.update(protocol_id="HB-FLANKER-1.0"))
    assert response.status_code == 422
    assert "protocol_id" in locations(response)


def test_session_without_consent_is_rejected(client: TestClient, db: Session) -> None:
    response = post_mutated(client, lambda p: p["consent"].update(confirmed=False))
    assert response.status_code == 422
    assert "consent.confirmed" in locations(response)
    assert count_rows(db) == (0, 0)


def test_listed_consent_notice_version_is_accepted(client: TestClient, db: Session) -> None:
    payload = session_payload()
    assert payload["consent"]["notice_version"] == PROVISIONAL_NOTICE_VERSION
    response = client.post(URL, json=payload)
    assert response.status_code == 201, response.text
    stored = client.get(f"{URL}/{response.json()['session_id']}").json()
    assert stored["consent_notice_version"] == PROVISIONAL_NOTICE_VERSION


@pytest.mark.parametrize(
    "version",
    [
        "HB-NOTICE-1.0",  # well-formed but not on the allowlist
        "HB-NOTICE-TEST",  # the earlier free-form test value
        "hb-notice-0.1-provisional",  # matching is exact and case-sensitive
        "HB-NOTICE-0.1-PROVISIONAL.extra",
    ],
)
def test_unrecognized_consent_notice_versions_are_rejected(
    client: TestClient, db: Session, version: str
) -> None:
    payload = session_payload()
    payload["consent"]["notice_version"] = version

    response = client.post(URL, json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_session"
    assert locations(response) == ["consent.notice_version"]
    assert version not in response.text  # the submitted value is not echoed
    assert count_rows(db) == (0, 0)


def test_configured_notice_is_marked_provisional_and_unapproved() -> None:
    assert list(ACCEPTED_NOTICES) == [PROVISIONAL_NOTICE_VERSION]
    notice = ACCEPTED_NOTICES[PROVISIONAL_NOTICE_VERSION]
    assert "PROVISIONAL" in notice.version
    assert notice.approved_for_participant_data is False
    assert "NOT approved for real participant data" in notice.description


def test_all_problems_are_reported_together(client: TestClient) -> None:
    def several(p: dict[str, Any]) -> None:
        p["consent"]["confirmed"] = False
        p["protocol_id"] = "HB-STROOP-9.9"
        p["trials"][0]["reaction_time_ms"] = 1.0

    response = post_mutated(client, several)
    assert {"consent.confirmed", "protocol_id", "trials[0].reaction_time_ms"} <= set(
        locations(response)
    )


# --- Duplicates, reads, deletion --------------------------------------------


def test_duplicate_client_session_id_returns_409_and_stores_nothing_new(
    client: TestClient, db: Session
) -> None:
    payload = session_payload()
    assert client.post(URL, json=payload).status_code == 201

    response = client.post(URL, json=payload)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "duplicate_session"
    assert count_rows(db) == (1, 72)


def test_a_different_client_id_creates_a_separate_session(client: TestClient, db: Session) -> None:
    client.post(URL, json=session_payload())
    client.post(URL, json=session_payload(client_session_id=CLIENT_ID_B))
    assert count_rows(db) == (2, 144)


def test_unknown_session_returns_404(client: TestClient) -> None:
    missing = "6c1f0e0a-1c2d-4e3f-8a9b-0c1d2e3f4a5b"
    for response in (client.get(f"{URL}/{missing}"), client.delete(f"{URL}/{missing}")):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"


def test_malformed_session_id_is_rejected(client: TestClient) -> None:
    response = client.get(f"{URL}/not-a-uuid")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_delete_removes_the_session_and_all_its_trials(client: TestClient, db: Session) -> None:
    keep = client.post(URL, json=session_payload(client_session_id=CLIENT_ID_B)).json()
    remove = client.post(URL, json=session_payload()).json()

    assert client.delete(f"{URL}/{remove['session_id']}").status_code == 204

    assert client.get(f"{URL}/{remove['session_id']}").status_code == 404
    assert client.get(f"{URL}/{keep['session_id']}").status_code == 200
    assert count_rows(db) == (1, 72)


# --- Request limits and error hygiene ---------------------------------------


def test_oversized_body_is_rejected_before_parsing(client: TestClient, db: Session) -> None:
    body = b'{"padding": "' + b"x" * (300 * 1024) + b'"}'
    response = client.post(URL, content=body, headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"
    assert count_rows(db) == (0, 0)


def test_oversized_streamed_body_without_length_is_rejected(client: TestClient) -> None:
    def chunks() -> Any:
        for _ in range(40):
            yield b"x" * 10_000

    response = client.post(URL, content=chunks(), headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"


def test_unsupported_method_uses_the_envelope(client: TestClient) -> None:
    response = client.put(URL, json={})
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "method_not_allowed"


def test_unknown_route_uses_the_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/nothing-here")
    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "not_found", "message": "The requested resource was not found."}
    }
