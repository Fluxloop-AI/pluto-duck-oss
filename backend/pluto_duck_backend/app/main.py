"""FastAPI application factory for the Pluto-Duck backend."""

from __future__ import annotations

import time
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request

from pluto_duck_backend import __version__
from pluto_duck_backend.app.api.router import api_router
from pluto_duck_backend.app.core.config import get_settings, PlutoDuckSettings


def _configure_logging(settings: PlutoDuckSettings) -> None:
    """Configure application logging destinations."""

    log_file = settings.data_dir.logs / "backend.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(log_file, encoding="utf-8"),
        ],
        force=True,
    )


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""

    # Ensure settings and filesystem layout are prepared during startup
    settings = get_settings()

    _configure_logging(settings)
    
    # Initialize database tables during startup to avoid race conditions
    from pluto_duck_backend.app.services.chat.repository import get_chat_repository
    try:
        _ = get_chat_repository()
        logging.info("Database tables initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize database tables: {e}")

    app = FastAPI(
        title="Pluto-Duck API",
        version=__version__,
    )

    request_logger = logging.getLogger("pluto_duck_backend.http")

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.time()
        try:
            response = await call_next(request)
        except Exception:
            request_logger.exception("request_failed method=%s path=%s", request.method, request.url.path)
            raise
        finally:
            duration_ms = int((time.time() - start) * 1000)
            # Keep it short; this is for "did the request reach the backend?" debugging.
            request_logger.info(
                "request method=%s path=%s status=%s duration_ms=%s",
                request.method,
                request.url.path,
                getattr(locals().get("response"), "status_code", "ERR"),
                duration_ms,
            )
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Local-first; tighten once auth is added
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
    )

    @app.get("/health", tags=["health"], summary="Health check")
    def health() -> dict[str, str]:
        """Return a simple status payload for readiness checks."""

        return {
            "status": "ok",
            "version": __version__,
            "provider": settings.agent.provider,
        }

    app.include_router(api_router)

    return app


# ASGI entrypoint for uvicorn / hypercorn
app = create_app()


