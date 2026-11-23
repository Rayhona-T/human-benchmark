"""Regenerates the Observatory stored-session fixtures from the REAL backend.

For each frontend save-contract fixture
(frontend/src/experiments/shared/persistence/__fixtures__/*.json), this:
  1. creates a fresh temporary SQLite database with the real migrations;
  2. saves the payload through the real backend (POST /api/v1/sessions);
  3. records the real responses of GET /api/v1/sessions/{id} and
     GET /api/v1/sessions into
     frontend/src/experiments/shared/observatory/__fixtures__/.

It never touches backend/human_benchmark.db or backend/.env, and writes only
those fixture files. Session IDs and save times come from the backend, so
they change on every run.

Run from the repository root with the backend's virtualenv:
    backend/.venv/Scripts/python scripts/generate_observatory_fixtures.py
"""

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
SOURCE = ROOT / "frontend/src/experiments/shared/persistence/__fixtures__"
TARGET = ROOT / "frontend/src/experiments/shared/observatory/__fixtures__"
sys.path.insert(0, str(BACKEND))

from alembic import command  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import Settings  # noqa: E402
from app.database import alembic_config  # noqa: E402
from app.main import create_app  # noqa: E402


def write(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for source in sorted(SOURCE.glob("*-save-payload.json")):
        payload = json.loads(source.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as folder:
            url = f"sqlite:///{(Path(folder) / 'fixture.db').as_posix()}"
            config = alembic_config(url)
            config.attributes["configure_logging"] = False
            command.upgrade(config, "head")
            app = create_app(
                Settings(env="development", local_owner_access=True, database_url=url, _env_file=None)
            )
            try:
                with TestClient(app, base_url="http://localhost") as client:
                    created = client.post("/api/v1/sessions", json=payload)
                    created.raise_for_status()
                    session_id = created.json()["session_id"]
                    detail = client.get(f"/api/v1/sessions/{session_id}")
                    detail.raise_for_status()
                    listing = client.get("/api/v1/sessions")
                    listing.raise_for_status()
            finally:
                app.state.engine.dispose()
        stem = source.name.removesuffix("-save-payload.json")
        write(TARGET / f"{stem}-stored-detail.json", detail.json())
        write(TARGET / f"{stem}-stored-list.json", listing.json())
        print(f"{source.name} -> {stem}-stored-detail.json, {stem}-stored-list.json")


if __name__ == "__main__":
    main()
