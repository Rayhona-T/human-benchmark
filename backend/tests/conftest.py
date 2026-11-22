"""Test fixtures: every test gets its own temporary SQLite file, created by
running the real Alembic migrations. The developer's database and backend/.env
are never read."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from fastapi.testclient import TestClient
from sqlalchemy import Engine
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


@pytest.fixture
def database_url(tmp_path: Path) -> str:
    url = sqlite_url(tmp_path / "test.db")
    migrate(url)
    return url


@pytest.fixture
def settings(database_url: str) -> Settings:
    # _env_file=None: never pick up a developer's backend/.env during tests.
    return Settings(env="test", database_url=database_url, _env_file=None)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app = create_app(settings)
    with TestClient(app) as test_client:
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
