"""
Schedule & Activity ORM models:
  - Activity           (a single scheduled event)
  - RecurringActivity  (recurrence config for an activity)
  - WorkingHours       (user's preferred working time window)
"""

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._base import TimestampMixin, uuid_pk


class Activity(Base, TimestampMixin):
    """A scheduled personal activity/event."""

    __tablename__ = "activities"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Times stored in UTC; display in user's timezone
    start_time: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_time: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)

    is_fixed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_flexible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    priority: Mapped[str] = mapped_column(
        String(10), nullable=False, default="medium"
    )  # low | medium | high | critical
    status: Mapped[str] = mapped_column(
        String(12), nullable=False, default="scheduled"
    )  # scheduled | completed | cancelled | skipped
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="violet")

    deadline: Mapped[Date | None] = mapped_column(Date)

    # Optional parent for recurring instances
    recurring_config_id: Mapped[str | None] = mapped_column(
        ForeignKey("recurring_activities.id", ondelete="SET NULL"), index=True
    )

    # Relationships
    recurring_config: Mapped["RecurringActivity | None"] = relationship(
        foreign_keys=[recurring_config_id]
    )
    notifications: Mapped[list["Notification"]] = relationship(  # noqa: F821
        back_populates="activity", cascade="all, delete-orphan"
    )


class RecurringActivity(Base, TimestampMixin):
    """Recurrence definition attached to a recurring activity."""

    __tablename__ = "recurring_activities"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    base_activity_id: Mapped[str | None] = mapped_column(
        ForeignKey("activities.id", ondelete="SET NULL")
    )

    frequency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="weekly"
    )  # daily | weekly | monthly
    days_of_week: Mapped[list[int]] = mapped_column(
        PG_ARRAY(Integer), nullable=False, default=list
    )  # 0=Mon … 6=Sun
    end_date: Mapped[Date | None] = mapped_column(Date)
    max_occurrences: Mapped[int | None] = mapped_column(Integer)


class WorkingHours(Base, TimestampMixin):
    """User's preferred working hours per weekday."""

    __tablename__ = "working_hours"
    __table_args__ = {"schema": None}

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )

    # Stored as "HH:MM" strings in local time; backend converts using user timezone
    work_start: Mapped[str] = mapped_column(String(5), nullable=False, default="09:00")
    work_end: Mapped[str] = mapped_column(String(5), nullable=False, default="18:00")
    work_days: Mapped[list[int]] = mapped_column(
        PG_ARRAY(Integer), nullable=False, default=[0, 1, 2, 3, 4]
    )  # Mon–Fri by default


# Import at bottom to avoid circular imports
from app.models.notification import Notification  # noqa: E402, F401
