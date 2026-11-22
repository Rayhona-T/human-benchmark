"""GET /api/v1/health: process up, database reachable, schema current."""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..database import schema_state
from ..schemas import HealthOut
from . import API_PREFIX

router = APIRouter(prefix=API_PREFIX, tags=["health"])


@router.get(
    "/health",
    response_model=HealthOut,
    responses={503: {"model": HealthOut, "description": "Database unreachable or not migrated"}},
)
def health(request: Request) -> JSONResponse:
    database = schema_state(request.app.state.engine)
    body = HealthOut(
        status="ok" if database == "ok" else "unavailable",
        api_version="v1",
        database=database,
    )
    return JSONResponse(status_code=200 if database == "ok" else 503, content=body.model_dump())
