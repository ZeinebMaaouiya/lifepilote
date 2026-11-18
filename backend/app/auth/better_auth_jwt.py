"""Verify short-lived Better Auth JWTs using the app's public JWKS endpoint."""

from __future__ import annotations

import time

import httpx
from jose import JWTError, jwt

from app.config import settings


class BetterAuthJWTError(Exception):
    """Raised when a Better Auth JWT cannot be safely validated."""


_JWKS_CACHE: dict[str, dict] = {}
_JWKS_EXPIRES_AT = 0.0


async def _get_signing_key(kid: str) -> dict:
    global _JWKS_CACHE, _JWKS_EXPIRES_AT

    origin = settings.better_auth_url.rstrip("/")
    if not origin:
        raise BetterAuthJWTError("Authentication issuer is not configured.")

    if time.monotonic() >= _JWKS_EXPIRES_AT or kid not in _JWKS_CACHE:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{origin}/auth/api/jwks")
                response.raise_for_status()
                document = response.json()
                keys = document.get("keys", []) if isinstance(document, dict) else []
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            raise BetterAuthJWTError("Authentication signing keys are unavailable.") from exc

        _JWKS_CACHE = {
            key["kid"]: key
            for key in keys
            if isinstance(key, dict) and isinstance(key.get("kid"), str)
        }
        _JWKS_EXPIRES_AT = time.monotonic() + 300

    key = _JWKS_CACHE.get(kid)
    if not key:
        raise BetterAuthJWTError("Authentication signing key was not found.")
    return key


async def extract_user_identity(token: str) -> dict:
    """Return identity claims only after signature, issuer, and audience checks."""
    origin = settings.better_auth_url.rstrip("/")
    if not origin:
        raise BetterAuthJWTError("Authentication issuer is not configured.")

    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if header.get("alg") != "RS256" or not isinstance(kid, str):
            raise BetterAuthJWTError("Unsupported authentication token.")

        key = await _get_signing_key(kid)
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=origin,
            audience=origin,
        )
    except BetterAuthJWTError:
        raise
    except JWTError as exc:
        raise BetterAuthJWTError("Authentication token is invalid or expired.") from exc

    user_id = payload.get("sub") or payload.get("id")
    if not isinstance(user_id, str) or not user_id:
        raise BetterAuthJWTError("Authentication token is missing its subject.")

    return {
        "id": user_id,
        "email": payload.get("email", ""),
        "name": payload.get("name", ""),
        "language": payload.get("language", "en"),
        "theme": payload.get("theme", "dark"),
    }
