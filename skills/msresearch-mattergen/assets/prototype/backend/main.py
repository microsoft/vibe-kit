from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import generation, evaluation, properties, demo, naming
from config import get_settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="MatterGen Prototype Backend")

    # Log startup configuration
    logger.info("=" * 60)
    logger.info("STARTING MATTERGEN BACKEND")
    logger.info("=" * 60)
    logger.info(f"CWD: {os.getcwd()}")

    settings = get_settings()
    logger.info(
        f"MATTERSIM_ENDPOINT_URL: {settings.mattersim_endpoint_url or 'NOT SET'}"
    )
    logger.info(f"MATTERSIM_USE_ENTRA_AUTH: {settings.mattersim_use_entra_auth}")
    logger.info("=" * 60)

    # CORS configuration for deployment and local development
    # Note: In production, the frontend nginx proxies /api requests, so CORS is less
    # critical there. These origins are for direct API access and local dev.
    # Add your deployment URLs here when deploying to a new environment.
    allowed_origins = [
        # Local development (Vite dev server)
        "http://localhost:3010",
        "http://127.0.0.1:3010",
        # Add your production URLs here, e.g.:
        # "https://your-app.azurewebsites.net",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(generation.router)
    app.include_router(evaluation.router)
    app.include_router(properties.router)
    app.include_router(demo.router)
    app.include_router(naming.router)

    @app.get("/api/health")
    async def health() -> dict[str, str]:  # pragma: no cover - trivial
        return {"status": "ok"}

    return app


app = create_app()
