"""
Financial ORM models:
  - MonthlyBudget
  - BudgetCategory
  - Expense
  - RecurringPayment
"""

from decimal import Decimal

from sqlalchemy import NUMERIC, Boolean, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._base import TimestampMixin, uuid_pk


class MonthlyBudget(Base, TimestampMixin):
    """One budget per user per calendar month."""

    __tablename__ = "monthly_budgets"
    __table_args__ = (UniqueConstraint("payload_user_id", "year", "month"),)

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-12

    total_income: Mapped[Decimal] = mapped_column(
        NUMERIC(12, 2), nullable=False, default=Decimal("0.00")
    )
    notes: Mapped[str | None] = mapped_column(Text)

    # Relationships
    categories: Mapped[list["BudgetCategory"]] = relationship(
        back_populates="budget", cascade="all, delete-orphan", order_by="BudgetCategory.name"
    )


class BudgetCategory(Base, TimestampMixin):
    """A named spending category with an allocated budget amount."""

    __tablename__ = "budget_categories"

    id: Mapped[str] = uuid_pk()
    budget_id: Mapped[str] = mapped_column(
        ForeignKey("monthly_budgets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    allocated_amount: Mapped[Decimal] = mapped_column(
        NUMERIC(12, 2), nullable=False, default=Decimal("0.00")
    )
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="violet")
    icon: Mapped[str] = mapped_column(String(30), nullable=False, default="wallet")

    # Relationships
    budget: Mapped["MonthlyBudget"] = relationship(back_populates="categories")
    expenses: Mapped[list["Expense"]] = relationship(
        back_populates="category", passive_deletes=True
    )


class Expense(Base, TimestampMixin):
    """A single recorded expense transaction."""

    __tablename__ = "expenses"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    budget_id: Mapped[str | None] = mapped_column(
        ForeignKey("monthly_budgets.id", ondelete="SET NULL"), index=True
    )
    category_id: Mapped[str | None] = mapped_column(
        ForeignKey("budget_categories.id", ondelete="SET NULL"), index=True
    )

    amount: Mapped[Decimal] = mapped_column(NUMERIC(12, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    payment_method: Mapped[str] = mapped_column(
        String(30), nullable=False, default="card"
    )  # card | cash | transfer

    # Relationships
    category: Mapped["BudgetCategory | None"] = relationship(back_populates="expenses")


class RecurringPayment(Base, TimestampMixin):
    """A scheduled recurring financial commitment."""

    __tablename__ = "recurring_payments"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    amount: Mapped[Decimal] = mapped_column(NUMERIC(12, 2), nullable=False)
    frequency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="monthly"
    )  # weekly | monthly | yearly
    next_due_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(10), nullable=False, default="upcoming"
    )  # upcoming | paid | overdue
    icon: Mapped[str] = mapped_column(String(30), nullable=False, default="repeat")
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="blue")
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
