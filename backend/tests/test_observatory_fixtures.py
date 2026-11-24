"""Fixture drift check for the Observatory stored-session fixtures.

The frontend tests read stored sessions from
frontend/src/experiments/shared/observatory/__fixtures__/*-stored-{detail,list}.json.
Those files were recorded from the real backend by
scripts/generate_observatory_fixtures.py. This test replays each save payload
through the real API (on this test's own temporary database) and checks that
the backend still returns exactly what the committed fixtures contain, so a
change to the stored-session contract cannot leave the frontend tests running
against stale data.

Only the values the backend assigns per save (session ID and save time) are
normalized. Everything else must match exactly. When this fails after an
intended contract change, regenerate the fixtures with the script and review
the diff.
"""

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[2]
PAYLOADS = REPO_ROOT / "frontend/src/experiments/shared/persistence/__fixtures__"
STORED = REPO_ROOT / "frontend/src/experiments/shared/observatory/__fixtures__"
ASSIGNED_PER_SAVE = ("session_id", "created_at")
REGENERATE = "regenerate it with scripts/generate_observatory_fixtures.py"
STEMS = sorted(
    path.name.removesuffix("-save-payload.json") for path in PAYLOADS.glob("*-save-payload.json")
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def normalized(session: dict[str, Any]) -> dict[str, Any]:
    for key in ASSIGNED_PER_SAVE:
        assert key in session, f"backend response lacks {key}"
    return {key: value for key, value in session.items() if key not in ASSIGNED_PER_SAVE}


def test_every_payload_has_stored_fixtures() -> None:
    assert STEMS == ["flanker", "flanker-engine", "stroop", "stroop-engine"]
    for stem in STEMS:
        assert (STORED / f"{stem}-stored-detail.json").is_file(), stem
        assert (STORED / f"{stem}-stored-list.json").is_file(), stem


@pytest.mark.parametrize("stem", STEMS)
def test_stored_fixtures_match_the_current_backend(client: TestClient, stem: str) -> None:
    payload = read_json(PAYLOADS / f"{stem}-save-payload.json")
    created = client.post("/api/v1/sessions", json=payload)
    assert created.status_code == 201, created.text
    session_id = created.json()["session_id"]

    detail = client.get(f"/api/v1/sessions/{session_id}")
    assert detail.status_code == 200, detail.text
    expected_detail = read_json(STORED / f"{stem}-stored-detail.json")
    assert normalized(detail.json()) == normalized(expected_detail), (
        f"{stem}-stored-detail.json is stale; {REGENERATE}"
    )

    listing = client.get("/api/v1/sessions")
    assert listing.status_code == 200, listing.text
    actual_list = listing.json()
    expected_list = read_json(STORED / f"{stem}-stored-list.json")
    assert actual_list.keys() == expected_list.keys()
    assert actual_list["next_cursor"] == expected_list["next_cursor"]
    assert [normalized(s) for s in actual_list["sessions"]] == [
        normalized(s) for s in expected_list["sessions"]
    ], f"{stem}-stored-list.json is stale; {REGENERATE}"
