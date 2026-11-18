"""
Notification ORM models:
  - Notification           (individual scheduled reminder)
  - NotificationPreference (user settings for channels & intervals)
  - PushSubscription       (Web Push endpoint registration)
"""

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._base import TimestampMixin, uuid_pk


class Notification(Base, TimestampMixin):
    """
    A single scheduled reminder for an activity.
    type encodes the lead time: '30min' | '15min' | '5min' | 'start'.
    Unique constraint prevents duplicate reminders per (user, activity, type).
    """

    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("payload_user_id", "activity_id", "type", name="uq_notification"),
    )

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    activity_id: Mapped[str | None] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), index=True
    )

    type: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # 30min | 15min | 5min | start | custom

    # UTC timestamp when this notification should fire
    scheduled_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    delivered_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    status: Mapped[str] = mapped_column(
        String(12), nullable=False, default="pending"
    )  # pending | delivered | failed | cancelled | read

    # Title / body already localized for the user's language at schedule time
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    body: Mapped[str] = mapped_column(String(500), nullable=False, default="")

    # Celery task ID for revocation
    celery_task_id: Mapped[str | None] = mapped_column(String(255))

    # Delivery channels used
    sent_in_app: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sent_push: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sent_email: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    activity: Mapped["Activity | None"] = relationship(  # noqa: F821
        back_populates="notifications"
    )


class NotificationPreference(Base, TimestampMixin):
    """Per-user notification channel and interval configuration."""

    __tablename__ = "notification_preferences"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )

    # Link back to user profile (optional — can also just use payload_user_id)
    user_profile_id: Mapped[str | None] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE")
    )

    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Reminder intervals in minutes before activity start
    # Default: [30, 15, 5, 0]
    reminder_minutes: Mapped[list[int]] = mapped_column(
        PG_ARRAY(Integer), nullable=False, default=[30, 15, 5, 0]
    )

    # Channels
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    push_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Optional scheduled summary
    weekly_summary_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    spending_alerts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationship back to user
    user: Mapped["UserProfile | None"] = relationship(  # noqa: F821
        back_populates="notification_prefs"
    )


class PushSubscription(Base, TimestampMixin):
    """Web Push API subscription for a specific browser/device."""

    __tablename__ = "push_subscriptions"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    user_profile_id: Mapped[str | None] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE")
    )

    # Web Push subscription object fields
    endpoint: Mapped[str] = mapped_column(String(1000), nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(100), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(300))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationship
    user: Mapped["UserProfile | None"] = relationship(back_populates="push_subscriptions")


# Late import to avoid circular
from app.models.schedule import Activity  # noqa: E402, F401
from app.models.user import UserProfile  # noqa: E402, F401
