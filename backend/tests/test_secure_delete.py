"""SQLite `PRAGMA secure_delete=ON` on every connection, and what it does.

secure_delete overwrites deleted content inside the database file. It does
not reach journal files already removed, backups, synced copies or the disk
itself (docs/backend/DATA_AND_PRIVACY.md section 8.2). These tests check only
the database file.
"""

import sqlite3
import uuid
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine

from app.config import Settings
from app.database import configure_sqlite_connection
from app.main import create_app
from tests.conftest import local_client, migrate, postgres_test_url, sqlite_url
from tests.factories import session_payload

pytestmark = pytest.mark.skipif(
    postgres_test_url() is not None, reason="SQLite-specific (secure_delete is a SQLite pragma)"
)

SESSIONS = "/api/v1/sessions"
CONFIRM = {"confirm": "delete-all-local-sessions"}


def pragma(engine: Engine, name: str) -> int:
    with engine.connect() as connection:
        return int(connection.exec_driver_sql(f"PRAGMA {name}").scalar_one())


def test_app_connections_have_secure_delete_and_foreign_keys(client: TestClient) -> None:
    app = client.app
    assert isinstance(app, FastAPI)
    engine: Engine = app.state.engine
    # Check more than one pooled connection: the setting is per connection.
    with engine.connect() as first, engine.connect() as second:
        for connection in (first, second):
            assert connection.exec_driver_sql("PRAGMA secure_delete").scalar_one() == 1
            assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1


def test_store_engine_has_secure_delete(engine: Engine) -> None:
    assert pragma(engine, "secure_delete") == 1


def test_connection_hook_sets_both_pragmas_on_a_raw_connection() -> None:
    connection = sqlite3.connect(":memory:")
    try:
        configure_sqlite_connection(connection, None)
        assert connection.execute("PRAGMA secure_delete").fetchone() == (1,)
        assert connection.execute("PRAGMA foreign_keys").fetchone() == (1,)
    finally:
        connection.close()


def test_migrations_use_the_same_connection_hook() -> None:
    env = (Path(__file__).resolve().parents[1] / "migrations" / "env.py").read_text("utf-8")
    assert 'event.listen(connectable, "connect", configure_sqlite_connection)' in env


# --- Behavior: deleted values do not survive in the database file -----------


def _save_and_markers(client: TestClient) -> tuple[str, list[bytes]]:
    client_id = str(uuid.uuid4())
    created = client.post(SESSIONS, json=session_payload(client_session_id=client_id)).json()
    session_id = created["session_id"]
    # UUIDs are stored as 32 hex characters on SQLite.
    markers = [uuid.UUID(client_id).hex.encode(), uuid.UUID(session_id).hex.encode()]
    return session_id, markers


@pytest.fixture
def file_client(tmp_path: Path) -> tuple[TestClient, FastAPI, Path]:
    path = tmp_path / "secure.db"
    migrate(sqlite_url(path))
    settings = Settings(
        env="development",
        local_owner_access=True,
        database_url=sqlite_url(path),
        _env_file=None,
    )
    app = create_app(settings)
    return local_client(app), app, path


@pytest.mark.parametrize("how", ["one", "all"])
def test_deleted_session_ids_are_overwritten_in_the_file(
    file_client: tuple[TestClient, FastAPI, Path], how: str
) -> None:
    client, app, path = file_client
    with client:
        session_id, markers = _save_and_markers(client)
        assert all(marker in path.read_bytes() for marker in markers), "sanity: stored"
        if how == "one":
            assert client.delete(f"{SESSIONS}/{session_id}").status_code == 204
        else:
            assert client.request("DELETE", SESSIONS, json=CONFIRM).status_code == 200
    app.state.engine.dispose()

    content = path.read_bytes()
    for marker in markers:
        assert marker not in content


def test_control_without_secure_delete_the_values_remain(
    file_client: tuple[TestClient, FastAPI, Path],
) -> None:
    """Shows the check above can fail: with the pragma off, a plain DELETE
    leaves the values in free space of the file."""
    client, app, path = file_client
    with client:
        session_id, markers = _save_and_markers(client)
    app.state.engine.dispose()

    plain = create_engine(sqlite_url(path))
    try:
        with plain.begin() as connection:
            if connection.exec_driver_sql("PRAGMA secure_delete").scalar_one() != 0:
                pytest.skip("this SQLite build enables secure_delete by default")
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.exec_driver_sql(
                "DELETE FROM sessions WHERE id = ?", (uuid.UUID(session_id).hex,)
            )
            remaining = connection.exec_driver_sql("SELECT count(*) FROM sessions").scalar_one()
            assert remaining == 0
    finally:
        plain.dispose()

    content = path.read_bytes()
    assert any(marker in content for marker in markers)
