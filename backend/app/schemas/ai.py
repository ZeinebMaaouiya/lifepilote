"""Pydantic schemas for the AI assistant."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    title: str = Field("New conversation", max_length=200)


class MessageIn(BaseModel):
    content: str = Field(..., max_length=4000)


class MessageOut(BaseModel):
    id: str
    role: Literal["user", "assistant", "system"]
    content: str
    token_count: int | None
    model_used: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: str
    title: str
    is_archived: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetailOut(BaseModel):
    id: str
    title: str
    is_archived: bool
    messages: list[MessageOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class RecommendationOut(BaseModel):
    id: str
    type: str
    payload_json: str  # JSON string; frontend parses based on type
    status: str
    expires_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RecommendationUpdate(BaseModel):
    status: Literal["accepted", "rejected"]
