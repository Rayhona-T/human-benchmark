"""Application factory. Run with `python -m app` (see backend/README.md)."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .database import create_db_engine, create_session_factory
from .errors import register_error_handlers
from .middleware import BodySizeLimitMiddleware, RequestLogMiddleware
from .routes import health, sessions


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level, format="%(levelname)s %(name)s: %(message)s")

    app = FastAPI(
        title="HUMAN BENCHMARK API",
        version="0.1.0",
        description=(
            "Backend foundation (Cycle 8). Local development only; "
            "not connected to the experiments yet."
        ),
        debug=False,
    )
    app.state.settings = settings
    app.state.engine = create_db_engine(settings.database_url)
    app.state.session_factory = create_session_factory(app.state.engine)

    register_error_handlers(app)
    # Middleware added later wraps earlier ones. Resulting order, outer to
    # inner: request log -> CORS -> size limit -> app. CORS wraps the size
    # limit so a 413 still carries CORS headers and a browser can read it.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
        allow_credentials=False,
    )
    app.add_middleware(RequestLogMiddleware)

    app.include_router(health.router)
    app.include_router(sessions.router)
    return app
