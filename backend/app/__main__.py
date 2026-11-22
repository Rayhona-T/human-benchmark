"""`python -m app`: run the API with privacy-safe defaults.

The Uvicorn access log is disabled because it records client IP addresses;
RequestLogMiddleware logs method, route template, status and duration instead.
"""

import uvicorn

from .config import get_settings
from .main import create_app


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        create_app(settings),
        host=settings.host,
        port=settings.port,
        access_log=False,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
