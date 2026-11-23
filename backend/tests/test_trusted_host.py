"""Host-header allowlist (Starlette TrustedHostMiddleware) and DNS rebinding.

Requests are sent straight to the ASGI app with exact raw headers, so no
HTTP client can normalize or refuse a hostile value before the app sees it.
A live check against a running Uvicorn server is recorded in
docs/backend/API.md ("Host header").
"""

import asyncio
import json
import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.main import TRUSTED_HOSTS
from app.models import ExperimentSession
from tests.factories import session_payload

SESSIONS = "/api/v1/sessions"


def raw_request(
    app: FastAPI,
    method: str,
    path: str,
    headers: list[tuple[bytes, bytes]],
    body: bytes = b"",
) -> tuple[int, bytes]:
    """One HTTP request through the whole middleware stack."""
    messages: list[dict[str, Any]] = []
    delivered = False

    async def receive() -> dict[str, Any]:
        nonlocal delivered
        if not delivered:
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message: dict[str, Any]) -> None:
        messages.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": headers,
        "client": ("127.0.0.1", 50000),
        "server": ("127.0.0.1", 8000),
    }
    asyncio.run(app(scope, receive, send))  # type: ignore[arg-type]
    start = next(m for m in messages if m["type"] == "http.response.start")
    content = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
    return start["status"], content


def host(value: str) -> list[tuple[bytes, bytes]]:
    return [(b"host", value.encode("latin-1"))]


def app_of(client: TestClient) -> FastAPI:
    app = client.app
    assert isinstance(app, FastAPI)
    return app


def count_sessions(db: Session) -> int:
    return int(db.scalar(select(func.count()).select_from(ExperimentSession)) or 0)


def test_only_localhost_and_loopback_are_trusted() -> None:
    assert TRUSTED_HOSTS == ("localhost", "127.0.0.1")


@pytest.mark.parametrize(
    "value",
    [
        "localhost",
        "localhost:8000",
        "127.0.0.1",
        "127.0.0.1:8000",
        "127.0.0.1:5173",
        "LOCALHOST:8000",  # host names are case-insensitive
    ],
)
def test_trusted_hosts_on_any_port_are_accepted(client: TestClient, value: str) -> None:
    status, _ = raw_request(app_of(client), "GET", "/api/v1/health", host(value))
    assert status == 200


@pytest.mark.parametrize(
    "value",
    [
        "testserver",
        "evil.example",
        "evil.example:8000",
        "localhost.evil.example",  # a suffix trick
        "sub.localhost",
        "127.0.0.1.nip.io",  # a public name that resolves to 127.0.0.1
        "localhost.",  # trailing-dot form is not on the list
        "127.0.0.2",
        "0.0.0.0",  # noqa: S104 - a Host header value under test, not a bind address
        "[::1]",
        "[::1]:8000",
        "localhost:abc",  # malformed port
        "localhost:8000:1",
        "localhost:",
        "localhost@evil.example",
        "evil.example@localhost",
        "localhost/evil",
        "localhost evil",
        " localhost",
        "",
    ],
)
def test_untrusted_or_malformed_hosts_are_rejected(client: TestClient, value: str) -> None:
    status, content = raw_request(app_of(client), "GET", "/api/v1/health", host(value))
    assert status == 400
    assert content == b"Invalid host header"


def test_a_request_without_a_host_header_is_rejected(client: TestClient) -> None:
    status, _ = raw_request(app_of(client), "GET", "/api/v1/health", [])
    assert status == 400


def test_the_test_client_default_host_is_refused(client: TestClient) -> None:
    # Proves the allowlist is active through a real HTTP client as well.
    response = client.get("/api/v1/health", headers={"host": "testserver"})
    assert response.status_code == 400


# --- DNS rebinding ------------------------------------------------------------
# A hostile page at http://rebind.attacker.example:8000 whose name has been
# re-pointed to 127.0.0.1. The browser treats it as same-origin, so CORS does
# not apply; only the Host header gives it away.

REBIND = "rebind.attacker.example:8000"
REBIND_HEADERS = [
    (b"host", REBIND.encode()),
    (b"origin", f"http://{REBIND}".encode()),
    (b"content-type", b"application/json"),
]


def test_rebinding_page_cannot_list_or_read_sessions(client: TestClient) -> None:
    created = client.post(SESSIONS, json=session_payload()).json()
    for path in (SESSIONS, f"{SESSIONS}/{created['session_id']}"):
        status, content = raw_request(app_of(client), "GET", path, REBIND_HEADERS)
        assert status == 400
        assert created["session_id"].encode() not in content


def test_rebinding_page_cannot_delete_anything(client: TestClient, db: Session) -> None:
    created = client.post(SESSIONS, json=session_payload()).json()
    confirm = json.dumps({"confirm": "delete-all-local-sessions"}).encode()

    status_all, _ = raw_request(app_of(client), "DELETE", SESSIONS, REBIND_HEADERS, confirm)
    status_one, _ = raw_request(
        app_of(client), "DELETE", f"{SESSIONS}/{created['session_id']}", REBIND_HEADERS
    )

    assert (status_all, status_one) == (400, 400)
    assert count_sessions(db) == 1


def test_rebinding_page_cannot_save_a_session(client: TestClient, db: Session) -> None:
    body = json.dumps(session_payload(client_session_id=str(uuid.uuid4()))).encode()
    status, _ = raw_request(app_of(client), "POST", SESSIONS, REBIND_HEADERS, body)
    assert status == 400
    assert count_sessions(db) == 0


def test_rebinding_preflight_is_rejected_before_cors(client: TestClient) -> None:
    status, _ = raw_request(
        app_of(client),
        "OPTIONS",
        SESSIONS,
        [
            (b"host", REBIND.encode()),
            (b"origin", b"http://localhost:5173"),
            (b"access-control-request-method", b"DELETE"),
        ],
    )
    assert status == 400
