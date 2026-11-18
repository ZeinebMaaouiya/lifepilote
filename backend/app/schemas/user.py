"""Pydantic schemas for user profile and preferences."""

from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator


class UserProfileOut(BaseModel):
    id: str
    payload_user_id: str
    first_name: str
    email: str
    language: str
    theme: str
    timezone: str
    currency: str
    simplified_ui: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    first_name: str | None = Field(None, max_length=80)
    timezone: str | None = Field(None, max_length=50)
    currency: str | None = Field(None, max_length=5)
    simplified_ui: bool | None = None
    language: Literal["en", "fr"] | None = None
    theme: Literal["dark", "light"] | None = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Timezone must be a valid IANA timezone.") from exc
        return value


class NotificationPrefOut(BaseModel):
    id: str
    enabled: bool
    reminder_minutes: list[int]
    in_app_enabled: bool
    push_enabled: bool
    email_enabled: bool
    weekly_summary_enabled: bool
    spending_alerts_enabled: bool

    model_config = {"from_attributes": True}


class NotificationPrefUpdate(BaseModel):
    enabled: bool | None = None
    reminder_minutes: list[int] | None = Field(None, min_length=1, max_length=10)
    in_app_enabled: bool | None = None
    push_enabled: bool | None = None
    email_enabled: bool | None = None
    weekly_summary_enabled: bool | None = None
    spending_alerts_enabled: bool | None = None


class SyncRequest(BaseModel):
    """Identity sent by Next.js to sync a verified Better Auth session."""
    auth_user_id: str
    email: str
    first_name: str
    language: Literal["en", "fr"] = "en"
    theme: Literal["dark", "light"] = "dark"
