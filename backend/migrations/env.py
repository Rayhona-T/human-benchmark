"""Alembic environment: uses the app's settings and models.

The URL comes from (in order): a URL passed programmatically by the tests,
then HB_DATABASE_URL / backend/.env via app settings.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import get_settings
from app.database import configure_sqlite_connection
from app.models import Base

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logging", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata
database_url = config.attributes.get("database_url") or get_settings().database_url


def run_migrations_offline() -> None:
    """Render SQL without connecting (e.g. `alembic upgrade head --sql`)."""
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=database_url.startswith("sqlite"),
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        {"sqlalchemy.url": database_url}, prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    if connectable.dialect.name == "sqlite":
        from sqlalchemy import event

        event.listen(connectable, "connect", configure_sqlite_connection)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=connection.dialect.name == "sqlite",
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
