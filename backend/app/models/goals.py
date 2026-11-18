"""
Goals ORM models:
  - PersonalGoal   (monthly or yearly objectives)
  - FinancialGoal  (savings target linked to a PersonalGoal)
"""

from decimal import Decimal

from sqlalchemy import NUMERIC, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._base import TimestampMixin, uuid_pk


class PersonalGoal(Base, TimestampMixin):
    """An objective the user wants to achieve."""

    __tablename__ = "personal_goals"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Progress tracking (generic — unit is context-dependent)
    target_value: Mapped[Decimal] = mapped_column(
        NUMERIC(12, 2), nullable=False, default=Decimal("100.00")
    )
    current_value: Mapped[Decimal] = mapped_column(
        NUMERIC(12, 2), nullable=False, default=Decimal("0.00")
    )

    deadline: Mapped[Date | None] = mapped_column(Date, index=True)
    priority: Mapped[str] = mapped_column(
        String(10), nullable=False, default="medium"
    )  # low | medium | high | critical
    status: Mapped[str] = mapped_column(
        String(12), nullable=False, default="active"
    )  # active | completed | paused | cancelled
    period: Mapped[str] = mapped_column(
        String(10), nullable=False, default="monthly"
    )  # monthly | yearly
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="violet")
    icon: Mapped[str] = mapped_column(String(30), nullable=False, default="target")

    # Optional financial link
    financial_goal: Mapped["FinancialGoal | None"] = relationship(
        back_populates="goal", uselist=False, cascade="all, delete-orphan"
    )

    @property
    def completion_pct(self) -> Decimal:
        """Progress toward the target, capped at 100%."""
        if self.target_value and self.target_value > 0:
            pct = (self.current_value / self.target_value) * 100
            return min(Decimal("100.00"), pct.quantize(Decimal("0.01")))
        return Decimal("0.00")


class FinancialGoal(Base, TimestampMixin):
    """
    Savings/spending target linked to a PersonalGoal.
    Provides the financial dimension of a goal (e.g., save 6,000 MAD).
    """

    __tablename__ = "financial_goals"

    id: Mapped[str] = uuid_pk()
    goal_id: Mapped[str] = mapped_column(
        ForeignKey("personal_goals.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    target_amount: Mapped[Decimal] = mapped_column(NUMERIC(12, 2), nullable=False)
    saved_amount: Mapped[Decimal] = mapped_column(
        NUMERIC(12, 2), nullable=False, default=Decimal("0.00")
    )
    linked_category_id: Mapped[str | None] = mapped_column(
        ForeignKey("budget_categories.id", ondelete="SET NULL")
    )

    # Relationship
    goal: Mapped["PersonalGoal"] = relationship(back_populates="financial_goal")

    @property
    def completion_pct(self) -> Decimal:
        """Saved fraction of the target, capped at 100%."""
        if self.target_amount and self.target_amount > 0:
            pct = (self.saved_amount / self.target_amount) * 100
            return min(Decimal("100.00"), pct.quantize(Decimal("0.01")))
        return Decimal("0.00")
