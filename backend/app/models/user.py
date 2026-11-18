"""
User profile model.
Payload CMS owns the canonical user record (email, password, name).
This model stores backend-specific profile data keyed by the Payload user ID.
"""

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._base import TimestampMixin, uuid_pk


class UserProfile(Base, TimestampMixin):
    """
    One-to-one extension of an app identity. `payload_user_id` remains the
    stable legacy ownership key during the staged auth migration.
    """

    __tablename__ = "user_profiles"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    better_auth_user_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )

    # Displayed name (synced from Payload on first login)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    # Locale preferences (also stored in Payload but cached here for query efficiency)
    language: Mapped[str] = mapped_column(String(5), nullable=False, default="en")
    theme: Mapped[str] = mapped_column(String(10), nullable=False, default="dark")
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    currency: Mapped[str] = mapped_column(String(5), nullable=False, default="MAD")
    simplified_ui: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    notification_prefs: Mapped["NotificationPreference"] = relationship(  # noqa: F821
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    push_subscriptions: Mapped[list["PushSubscription"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    ai_conversations: Mapped[list["AIConversation"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )


# Import at bottom to avoid circular imports
from app.models.ai import AIConversation  # noqa: E402, F401
from app.models.notification import NotificationPreference, PushSubscription  # noqa: E402, F401
