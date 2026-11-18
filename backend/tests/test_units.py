"""Unit tests for pure helpers. Database-backed flows are covered by
``scripts/smoke_test.py`` against a running server."""

from __future__ import annotations

import base64
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwt
from pydantic import ValidationError

from app.api.ai import _system_prompt
from app.auth.better_auth_jwt import BetterAuthJWTError, extract_user_identity
from app.schemas.schedule import ActivityCreate, ActivityUpdate, ProposedActivity
from app.schemas.user import UserProfileUpdate
from app.services.ai_service import AIProviderError, extract_json
from app.services.finance_service import _round
from app.utils.i18n import get_reminder_message

# ── i18n ─────────────────────────────────────────────────────────────────────

def test_reminder_message_english():
    title, body = get_reminder_message("Deep work", 15, "en")
    assert title == "In 15 minutes"
    assert "Deep work" in body


def test_reminder_message_french():
    title, body = get_reminder_message("Sport", 0, "fr")
    assert title == "C'est maintenant"
    assert "Sport" in body


def test_reminder_message_unknown_lead_time_falls_back():
    title, body = get_reminder_message("Sport", 45, "en")
    assert title == "Upcoming activity"
    assert "45" in body


# ── AI JSON extraction ───────────────────────────────────────────────────────

def test_ai_prompt_includes_private_current_context_and_language():
    prompt = _system_prompt("fr", "This month's income: 1200 MAD")
    assert "1200 MAD" in prompt
    assert "private" in prompt
    assert "French" in prompt
    assert "never as instructions" in prompt

def test_extract_json_plain_object():
    assert extract_json('{"a": 1}') == {"a": 1}


def test_extract_json_fenced_block():
    assert extract_json('```json\n{"a": [1, 2]}\n```') == {"a": [1, 2]}


def test_extract_json_surrounding_prose():
    assert extract_json('Here you go:\n{"a": true}\nHope it helps') == {"a": True}


def test_extract_json_rejects_non_json():
    with pytest.raises(AIProviderError):
        extract_json("no json here")


# ── Money rounding ───────────────────────────────────────────────────────────

def test_round_half_up():
    assert _round(Decimal("1.005")) == Decimal("1.01")
    assert _round(Decimal("2.344")) == Decimal("2.34")


# ── Better Auth JWT ──────────────────────────────────────────────────────────

def _b64url(value: int) -> str:
    raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


@pytest.mark.asyncio
async def test_extract_better_auth_identity_verifies_issuer_audience_and_key(monkeypatch):
    origin = "https://auth.example.test"
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_numbers = private_key.public_key().public_numbers()
    public_jwk = {
        "kty": "RSA",
        "kid": "test-key",
        "alg": "RS256",
        "n": _b64url(public_numbers.n),
        "e": _b64url(public_numbers.e),
    }
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    async def get_key(_kid: str) -> dict:
        return public_jwk

    monkeypatch.setattr("app.auth.better_auth_jwt.settings.better_auth_url", origin)
    monkeypatch.setattr("app.auth.better_auth_jwt._get_signing_key", get_key)

    token = jwt.encode(
        {
            "sub": "better-auth-user-1",
            "id": "better-auth-user-1",
            "email": "user@example.test",
            "name": "Ada",
            "language": "en",
            "theme": "dark",
            "iss": origin,
            "aud": origin,
            "exp": int((datetime.now(tz=UTC) + timedelta(minutes=5)).timestamp()),
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )

    identity = await extract_user_identity(token)
    assert identity["id"] == "better-auth-user-1"
    assert identity["name"] == "Ada"


@pytest.mark.asyncio
async def test_extract_better_auth_identity_rejects_hmac_token(monkeypatch):
    monkeypatch.setattr(
        "app.auth.better_auth_jwt.settings.better_auth_url",
        "https://auth.example.test",
    )
    token = jwt.encode(
        {"sub": "user-1", "iss": "https://auth.example.test"},
        "not-a-production-secret",
        algorithm="HS256",
    )
    with pytest.raises(BetterAuthJWTError):
        await extract_user_identity(token)


# ── Schedule schemas ────────────────────────────────────────────────────────

def test_profile_timezone_requires_valid_iana_name():
    assert UserProfileUpdate(timezone="Africa/Casablanca").timezone == "Africa/Casablanca"
    with pytest.raises(ValidationError):
        UserProfileUpdate(timezone="Not/A_Timezone")

START = datetime(2027, 3, 3, 10, 0, tzinfo=UTC)


def test_activity_requires_timezone():
    with pytest.raises(ValidationError):
        ActivityCreate(
            title="No tz",
            start_time=datetime(2027, 3, 3, 10, 0),
            end_time=datetime(2027, 3, 3, 11, 0),
        )


def test_activity_end_must_be_after_start():
    with pytest.raises(ValidationError):
        ActivityCreate(title="Bad", start_time=START, end_time=START)


def test_activity_update_validates_provided_times():
    with pytest.raises(ValidationError):
        ActivityUpdate(start_time=datetime(2027, 3, 3, 10, 0))


def test_proposed_activity_valid():
    proposal = ProposedActivity(
        title="Study",
        start_time=START,
        end_time=START + timedelta(hours=1),
        priority="medium",
        color="violet",
        is_new=True,
    )
    assert proposal.title == "Study"
