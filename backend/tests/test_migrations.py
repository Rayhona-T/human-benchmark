"""Alembic migrations: upgrade, downgrade, model parity, PostgreSQL rendering."""

import io
import re
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text

from app.database import alembic_config, create_db_engine, head_revision
from app.models import Base
from tests.conftest import migrate, postgres_test_url, sqlite_url

TABLES = {"participants", "sessions", "trials"}


def test_upgrade_creates_the_schema_at_head(tmp_path: Path) -> None:
    url = sqlite_url(tmp_path / "m.db")
    migrate(url)
    engine = create_db_engine(url)
    try:
        assert set(inspect(engine).get_table_names()) >= TABLES
        with engine.connect() as connection:
            assert MigrationContext.configure(connection).get_current_revision() == head_revision()
    finally:
        engine.dispose()


def test_migrated_schema_matches_the_models_exactly(tmp_path: Path) -> None:
    url = sqlite_url(tmp_path / "m.db")
    migrate(url)
    engine = create_db_engine(url)
    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(connection, opts={"compare_type": True})
            assert compare_metadata(context, Base.metadata) == []
    finally:
        engine.dispose()


def test_migrated_constraints_are_present(tmp_path: Path) -> None:
    url = sqlite_url(tmp_path / "m.db")
    migrate(url)
    engine = create_db_engine(url)
    try:
        inspector = inspect(engine)
        uniques = {u["name"] for u in inspector.get_unique_constraints("trials")}
        assert "uq_trials_session_phase_index" in uniques
        fk = inspector.get_foreign_keys("trials")[0]
        assert fk["referred_table"] == "sessions"
        assert fk["options"].get("ondelete") == "CASCADE"
        # SQLite's reflection drops names of CHECKs that start with "(", so
        # compare against the stored CREATE TABLE statements instead.
        with engine.connect() as connection:
            stored = " ".join(
                connection.execute(
                    text(
                        "SELECT sql FROM sqlite_master"
                        " WHERE type = 'table' AND name <> 'alembic_version'"
                    )
                )
                .scalars()
                .all()
            )
        stored_names = set(re.findall(r"CONSTRAINT (\S+)", stored))
        expected = {
            str(constraint.name)
            for table in Base.metadata.tables.values()
            for constraint in table.constraints
        }
        assert stored_names == expected
        assert "ck_trials_response_matches_outcome" in stored_names
    finally:
        engine.dispose()


def test_downgrade_to_base_removes_every_table(tmp_path: Path) -> None:
    url = sqlite_url(tmp_path / "m.db")
    migrate(url)
    config = alembic_config(url)
    config.attributes["configure_logging"] = False
    command.downgrade(config, "base")
    engine = create_db_engine(url)
    try:
        assert not TABLES & set(inspect(engine).get_table_names())
    finally:
        engine.dispose()
    migrate(url)  # and it can be re-applied


def test_postgresql_sql_renders_offline() -> None:
    """No PostgreSQL server is available here; this checks the migration
    compiles for the PostgreSQL dialect (types, CHECKs, FKs, indexes)."""
    buffer = io.StringIO()
    config = alembic_config("postgresql://render-only/human_benchmark")
    config.attributes["configure_logging"] = False
    config.output_buffer = buffer
    command.upgrade(config, "head", sql=True)
    sql = buffer.getvalue()

    assert "CREATE TABLE sessions" in sql
    assert "id UUID NOT NULL" in sql
    assert "seed BIGINT" in sql
    assert "id BIGSERIAL NOT NULL" in sql
    assert "ON DELETE CASCADE" in sql
    assert "CONSTRAINT uq_trials_session_phase_index UNIQUE (session_id, phase, trial_index)" in sql
    assert "CREATE INDEX ix_sessions_experiment_created" in sql


@pytest.mark.skipif(postgres_test_url() is None, reason="HB_TEST_POSTGRES_URL not set")
def test_live_postgresql_schema_matches_the_models(database_url: str) -> None:
    """Live PostgreSQL only: the migrated schema equals the models exactly."""
    engine = create_db_engine(database_url)
    try:
        assert engine.dialect.name == "postgresql"
        with engine.connect() as connection:
            context = MigrationContext.configure(connection, opts={"compare_type": True})
            assert compare_metadata(context, Base.metadata) == []
            assert context.get_current_revision() == head_revision()
    finally:
        engine.dispose()
