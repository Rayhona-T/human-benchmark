"""Cross-stack contract: payloads produced by the FRONTEND mapping are accepted.

The JSON files are written by the frontend's own mapping
(frontend/src/experiments/shared/persistence/sessionPayload.ts):
  - "<experiment>-save-payload.json": records built from the real schedule
    generators (sessionPayload.test.ts);
  - "<experiment>-engine-save-payload.json": the request body captured when a
    full session runs through the REAL engine and page, then is saved
    (experimentSave.test.tsx).
Frontend tests check the mapping still produces exactly these files. Here
they go through the real backend validation and storage. If either side
drifts, one of the two tests fails.
"""

import json
import re
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.consent import ACCEPTED_NOTICES
from app.models import ExperimentSession, Trial

PERSISTENCE = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "src"
    / "experiments"
    / "shared"
    / "persistence"
)


FIXTURES = [
    "stroop-save-payload",
    "flanker-save-payload",
    "stroop-engine-save-payload",
    "flanker-engine-save-payload",
]


def fixture(name: str) -> dict[str, Any]:
    path = PERSISTENCE / "__fixtures__" / f"{name}.json"
    loaded: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return loaded


@pytest.mark.parametrize("name", FIXTURES)
def test_frontend_payload_is_accepted_and_stored_exactly(
    client: TestClient, db: Session, name: str
) -> None:
    payload = fixture(name)

    response = client.post("/api/v1/sessions", json=payload)

    assert response.status_code == 201, response.text
    assert response.json()["trials_stored"] == {"practice": 12, "main": 60}
    stored = client.get(f"/api/v1/sessions/{response.json()['session_id']}").json()
    assert stored["trials"] == payload["trials"]
    assert stored["randomization"] == payload["randomization"]
    assert db.scalar(select(func.count()).select_from(ExperimentSession)) == 1
    assert db.scalar(select(func.count()).select_from(Trial)) == 72


@pytest.mark.parametrize("name", FIXTURES)
def test_frontend_payload_contains_no_engine_identifiers(name: str) -> None:
    text = json.dumps(fixture(name))
    for forbidden in ("ENGINE-SESSION-ID-MUST-NOT-BE-SENT", "sessionId", "trialId", "inkHex"):
        assert forbidden not in text


def test_frontend_notice_matches_the_backend_allowlist() -> None:
    config = (PERSISTENCE / "saveConfig.ts").read_text(encoding="utf-8")
    match = re.search(r'version: "([^"]+)"', config)
    assert match
    version = match.group(1)
    assert version in ACCEPTED_NOTICES
    # Both sides agree the notice is provisional and not approved.
    assert ACCEPTED_NOTICES[version].approved_for_participant_data is False
    assert "approvedForParticipantData: false" in config
