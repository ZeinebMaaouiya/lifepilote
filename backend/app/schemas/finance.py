"""Pydantic schemas for finance endpoints."""

from datetime import date as DateType
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

# ── Budget Category ───────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)
    allocated_amount: Decimal = Field(..., ge=0, decimal_places=2)
    color: str = Field("violet", max_length=20)
    icon: str = Field("wallet", max_length=30)


class CategoryUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    allocated_amount: Decimal | None = Field(None, ge=0, decimal_places=2)
    color: str | None = Field(None, max_length=20)
    icon: str | None = Field(None, max_length=30)


class CategoryOut(BaseModel):
    id: str
    name: str
    allocated_amount: Decimal
    color: str
    icon: str
    # Calculated from actual expenses
    spent_amount: Decimal = Decimal("0.00")

    model_config = {"from_attributes": True}


# ── Monthly Budget ────────────────────────────────────────────────────────────

class BudgetCreate(BaseModel):
    year: int = Field(..., ge=2020, le=2100)
    month: int = Field(..., ge=1, le=12)
    total_income: Decimal = Field(..., ge=0, decimal_places=2)
    notes: str | None = Field(None, max_length=1000)


class BudgetUpdate(BaseModel):
    total_income: Decimal | None = Field(None, ge=0, decimal_places=2)
    notes: str | None = None


class BudgetOut(BaseModel):
    id: str
    year: int
    month: int
    total_income: Decimal
    notes: str | None
    categories: list[CategoryOut] = []

    model_config = {"from_attributes": True}


class BudgetSummary(BaseModel):
    """Calculated financial summary for a budget period."""
    budget_id: str
    year: int
    month: int
    total_income: Decimal
    total_allocated: Decimal        # Sum of all category allocations
    total_expenses: Decimal         # Sum of actual recorded expenses
    reserved_recurring: Decimal     # Upcoming recurring payments this month
    available_discretionary: Decimal  # income - expenses - reserved
    savings_this_month: Decimal     # income - total_expenses
    over_budget_amount: Decimal     # Max(0, expenses - allocated)
    utilization_pct: Decimal        # expenses / income * 100


# ── Expense ───────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    description: str = Field("", max_length=255)
    date: DateType
    category_id: str | None = None
    payment_method: Literal["card", "cash", "transfer"] = "card"


class ExpenseUpdate(BaseModel):
    amount: Decimal | None = Field(None, gt=0, decimal_places=2)
    description: str | None = Field(None, max_length=255)
    date: DateType | None = None
    category_id: str | None = None
    payment_method: Literal["card", "cash", "transfer"] | None = None


class ExpenseOut(BaseModel):
    id: str
    amount: Decimal
    description: str
    date: DateType
    payment_method: str
    category_id: str | None
    category_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExpenseListOut(BaseModel):
    items: list[ExpenseOut]
    total: int
    page: int
    page_size: int


# ── Recurring Payment ─────────────────────────────────────────────────────────

class RecurringPaymentCreate(BaseModel):
    name: str = Field(..., max_length=150)
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    frequency: Literal["weekly", "monthly", "yearly"] = "monthly"
    next_due_date: DateType
    icon: str = Field("repeat", max_length=30)
    color: str = Field("blue", max_length=20)
    notes: str | None = None


class RecurringPaymentUpdate(BaseModel):
    name: str | None = Field(None, max_length=150)
    amount: Decimal | None = Field(None, gt=0, decimal_places=2)
    frequency: Literal["weekly", "monthly", "yearly"] | None = None
    next_due_date: DateType | None = None
    icon: str | None = None
    color: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class RecurringPaymentOut(BaseModel):
    id: str
    name: str
    amount: Decimal
    frequency: str
    next_due_date: DateType
    status: str
    icon: str
    color: str
    notes: str | None
    is_active: bool

    model_config = {"from_attributes": True}
