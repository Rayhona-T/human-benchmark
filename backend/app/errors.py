"""One error envelope for every failure, with no internals and no echoed input.

{"error": {"code": "...", "message": "...", "details": [{"location", "message"}]}}
"""

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("human_benchmark")

MAX_DETAILS = 50

_STATUS_CODES = {
    400: ("bad_request", "The request could not be processed."),
    404: ("not_found", "The requested resource was not found."),
    405: ("method_not_allowed", "This method is not allowed for this resource."),
    413: ("payload_too_large", "The request body is too large."),
    415: ("unsupported_media_type", "The request body must be JSON."),
}


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Sequence[dict[str, str]] = (),
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = list(details)


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: Sequence[dict[str, str]] = (),
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {"code": code, "message": message}
    if details:
        body["details"] = list(details)[:MAX_DETAILS]
    return JSONResponse(status_code=status_code, content={"error": body}, headers=headers)


def _location(parts: Sequence[int | str]) -> str:
    text = ""
    for part in parts:
        if isinstance(part, int):
            text += f"[{part}]"
        else:
            text += f".{part}" if text else str(part)
    return text


def _validation_details(error: RequestValidationError) -> list[dict[str, str]]:
    details = []
    for item in error.errors():
        # Only the location and message are kept: Pydantic's "input" and
        # "ctx" can contain the submitted (participant) values.
        location = list(item.get("loc", ()))
        if location and location[0] == "body":
            location = location[1:]
        details.append({"location": _location(location) or "body", "message": str(item["msg"])})
    return details


async def _api_error(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiError)
    return error_response(exc.status_code, exc.code, exc.message, exc.details)


async def _request_validation(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    return error_response(
        422,
        "invalid_request",
        "The request body is not valid. See details.",
        _validation_details(exc),
    )


async def _http_error(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code, message = _STATUS_CODES.get(exc.status_code, ("http_error", "The request failed."))
    return error_response(exc.status_code, code, message, headers=exc.headers)


async def _unexpected(request: Request, exc: Exception) -> JSONResponse:
    # The exception type and route are logged for debugging; the response is
    # generic. Database errors carry no values (hide_parameters=True).
    route = request.scope.get("route")
    path = getattr(route, "path", "unmatched")
    logger.error("unhandled %s on %s %s", type(exc).__name__, request.method, path, exc_info=exc)
    return error_response(500, "internal_error", "An unexpected error occurred.")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error)
    app.add_exception_handler(RequestValidationError, _request_validation)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(Exception, _unexpected)
