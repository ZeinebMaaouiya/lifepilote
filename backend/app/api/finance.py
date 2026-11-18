"""Finance endpoints: budgets, categories, expenses and recurring payments."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.helpers import api_error, get_owned, not_found
from app.dependencies import DB, CurrentUser, Pagination
from app.models.finance import (
    BudgetCategory,
    Expense,
    MonthlyBudget,
    RecurringPayment,
)
from app.models.user import UserProfile
from app.schemas.finance import (
    BudgetCreate,
    BudgetOut,
    BudgetSummary,
    BudgetUpdate,
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    ExpenseCreate,
    ExpenseListOut,
    ExpenseOut,
    ExpenseUpdate,
    RecurringPaymentCreate,
    RecurringPaymentOut,
    RecurringPaymentUpdate,
)
from app.services.finance_service import (
    advance_recurring_due_date,
    calculate_budget_summary,
    get_category_spending,
)

router = APIRouter(prefix="/finance", tags=["finance"])


@router.get("/reports/monthly")
async def monthly_report(
    user: CurrentUser,
    db: DB,
    months: int = Query(6, ge=2, le=24),
) -> list[dict[str, str]]:
    """Return a compact, user-scoped income and spending history."""
    try:
        today = datetime.now(ZoneInfo(user.timezone or "UTC")).date()
    except (ZoneInfoNotFoundError, ValueError):
        today = datetime.now(UTC).date()
    first = date(today.year, today.month, 1)
    for _ in range(months - 1):
        first = (
            date(first.year - 1, 12, 1)
            if first.month == 1
            else date(first.year, first.month - 1, 1)
        )
    last = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)

    budgets_result = await db.execute(
        select(MonthlyBudget).where(
            MonthlyBudget.payload_user_id == user.payload_user_id,
            (MonthlyBudget.year > first.year)
            | ((MonthlyBudget.year == first.year) & (MonthlyBudget.month >= first.month)),
            (MonthlyBudget.year < today.year)
            | ((MonthlyBudget.year == today.year) & (MonthlyBudget.month <= today.month)),
        )
    )
    income_by_month = {
        (budget.year, budget.month): budget.total_income
        for budget in budgets_result.scalars().all()
    }
    spending_result = await db.execute(
        select(
            func.extract("year", Expense.date),
            func.extract("month", Expense.date),
            func.sum(Expense.amount),
        )
        .where(
            Expense.payload_user_id == user.payload_user_id,
            Expense.date >= first,
            Expense.date < last,
        )
        .group_by(func.extract("year", Expense.date), func.extract("month", Expense.date))
    )
    spending_by_month = {
        (int(year), int(month)): amount
        for year, month, amount in spending_result.all()
    }

    report = []
    year, month = first.year, first.month
    while (year, month) <= (today.year, today.month):
        income = income_by_month.get((year, month), Decimal("0.00"))
        spending = spending_by_month.get((year, month), Decimal("0.00"))
        report.append({
            "month": f"{year:04d}-{month:02d}",
            "income": str(income),
            "expenses": str(spending),
            "savings": str(income - spending),
        })
        if month == 12:
            year, month = year + 1, 1
        else:
            month += 1
    return report


# ── Serialization helpers ────────────────────────────────────────────────────

async def _budget_out(db, budget: MonthlyBudget) -> BudgetOut:
    spending = await get_category_spending(db, budget.id)
    categories = [
        CategoryOut(
            id=category.id,
            name=category.name,
            allocated_amount=category.allocated_amount,
            color=category.color,
            icon=category.icon,
            spent_amount=spending.get(category.id, Decimal("0.00")),
        )
        for category in sorted(budget.categories, key=lambda c: c.name)
    ]
    return BudgetOut(
        id=budget.id,
        year=budget.year,
        month=budget.month,
        total_income=budget.total_income,
        notes=budget.notes,
        categories=categories,
    )


def _expense_out(expense: Expense) -> ExpenseOut:
    return ExpenseOut(
        id=expense.id,
        amount=expense.amount,
        description=expense.description,
        date=expense.date,
        payment_method=expense.payment_method,
        category_id=expense.category_id,
        category_name=expense.category.name if expense.category else None,
        created_at=expense.created_at,
    )


async def _load_budget(db, budget_id: str, user: UserProfile) -> MonthlyBudget:
    result = await db.execute(
        select(MonthlyBudget)
        .options(selectinload(MonthlyBudget.categories))
        .where(
            MonthlyBudget.id == budget_id,
            MonthlyBudget.payload_user_id == user.payload_user_id,
        )
    )
    budget = result.scalar_one_or_none()
    if budget is None:
        raise not_found("Budget")
    return budget


async def _budget_for_date(
    db, user: UserProfile, day: date
) -> MonthlyBudget | None:
    result = await db.execute(
        select(MonthlyBudget).where(
            MonthlyBudget.payload_user_id == user.payload_user_id,
            MonthlyBudget.year == day.year,
            MonthlyBudget.month == day.month,
        )
    )
    return result.scalar_one_or_none()


async def _load_category(db, category_id: str, user: UserProfile) -> BudgetCategory:
    return await get_owned(db, BudgetCategory, category_id, user, "Category")


# ── Budgets ──────────────────────────────────────────────────────────────────

@router.get("/budgets", response_model=list[BudgetOut])
async def list_budgets(
    user: CurrentUser,
    db: DB,
    year: int | None = Query(None, ge=2020, le=2100),
    month: int | None = Query(None, ge=1, le=12),
) -> list[BudgetOut]:
    query = (
        select(MonthlyBudget)
        .options(selectinload(MonthlyBudget.categories))
        .where(MonthlyBudget.payload_user_id == user.payload_user_id)
        .order_by(MonthlyBudget.year.desc(), MonthlyBudget.month.desc())
    )
    if year is not None:
        query = query.where(MonthlyBudget.year == year)
    if month is not None:
        query = query.where(MonthlyBudget.month == month)

    result = await db.execute(query)
    return [await _budget_out(db, budget) for budget in result.scalars().all()]


@router.post(
    "/budgets",
    response_model=BudgetOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_budget(
    payload: BudgetCreate,
    user: CurrentUser,
    db: DB,
) -> BudgetOut:
    existing = await db.execute(
        select(MonthlyBudget).where(
            MonthlyBudget.payload_user_id == user.payload_user_id,
            MonthlyBudget.year == payload.year,
            MonthlyBudget.month == payload.month,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "budget_exists",
            "A budget already exists for that month.",
        )

    budget = MonthlyBudget(
        payload_user_id=user.payload_user_id,
        year=payload.year,
        month=payload.month,
        total_income=payload.total_income,
        notes=payload.notes,
    )
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return BudgetOut(
        id=budget.id,
        year=budget.year,
        month=budget.month,
        total_income=budget.total_income,
        notes=budget.notes,
        categories=[],
    )


@router.get("/budgets/{budget_id}", response_model=BudgetOut)
async def get_budget(budget_id: str, user: CurrentUser, db: DB) -> BudgetOut:
    budget = await _load_budget(db, budget_id, user)
    return await _budget_out(db, budget)


@router.patch("/budgets/{budget_id}", response_model=BudgetOut)
async def update_budget(
    budget_id: str,
    payload: BudgetUpdate,
    user: CurrentUser,
    db: DB,
) -> BudgetOut:
    budget = await _load_budget(db, budget_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(budget, field, value)
    await db.commit()
    budget = await _load_budget(db, budget_id, user)
    return await _budget_out(db, budget)


@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(budget_id: str, user: CurrentUser, db: DB) -> None:
    budget = await _load_budget(db, budget_id, user)
    await db.delete(budget)
    await db.commit()


@router.get("/budgets/{budget_id}/summary", response_model=BudgetSummary)
async def get_budget_summary(
    budget_id: str,
    user: CurrentUser,
    db: DB,
) -> BudgetSummary:
    budget = await _load_budget(db, budget_id, user)
    return await calculate_budget_summary(db, budget, user.payload_user_id)


# ── Budget categories ────────────────────────────────────────────────────────

@router.post(
    "/budgets/{budget_id}/categories",
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    budget_id: str,
    payload: CategoryCreate,
    user: CurrentUser,
    db: DB,
) -> CategoryOut:
    budget = await _load_budget(db, budget_id, user)
    category = BudgetCategory(
        budget_id=budget.id,
        payload_user_id=user.payload_user_id,
        name=payload.name,
        allocated_amount=payload.allocated_amount,
        color=payload.color,
        icon=payload.icon,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return CategoryOut.model_validate(category)


@router.patch("/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: str,
    payload: CategoryUpdate,
    user: CurrentUser,
    db: DB,
) -> CategoryOut:
    category = await _load_category(db, category_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return CategoryOut.model_validate(category)


@router.delete(
    "/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_category(
    category_id: str,
    user: CurrentUser,
    db: DB,
) -> None:
    category = await _load_category(db, category_id, user)
    await db.delete(category)
    await db.commit()


# ── Expenses ─────────────────────────────────────────────────────────────────

@router.get("/expenses", response_model=ExpenseListOut)
async def list_expenses(
    user: CurrentUser,
    db: DB,
    pagination: Pagination,
    budget_id: str | None = None,
    category_id: str | None = None,
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
) -> ExpenseListOut:
    conditions = [Expense.payload_user_id == user.payload_user_id]
    if budget_id:
        conditions.append(Expense.budget_id == budget_id)
    if category_id:
        conditions.append(Expense.category_id == category_id)
    if date_from:
        conditions.append(Expense.date >= date_from)
    if date_to:
        conditions.append(Expense.date <= date_to)

    total = await db.scalar(
        select(func.count()).select_from(Expense).where(*conditions)
    )

    result = await db.execute(
        select(Expense)
        .options(selectinload(Expense.category))
        .where(*conditions)
        .order_by(Expense.date.desc(), Expense.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    items = [_expense_out(expense) for expense in result.scalars().all()]

    return ExpenseListOut(
        items=items,
        total=int(total or 0),
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post(
    "/expenses",
    response_model=ExpenseOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_expense(
    payload: ExpenseCreate,
    user: CurrentUser,
    db: DB,
) -> ExpenseOut:
    category: BudgetCategory | None = None
    budget: MonthlyBudget | None = None

    if payload.category_id:
        category = await _load_category(db, payload.category_id, user)
        budget = await _load_budget(db, category.budget_id, user)
    else:
        budget = await _budget_for_date(db, user, payload.date)

    expense = Expense(
        payload_user_id=user.payload_user_id,
        budget_id=budget.id if budget else None,
        category_id=category.id if category else None,
        amount=payload.amount,
        description=payload.description,
        date=payload.date,
        payment_method=payload.payment_method,
    )
    expense.category = category
    db.add(expense)
    await db.commit()
    return _expense_out(expense)


@router.patch("/expenses/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    expense_id: str,
    payload: ExpenseUpdate,
    user: CurrentUser,
    db: DB,
) -> ExpenseOut:
    result = await db.execute(
        select(Expense)
        .options(selectinload(Expense.category))
        .where(
            Expense.id == expense_id,
            Expense.payload_user_id == user.payload_user_id,
        )
    )
    expense = result.scalar_one_or_none()
    if expense is None:
        raise not_found("Expense")

    fields = payload.model_dump(exclude_unset=True)

    if "category_id" in fields:
        category_id = fields.pop("category_id")
        if category_id:
            category = await _load_category(db, category_id, user)
            expense.category = category
            expense.category_id = category.id
            expense.budget_id = category.budget_id
        else:
            expense.category = None
            expense.category_id = None

    for field, value in fields.items():
        setattr(expense, field, value)

    # Keep the expense attached to the budget of its (possibly new) date.
    if "date" in fields or "category_id" in payload.model_fields_set:
        if expense.category_id is None:
            budget = await _budget_for_date(db, user, expense.date)
            expense.budget_id = budget.id if budget else None

    await db.commit()
    return _expense_out(expense)


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: str,
    user: CurrentUser,
    db: DB,
) -> None:
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.payload_user_id == user.payload_user_id,
        )
    )
    expense = result.scalar_one_or_none()
    if expense is None:
        raise not_found("Expense")
    await db.delete(expense)
    await db.commit()


# ── Recurring payments ───────────────────────────────────────────────────────

@router.get("/recurring-payments", response_model=list[RecurringPaymentOut])
async def list_recurring_payments(
    user: CurrentUser,
    db: DB,
) -> list[RecurringPaymentOut]:
    result = await db.execute(
        select(RecurringPayment)
        .where(RecurringPayment.payload_user_id == user.payload_user_id)
        .order_by(RecurringPayment.next_due_date)
    )
    return [
        RecurringPaymentOut.model_validate(payment)
        for payment in result.scalars().all()
    ]


@router.post(
    "/recurring-payments",
    response_model=RecurringPaymentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_recurring_payment(
    payload: RecurringPaymentCreate,
    user: CurrentUser,
    db: DB,
) -> RecurringPaymentOut:
    payment = RecurringPayment(
        payload_user_id=user.payload_user_id,
        name=payload.name,
        amount=payload.amount,
        frequency=payload.frequency,
        next_due_date=payload.next_due_date,
        status="overdue" if payload.next_due_date < date.today() else "upcoming",
        icon=payload.icon,
        color=payload.color,
        notes=payload.notes,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return RecurringPaymentOut.model_validate(payment)


@router.patch(
    "/recurring-payments/{payment_id}",
    response_model=RecurringPaymentOut,
)
async def update_recurring_payment(
    payment_id: str,
    payload: RecurringPaymentUpdate,
    user: CurrentUser,
    db: DB,
) -> RecurringPaymentOut:
    payment = await get_owned(
        db, RecurringPayment, payment_id, user, "Recurring payment"
    )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(payment, field, value)
    await db.commit()
    await db.refresh(payment)
    return RecurringPaymentOut.model_validate(payment)


@router.post(
    "/recurring-payments/{payment_id}/pay",
    response_model=RecurringPaymentOut,
)
async def pay_recurring_payment(
    payment_id: str,
    user: CurrentUser,
    db: DB,
) -> RecurringPaymentOut:
    payment = await get_owned(
        db, RecurringPayment, payment_id, user, "Recurring payment"
    )
    payment.next_due_date = await advance_recurring_due_date(payment)
    payment.status = (
        "overdue" if payment.next_due_date < date.today() else "upcoming"
    )
    await db.commit()
    await db.refresh(payment)
    return RecurringPaymentOut.model_validate(payment)


@router.delete(
    "/recurring-payments/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_recurring_payment(
    payment_id: str,
    user: CurrentUser,
    db: DB,
) -> None:
    payment = await get_owned(
        db, RecurringPayment, payment_id, user, "Recurring payment"
    )
    await db.delete(payment)
    await db.commit()
