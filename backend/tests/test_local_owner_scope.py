"""Local-owner scope: development-only, explicit opt-in, fail closed.

Reading and deleting stored sessions (list, detail, delete one, delete all)
must be impossible unless HB_ENV is "development" AND HB_LOCAL_OWNER_ACCESS
is true. Saving must keep working either way.
"""

from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.main import create_app
from app.models import ExperimentSession, Trial
from app.routes import sessions as session_routes
from app.scope import LOCAL_OWNER, local_owner_enabled, require_owner_scope
from tests.conftest import local_client
from tests.factories import session_payload

SESSIONS = "/api/v1/sessions"
CONFIRM = {"confirm": "delete-all-local-sessions"}
MISSING_ID = "6c1f0e0a-1c2d-4e3f-8a9b-0c1d2e3f4a5b"


def rows(db: Session) -> tuple[int, int]:
    db.expire_all()
    sessions = db.scalar(select(func.count()).select_from(ExperimentSession))
    trials = db.scalar(select(func.count()).select_from(Trial))
    return int(sessions or 0), int(trials or 0)


@pytest.fixture
def make_client(database_url: str) -> Iterator[Any]:
    apps: list[FastAPI] = []

    def build(**values: Any) -> TestClient:
        settings = Settings(database_url=database_url, _env_file=None, **values)
        app = create_app(settings)
        apps.append(app)
        return local_client(app)

    yield build
    for app in apps:
        app.state.engine.dispose()


# --- The switch itself -----------------------------------------------------


def test_enabled_only_for_development_with_explicit_opt_in(database_url: str) -> None:
    def settings(**values: Any) -> Settings:
        return Settings(database_url=database_url, _env_file=None, **values)

    assert local_owner_enabled(settings(env="development", local_owner_access=True))
    assert not local_owner_enabled(settings(env="development", local_owner_access=False))
    assert not local_owner_enabled(settings(env="development"))  # missing: off
    assert not local_owner_enabled(settings(env="test", local_owner_access=True))


@pytest.mark.parametrize(
    "candidate",
    [
        None,
        object(),
        {"env": "development", "local_owner_access": True},
        # Looks right but is not a validated Settings object.
        SimpleNamespace(env="development", local_owner_access=True),
        SimpleNamespace(env="development", local_owner_access="true"),
    ],
)
def test_anything_but_validated_settings_fails_closed(candidate: object) -> None:
    assert local_owner_enabled(candidate) is False


def test_environment_variable_enables_it_and_default_is_off(
    monkeypatch: pytest.MonkeyPatch, database_url: str
) -> None:
    monkeypatch.delenv("HB_LOCAL_OWNER_ACCESS", raising=False)
    assert Settings(database_url=database_url, _env_file=None).local_owner_access is False
    monkeypatch.setenv("HB_LOCAL_OWNER_ACCESS", "true")
    assert Settings(database_url=database_url, _env_file=None).local_owner_access is True


# --- Disabled configurations: the routes do not exist --------------------


@pytest.mark.parametrize(
    "values",
    [
        {"env": "development"},  # opt-in missing
        {"env": "development", "local_owner_access": False},
        {"env": "test", "local_owner_access": True},  # not development
        {"env": "test"},
    ],
)
def test_disabled_server_cannot_list_read_or_delete(
    make_client: Any, db: Session, values: dict[str, Any]
) -> None:
    with make_client(**values) as client:
        created = client.post(SESSIONS, json=session_payload())
        assert created.status_code == 201, "saving must keep working"
        session_id = created.json()["session_id"]

        assert client.get(SESSIONS).status_code == 405
        assert client.request("DELETE", SESSIONS, json=CONFIRM).status_code == 405
        assert client.get(f"{SESSIONS}/{session_id}").status_code == 404
        assert client.delete(f"{SESSIONS}/{session_id}").status_code == 404

    assert rows(db) == (1, 72)


# --- Defense in depth: the live settings are re-checked per request -------


@pytest.mark.parametrize(
    "replacement",
    [
        None,
        "development",
        SimpleNamespace(env="development", local_owner_access=True),
        "test-settings",
        "opt-in-off",
    ],
)
def test_routes_refuse_when_live_settings_stop_allowing_it(
    make_client: Any, database_url: str, db: Session, replacement: Any
) -> None:
    replacements = {
        "test-settings": Settings(
            env="test", local_owner_access=True, database_url=database_url, _env_file=None
        ),
        "opt-in-off": Settings(env="development", database_url=database_url, _env_file=None),
    }
    with make_client(env="development", local_owner_access=True) as client:
        session_id = client.post(SESSIONS, json=session_payload()).json()["session_id"]
        app = client.app
        assert isinstance(app, FastAPI)
        named = isinstance(replacement, str) and replacement in replacements
        app.state.settings = replacements[replacement] if named else replacement

        responses = [
            client.get(SESSIONS),
            client.request("DELETE", SESSIONS, json=CONFIRM),
            client.get(f"{SESSIONS}/{session_id}"),
            client.delete(f"{SESSIONS}/{session_id}"),
            # The scope is checked before the path or body is validated.
            client.get(f"{SESSIONS}/not-a-uuid"),
            client.request("DELETE", SESSIONS, json={"confirm": "wrong"}),
        ]

    for response in responses:
        assert response.status_code == 403
        assert response.json() == {
            "error": {
                "code": "local_owner_access_disabled",
                "message": "Reading and deleting stored sessions is not enabled on this server.",
            }
        }
    assert rows(db) == (1, 72)


def test_missing_settings_attribute_fails_closed(make_client: Any) -> None:
    with make_client(env="development", local_owner_access=True) as client:
        app = client.app
        assert isinstance(app, FastAPI)
        del app.state.settings
        assert client.get(SESSIONS).status_code == 403


# --- Every read or delete route is scoped --------------------------------


def _scoped(route: APIRoute) -> bool:
    calls = [dependency.call for dependency in route.dependant.dependencies]
    return require_owner_scope in calls


def _methods(route: APIRoute) -> frozenset[str]:
    # FastAPI types APIRoute.methods as optional; every route here declares its methods.
    assert route.methods is not None, route.path
    return frozenset(route.methods)


def test_every_owner_route_depends_on_the_scope() -> None:
    routes = [r for r in session_routes.owner_router.routes if isinstance(r, APIRoute)]
    assert {(r.path, _methods(r)) for r in routes} == {
        ("/api/v1/sessions", frozenset({"GET"})),
        ("/api/v1/sessions", frozenset({"DELETE"})),
        ("/api/v1/sessions/{session_id}", frozenset({"GET"})),
        ("/api/v1/sessions/{session_id}", frozenset({"DELETE"})),
    }
    assert all(_scoped(route) for route in routes)


def test_no_unscoped_route_reads_or_deletes_sessions(client: TestClient) -> None:
    app = client.app
    assert isinstance(app, FastAPI)
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith(SESSIONS):
            continue
        methods = _methods(route)
        if methods & {"GET", "DELETE", "PUT", "PATCH"}:
            assert _scoped(route), route.path
        else:
            assert methods == {"POST"} and route.path == SESSIONS


def test_local_owner_scope_covers_the_whole_database() -> None:
    assert LOCAL_OWNER.kind == "local_owner"
    assert LOCAL_OWNER.session_conditions() == ()


# --- Enabled: detail and delete-by-ID still work, inside the scope -------


def test_enabled_detail_and_delete_by_id(client: TestClient, db: Session) -> None:
    session_id = client.post(SESSIONS, json=session_payload()).json()["session_id"]
    assert client.get(f"{SESSIONS}/{session_id}").status_code == 200
    assert client.delete(f"{SESSIONS}/{session_id}").status_code == 204
    assert client.get(f"{SESSIONS}/{session_id}").status_code == 404
    assert client.delete(f"{SESSIONS}/{MISSING_ID}").status_code == 404
    assert rows(db) == (0, 0)
