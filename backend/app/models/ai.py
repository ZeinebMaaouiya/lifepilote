"""
AI conversation ORM models:
  - AIConversation     (a chat thread with LifePilot AI)
  - AIMessage          (a single message in a conversation)
  - AIRecommendation   (a structured AI suggestion pending user confirmation)
"""

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._base import TimestampMixin, uuid_pk


class AIConversation(Base, TimestampMixin):
    """A conversation thread between the user and LifePilot AI."""

    __tablename__ = "ai_conversations"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    user_profile_id: Mapped[str | None] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="SET NULL")
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False, default="New conversation")
    # JSON snapshot of user context at conversation start
    context_snapshot: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    user: Mapped["UserProfile | None"] = relationship(  # noqa: F821
        back_populates="ai_conversations"
    )
    messages: Mapped[list["AIMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AIMessage.created_at",
    )
    recommendations: Mapped[list["AIRecommendation"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class AIMessage(Base, TimestampMixin):
    """A single message in an AI conversation."""

    __tablename__ = "ai_messages"

    id: Mapped[str] = uuid_pk()
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )

    role: Mapped[str] = mapped_column(String(15), nullable=False)  # user | assistant | system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer)
    model_used: Mapped[str | None] = mapped_column(String(50))

    # Relationship
    conversation: Mapped["AIConversation"] = relationship(back_populates="messages")


class AIRecommendation(Base, TimestampMixin):
    """
    A structured AI recommendation requiring user confirmation before action.
    Examples: proposed schedule, suggested meal plan, financial advice.
    """

    __tablename__ = "ai_recommendations"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    conversation_id: Mapped[str | None] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="SET NULL")
    )

    type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # schedule | meal_plan | financial | lifestyle
    # JSON payload describing the recommendation
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(12), nullable=False, default="pending"
    )  # pending | accepted | rejected | expired

    expires_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    responded_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    # Relationship
    conversation: Mapped["AIConversation | None"] = relationship(
        back_populates="recommendations"
    )


# Late import to avoid circular
from app.models.user import UserProfile  # noqa: E402, F401
