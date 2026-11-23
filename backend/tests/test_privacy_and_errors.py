"""Privacy-safe logging and error responses that leak no internals."""

import logging

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.consent import PROVISIONAL_NOTICE_VERSION
from app.main import create_app
from tests.conftest import local_client
from tests.factories import session_payload


def test_request_log_has_route_template_but_no_values_or_ids(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO, logger="human_benchmark")
    created = client.post("/api/v1/sessions", json=session_payload()).json()
    client.get(f"/api/v1/sessions/{created['session_id']}")

    messages = [r.getMessage() for r in caplog.records if r.name.startswith("human_benchmark")]
    assert any(m.startswith("POST /api/v1/sessions 201") for m in messages)
    assert any(m.startswith("GET /api/v1/sessions/{session_id} 200") for m in messages)
    text = "\n".join(messages)
    for secret in (created["session_id"], "123456789", PROVISIONAL_NOTICE_VERSION, "testclient"):
        assert secret not in text


def test_unexpected_errors_return_a_generic_500_without_internals(
    settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    app = create_app(settings)

    def explode() -> None:
        raise RuntimeError("secret detail: participant RT 512.25")

    app.add_api_route("/api/v1/explode", explode)
    with local_client(app, raise_server_exceptions=False) as client:
        response = client.get("/api/v1/explode")
    app.state.engine.dispose()

    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "internal_error", "message": "An unexpected error occurred."}
    }
    assert "Traceback" not in response.text
    assert "secret" not in response.text
    # The server log names the error type and route for debugging.
    assert any(
        "unhandled RuntimeError on GET /api/v1/explode" in r.getMessage() for r in caplog.records
    )


def test_database_errors_do_not_carry_submitted_values(settings: Settings) -> None:
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError

    app = create_app(settings)
    with app.state.engine.connect() as connection, pytest.raises(IntegrityError) as raised:
        connection.execute(
            text("INSERT INTO trials (session_id, phase) VALUES (:sid, :phase)"),
            {"sid": "VALUE-THAT-MUST-NOT-LEAK", "phase": "main"},
        )
    assert "VALUE-THAT-MUST-NOT-LEAK" not in str(raised.value)
    app.state.engine.dispose()


def test_validation_details_never_include_input_values(client: TestClient) -> None:
    payload = session_payload()
    payload["consent"]["notice_version"] = "has spaces and a name: Jane Doe"
    payload["trials"][0]["reaction_time_ms"] = "512 ms"
    response = client.post("/api/v1/sessions", json=payload)
    assert response.status_code == 422
    assert "Jane Doe" not in response.text
    assert "512 ms" not in response.text
    for detail in response.json()["error"]["details"]:
        assert set(detail) == {"location", "message"}
