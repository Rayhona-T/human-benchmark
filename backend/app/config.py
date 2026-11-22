"""Application settings, read from HB_* environment variables or backend/.env.

Every value is validated at start-up so a mistake fails loudly instead of
running with an unsafe or surprising configuration.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATABASE_URL = f"sqlite:///{(BACKEND_DIR / 'human_benchmark.db').as_posix()}"
DEFAULT_CORS_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="HB_",
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Only local environments exist until the deployment blockers in
    # docs/backend/BACKEND_ARCHITECTURE.md §9 are resolved.
    env: Literal["development", "test"] = "development"
    database_url: str = DEFAULT_DATABASE_URL
    cors_origins: Annotated[tuple[str, ...], NoDecode] = DEFAULT_CORS_ORIGINS
    max_request_bytes: int = Field(default=256 * 1024, ge=1024, le=2 * 1024 * 1024)
    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    @field_validator("database_url")
    @classmethod
    def _supported_database(cls, value: str) -> str:
        if not value.startswith(("sqlite:///", "postgresql")):
            raise ValueError("HB_DATABASE_URL must be a sqlite:/// or postgresql URL")
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return tuple(part.strip() for part in value.split(",") if part.strip())
        return value

    @field_validator("cors_origins")
    @classmethod
    def _explicit_origins(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        for origin in value:
            if origin == "*" or not origin.startswith(("http://", "https://")):
                raise ValueError(
                    "HB_CORS_ORIGINS must list explicit http(s) origins; '*' is not allowed"
                )
            if origin.endswith("/"):
                raise ValueError("CORS origins must not end with '/'")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
