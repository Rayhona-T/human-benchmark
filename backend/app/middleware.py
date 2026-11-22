"""ASGI middleware: request-size limit and privacy-safe request logging."""

import json
import logging
import time
from typing import Any

from fastapi import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("human_benchmark.requests")

_TOO_LARGE = json.dumps(
    {"error": {"code": "payload_too_large", "message": "The request body is too large."}}
).encode()


class _BodyTooLarge(HTTPException):
    """Raised while streaming; FastAPI re-raises HTTPExceptions unchanged, so
    the error handler turns it into the standard 413 envelope."""

    def __init__(self) -> None:
        super().__init__(status_code=413)


class BodySizeLimitMiddleware:
    """Rejects bodies over `max_bytes` with 413, before they are parsed.

    Checks Content-Length up front and also counts streamed bytes, so a
    missing or false Content-Length cannot bypass the limit.
    """

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    declared = self.max_bytes + 1
                if declared > self.max_bytes:
                    await _send_413(send)
                    return

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _BodyTooLarge
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            if not response_started:
                await _send_413(send)


async def _send_413(send: Send) -> None:
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(_TOO_LARGE)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": _TOO_LARGE})


class RequestLogMiddleware:
    """Logs method, route template, status and duration only.

    No client IP, query string, headers or body is logged, and the route
    template (/api/v1/sessions/{session_id}) is logged instead of the raw
    path, so session IDs do not appear in logs either.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        start = time.perf_counter()
        status: dict[str, Any] = {"code": 500}

        async def capture(message: Message) -> None:
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, capture)
        finally:
            route = scope.get("route")
            path = getattr(route, "path", "unmatched")
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.info("%s %s %s %.1fms", scope["method"], path, status["code"], elapsed_ms)
