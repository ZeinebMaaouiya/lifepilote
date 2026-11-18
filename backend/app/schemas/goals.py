"""Pydantic schemas for goals."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class GoalCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str | None = None
    target_value: Decimal = Field(Decimal("100.00"), ge=0, decimal_places=2)
    deadline: date | None = None
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    period: Literal["monthly", "yearly"] = "monthly"
    color: str = Field("violet", max_length=20)
    icon: str = Field("target", max_length=30)
    # Optional financial dimension
    financial_target_amount: Decimal | None = Field(None, ge=0)


class GoalUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    description: str | None = None
    target_value: Decimal | None = Field(None, ge=0, decimal_places=2)
    current_value: Decimal | None = Field(None, ge=0, decimal_places=2)
    deadline: date | None = None
    priority: Literal["low", "medium", "high", "critical"] | None = None
    status: Literal["active", "completed", "paused", "cancelled"] | None = None
    color: str | None = None
    icon: str | None = None


class ProgressUpdate(BaseModel):
    current_value: Decimal = Field(..., ge=0, decimal_places=2)
    notes: str | None = None


class FinancialGoalUpdate(BaseModel):
    saved_amount: Decimal = Field(..., ge=0, decimal_places=2)


class FinancialGoalOut(BaseModel):
    id: str
    target_amount: Decimal
    saved_amount: Decimal
    completion_pct: Decimal

    model_config = {"from_attributes": True}


class GoalOut(BaseModel):
    id: str
    title: str
    description: str | None
    target_value: Decimal
    current_value: Decimal
    completion_pct: Decimal
    deadline: date | None
    priority: str
    status: str
    period: str
    color: str
    icon: str
    financial_goal: FinancialGoalOut | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GoalListOut(BaseModel):
    items: list[GoalOut]
    total: int
