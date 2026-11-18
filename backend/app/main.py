"""
LifePilot AI — FastAPI application entry point.

Run with:  uvicorn app.main:app --reload
Docs:      http://localhost:8000/docs
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

# Importing the models package registers every mapper before create_all runs.
import app.models  # noqa: F401
from app.api.router import api_router
from app.config import settings
from app.database import Base, engine

logging.basicConfig(
    level=logging.DEBUG if settings.app_debug else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("lifepilot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Development convenience: create tables when Alembic has not been run yet.

    Production deployments run `alembic upgrade head` before starting the app.
    """
    if settings.app_env == "development":
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Development schema ensured.")
        except Exception as exc:  # pragma: no cover - depends on local DB
            logger.warning("Could not create development schema: %s", exc)

    yield
    await engine.dispose()


app = FastAPI(
    title="LifePilot AI API",
    description=(
        "Backend for LifePilot AI: budgeting, expenses, meal planning, goals, "
        "scheduling, notifications and the AI assistant."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["meta"])
async def root() -> dict:
    return {
        "name": "LifePilot AI API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["meta"], response_model=None)
async def health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("Health check failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": "unavailable"},
        )
    return {
        "status": "ok",
        "environment": settings.app_env,
        "database": "ok",
    }
