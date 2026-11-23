"""Application factory. Run with `python -m app` (see backend/README.md)."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import Settings, get_settings
from .database import create_db_engine, create_session_factory
from .errors import register_error_handlers
from .middleware import BodySizeLimitMiddleware, RequestLogMiddleware
from .routes import health, sessions
from .scope import local_owner_enabled

# The only Host header names accepted (any port). Anything else, including a
# DNS-rebinding name that resolves to 127.0.0.1, gets 400 before routing.
TRUSTED_HOSTS = ("localhost", "127.0.0.1")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level, format="%(levelname)s %(name)s: %(message)s")

    app = FastAPI(
        title="HUMAN BENCHMARK API",
        version="0.1.0",
        description=(
            "Local development only. Opt-in session saving (Cycle 8) and, when "
            "explicitly enabled in development, local-owner session history "
            "and deletion (Cycle 9). Not for real participant data."
        ),
        debug=False,
    )
    app.state.settings = settings
    app.state.engine = create_db_engine(settings.database_url)
    app.state.session_factory = create_session_factory(app.state.engine)

    register_error_handlers(app)
    # Middleware added later wraps earlier ones. Resulting order, outer to
    # inner: request log -> trusted host -> CORS -> size limit -> app.
    # The Host check runs before CORS (so a hostile Host is refused even for
    # preflights). CORS wraps the size limit so a 413 still carries CORS
    # headers and a browser can read it.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
        allow_credentials=False,
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(TRUSTED_HOSTS), www_redirect=False)
    app.add_middleware(RequestLogMiddleware)

    app.include_router(health.router)
    app.include_router(sessions.router)
    # Fail closed: outside development with explicit local-owner access, the
    # read and delete routes do not exist at all (require_owner_scope also
    # re-checks on every request).
    if local_owner_enabled(settings):
        app.include_router(sessions.owner_router)
    return app
