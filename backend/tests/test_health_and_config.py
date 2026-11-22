"""Health endpoint, application start-up and configuration safety."""

from pathlib import Path

import pytest
from alembic import command
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import DEFAULT_CORS_ORIGINS, Settings
from app.database import alembic_config
from app.main import create_app
from tests.conftest import migrate, sqlite_url


def make_settings(**values: object) -> Settings:
    return Settings(_env_file=None, **values)  # type: ignore[arg-type]


def health_of(settings: Settings) -> tuple[int, dict[str, str]]:
    app = create_app(settings)
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/health")
        return response.status_code, response.json()
    finally:
        app.state.engine.dispose()


def test_health_reports_ok_on_a_migrated_database(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "api_version": "v1", "database": "ok"}


def test_health_reports_an_unmigrated_database(tmp_path: Path) -> None:
    status, body = health_of(make_settings(database_url=sqlite_url(tmp_path / "empty.db")))
    assert status == 503
    assert body["database"] == "schema_not_current"


def test_health_reports_a_database_behind_the_latest_migration(tmp_path: Path) -> None:
    url = sqlite_url(tmp_path / "old.db")
    migrate(url)
    config = alembic_config(url)
    config.attributes["configure_logging"] = False
    command.downgrade(config, "base")  # alembic_version exists but is empty
    status, body = health_of(make_settings(database_url=url))
    assert status == 503
    assert body["database"] == "schema_not_current"


def test_health_reports_an_unreachable_database(tmp_path: Path) -> None:
    missing_dir = tmp_path / "does-not-exist" / "db.sqlite"
    status, body = health_of(make_settings(database_url=sqlite_url(missing_dir)))
    assert status == 503
    assert body == {"status": "unavailable", "api_version": "v1", "database": "unreachable"}


def test_openapi_document_lists_only_the_documented_endpoints(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert set(paths) == {
        "/api/v1/health",
        "/api/v1/sessions",
        "/api/v1/sessions/{session_id}",
    }
    assert set(paths["/api/v1/sessions"]) == {"post"}
    assert set(paths["/api/v1/sessions/{session_id}"]) == {"get", "delete"}


# --- Configuration -----------------------------------------------------------


def test_defaults_are_local_and_safe() -> None:
    settings = make_settings()
    assert settings.env == "development"
    assert settings.host == "127.0.0.1"
    assert settings.cors_origins == DEFAULT_CORS_ORIGINS
    assert settings.database_url.startswith("sqlite:///")
    assert settings.max_request_bytes == 256 * 1024


def test_environment_variables_are_read(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HB_CORS_ORIGINS", "http://localhost:3000, https://example.test")
    monkeypatch.setenv("HB_PORT", "8123")
    settings = make_settings()
    assert settings.cors_origins == ("http://localhost:3000", "https://example.test")
    assert settings.port == 8123


@pytest.mark.parametrize(
    "values",
    [
        {"env": "production"},
        {"cors_origins": "*"},
        {"cors_origins": "http://localhost:5173/"},
        {"cors_origins": "localhost:5173"},
        {"database_url": "mysql://user@host/db"},
        {"database_url": "sqlite://"},
        {"max_request_bytes": 10},
        {"log_level": "TRACE"},
    ],
)
def test_unsafe_or_unsupported_settings_fail_at_start_up(values: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        make_settings(**values)


def test_cors_allows_only_configured_origins(client: TestClient) -> None:
    allowed = client.options(
        "/api/v1/sessions",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-credentials" not in allowed.headers

    refused = client.get("/api/v1/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in refused.headers


def test_rejected_oversized_request_still_carries_cors_headers(client: TestClient) -> None:
    response = client.post(
        "/api/v1/sessions",
        content=b"x" * (300 * 1024),
        headers={"Content-Type": "application/json", "Origin": "http://localhost:5173"},
    )
    assert response.status_code == 413
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
