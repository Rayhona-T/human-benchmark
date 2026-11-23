"""Test fixtures: every test gets its own temporary SQLite file, created by
running the real Alembic migrations. The developer's database and backend/.env
are never read.

Optional live PostgreSQL run: set HB_TEST_POSTGRES_URL to an EMPTY, dedicated
test database whose name ends in "_test", for example
    postgresql+pg8000://hb_tester:<password>@127.0.0.1:5432/human_benchmark_test
Every database-backed test then runs against it instead of SQLite. The schema
is dropped and re-created through the migrations before each test, so never
point this at a database holding data you want to keep. Use a throwaway role
and password made only for testing.
"""

import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import alembic_config, create_db_engine, create_session_factory
from app.main import create_app


def sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.as_posix()}"


def migrate(database_url: str, revision: str = "head") -> None:
    config = alembic_config(database_url)
    config.attributes["configure_logging"] = False
    command.upgrade(config, revision)


POSTGRES_TEST_URL = os.environ.get("HB_TEST_POSTGRES_URL", "").strip()


def pytest_configure(config: pytest.Config) -> None:
    if POSTGRES_TEST_URL:
        # Long tracebacks print the arguments of every frame, which would
        # include the database password from connection calls. Short
        # tracebacks and no locals keep it out of the test output.
        config.option.tbstyle = "short"
        config.option.showlocals = False


def postgres_test_url() -> str | None:
    """The opt-in PostgreSQL URL, after the safety checks; None when unset."""
    if not POSTGRES_TEST_URL:
        return None
    url = make_url(POSTGRES_TEST_URL)
    if not url.drivername.startswith("postgresql"):
        raise pytest.UsageError("HB_TEST_POSTGRES_URL must be a postgresql URL")
    if not (url.database or "").endswith("_test"):
        # The suite drops every table; refuse anything not clearly a test database.
        raise pytest.UsageError("HB_TEST_POSTGRES_URL database name must end with '_test'")
    return url.render_as_string(hide_password=False)


def reset_and_migrate(database_url: str) -> None:
    config = alembic_config(database_url)
    config.attributes["configure_logging"] = False
    command.downgrade(config, "base")
    command.upgrade(config, "head")


@pytest.fixture
def database_url(tmp_path: Path) -> str:
    postgres = postgres_test_url()
    if postgres is not None:
        reset_and_migrate(postgres)
        return postgres
    url = sqlite_url(tmp_path / "test.db")
    migrate(url)
    return url


# TestClient sends Host "testserver" by default, which TrustedHostMiddleware
# rejects. Every test client uses a trusted local host instead.
BASE_URL = "http://localhost"


def local_client(app: FastAPI, **kwargs: Any) -> TestClient:
    return TestClient(app, base_url=BASE_URL, **kwargs)


@pytest.fixture
def settings(database_url: str) -> Settings:
    # The default test app is the full development app with local-owner
    # access on, so read-back tests can use GET. Tests of the disabled state
    # build their own settings (tests/test_local_owner_scope.py).
    # _env_file=None: never pick up a developer's backend/.env during tests.
    return Settings(
        env="development", local_owner_access=True, database_url=database_url, _env_file=None
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app = create_app(settings)
    with local_client(app) as test_client:
        yield test_client
    app.state.engine.dispose()


@pytest.fixture
def engine(database_url: str) -> Iterator[Engine]:
    db_engine = create_db_engine(database_url)
    yield db_engine
    db_engine.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    with create_session_factory(engine)() as session:
        yield session
