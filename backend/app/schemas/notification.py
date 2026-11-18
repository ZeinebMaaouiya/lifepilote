"""Pydantic schemas for notifications and push subscriptions."""

from datetime import datetime

from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    body: str
    status: str
    scheduled_at: datetime
    delivered_at: datetime | None
    sent_in_app: bool
    sent_push: bool
    sent_email: bool
    activity_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListOut(BaseModel):
    items: list[NotificationOut]
    unread_count: int
    total: int


class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(..., max_length=1000)
    p256dh: str = Field(..., max_length=255)
    auth: str = Field(..., max_length=100)
    user_agent: str | None = Field(None, max_length=300)


class PushSubscriptionOut(BaseModel):
    id: str
    endpoint: str
    is_active: bool

    model_config = {"from_attributes": True}


class VapidPublicKeyOut(BaseModel):
    public_key: str
