"""Pydantic schemas for activities and scheduling."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ActivityCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str | None = None
    start_time: datetime  # ISO 8601 with timezone
    end_time: datetime
    is_fixed: bool = False
    is_flexible: bool = True
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    color: str = Field("violet", max_length=20)
    deadline: date | None = None
    # Recurrence
    is_recurring: bool = False
    recurrence_frequency: Literal["daily", "weekly", "monthly"] | None = None
    recurrence_days: list[int] | None = None  # 0=Mon … 6=Sun
    recurrence_end_date: date | None = None

    @model_validator(mode="after")
    def end_after_start(self) -> "ActivityCreate":
        if self.start_time.tzinfo is None or self.end_time.tzinfo is None:
            raise ValueError("start_time and end_time must include a timezone offset")
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self

    # Override confirms override of a conflict with a fixed activity
    override_conflict: bool = False


class ActivityUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    is_fixed: bool | None = None
    is_flexible: bool | None = None
    priority: Literal["low", "medium", "high", "critical"] | None = None
    color: str | None = None
    deadline: date | None = None
    status: Literal["scheduled", "completed", "cancelled", "skipped"] | None = None
    override_conflict: bool = False

    @model_validator(mode="after")
    def validate_times(self) -> "ActivityUpdate":
        for field in ("start_time", "end_time"):
            value = getattr(self, field)
            if value is not None and value.tzinfo is None:
                raise ValueError(f"{field} must include a timezone offset")
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("end_time must be after start_time")
        return self


class ConflictInfo(BaseModel):
    conflicting_activity_id: str
    conflicting_title: str
    overlap_start: datetime
    overlap_end: datetime


class ActivityOut(BaseModel):
    id: str
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    is_fixed: bool
    is_flexible: bool
    is_recurring: bool
    priority: str
    status: str
    color: str
    deadline: date | None
    recurring_config_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityCreateResult(BaseModel):
    activity: ActivityOut
    conflicts: list[ConflictInfo] = []


class WorkingHoursUpdate(BaseModel):
    work_start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    work_end: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    work_days: list[int] = Field(..., min_length=1, max_length=7)


class WorkingHoursOut(BaseModel):
    id: str
    work_start: str
    work_end: str
    work_days: list[int]

    model_config = {"from_attributes": True}


class NLScheduleRequest(BaseModel):
    """Natural language scheduling request — interpreted by AI."""
    text: str = Field(..., max_length=2000)
    target_week_start: date | None = None


class ProposedActivity(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    priority: str
    color: str
    is_new: bool  # False if updating an existing activity

    @model_validator(mode="after")
    def valid_times(self) -> "ProposedActivity":
        if self.start_time.tzinfo is None or self.end_time.tzinfo is None:
            raise ValueError("start_time and end_time must include a timezone offset")
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class ScheduleProposal(BaseModel):
    """AI-generated schedule proposal — requires user confirmation before saving."""
    proposal_id: str
    activities: list[ProposedActivity]
    conflicts: list[ConflictInfo]
    explanation: str
    # Not saved until POST /api/v1/schedules/confirm
    requires_confirmation: bool = True


class ScheduleConfirm(BaseModel):
    proposal_id: str
