"""Database engine and session management."""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import Request
from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from .config import BACKEND_DIR

ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


def create_db_engine(database_url: str) -> Engine:
    connect_args: dict[str, Any] = {}
    if database_url.startswith("sqlite"):
        # FastAPI may run a request in a worker thread different from the one
        # that opened the pooled connection; each request still uses one
        # connection at a time.
        connect_args["check_same_thread"] = False
    engine = create_engine(
        database_url,
        connect_args=connect_args,
        # Database errors must never carry participant values into logs.
        hide_parameters=True,
        pool_pre_ping=True,
    )
    if engine.dialect.name == "sqlite":
        event.listen(engine, "connect", _enable_sqlite_foreign_keys)
    return engine


def _enable_sqlite_foreign_keys(dbapi_connection: Any, _record: Any) -> None:
    # SQLite ignores FOREIGN KEY constraints (including ON DELETE CASCADE)
    # unless this is switched on for every new connection.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one database session per request, always closed."""
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as session:
        yield session


def alembic_config(database_url: str) -> Config:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(Path(BACKEND_DIR, "migrations")))
    config.attributes["database_url"] = database_url
    return config


def head_revision() -> str | None:
    script = ScriptDirectory.from_config(alembic_config("sqlite://"))
    return script.get_current_head()


def schema_state(engine: Engine) -> str:
    """'ok', 'schema_not_current', or 'unreachable'."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            try:
                current = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one_or_none()
            except Exception:
                return "schema_not_current"
    except Exception:
        return "unreachable"
    return "ok" if current == head_revision() else "schema_not_current"
