"""
Application configuration using pydantic-settings.
All values are read from environment variables or a .env file.
"""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ─────────────────────────────────────────────────────────────────
    app_env: Literal["development", "production"] = "development"
    app_debug: bool = False
    app_secret_key: str = "change-me-in-production"
    backend_url: str = "http://localhost:8000"

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str

    # ── Redis / Celery ───────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Auth ─────────────────────────────────────────────────────────────────
    # Public issuer used to verify the token; the JWKS endpoint can use an
    # internal network address when the backend runs in a container.
    better_auth_url: str = ""
    better_auth_jwks_url: str = ""

    # ── CORS ─────────────────────────────────────────────────────────────────
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # ── AI ───────────────────────────────────────────────────────────────────
    ai_provider: Literal["openai", "anthropic", "gemini"] = "openai"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    ai_model_openai: str = "gpt-4o"
    ai_model_anthropic: str = "claude-3-5-sonnet-20241022"
    ai_model_gemini: str = "gemini-1.5-pro"
    ai_max_tokens: int = 2048

    # ── Email ────────────────────────────────────────────────────────────────
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@lifepilot.ai"
    smtp_from_name: str = "LifePilot AI"
    smtp_use_tls: bool = True

    # ── Web Push ─────────────────────────────────────────────────────────────
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_claims_email: str = "mailto:admin@lifepilot.ai"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def sync_database_url(self) -> str:
        """Synchronous DB URL for Alembic migrations."""
        return self.database_url.replace(
            "postgresql+asyncpg://", "postgresql+psycopg2://"
        ).replace("postgresql://", "postgresql+psycopg2://")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
