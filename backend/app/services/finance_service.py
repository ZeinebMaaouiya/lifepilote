"""
Finance service — all monetary calculations use Python Decimal.
Never uses float arithmetic for financial amounts.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import BudgetCategory, Expense, MonthlyBudget, RecurringPayment
from app.schemas.finance import BudgetSummary

TWO_PLACES = Decimal("0.01")


def _round(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


async def calculate_budget_summary(
    db: AsyncSession,
    budget: MonthlyBudget,
    payload_user_id: str,
) -> BudgetSummary:
    """
    Compute the full financial summary for a monthly budget.

    Available discretionary money =
        total_income
        - actual_expenses
        - reserved_recurring (payments due this month not yet paid)
    """
    # Actual expenses for this month
    expense_sum_result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.payload_user_id == payload_user_id,
            Expense.budget_id == budget.id,
        )
    )
    total_expenses = Decimal(str(expense_sum_result.scalar()))

    # Category allocations
    cat_sum_result = await db.execute(
        select(func.coalesce(func.sum(BudgetCategory.allocated_amount), 0)).where(
            BudgetCategory.budget_id == budget.id,
        )
    )
    total_allocated = Decimal(str(cat_sum_result.scalar()))

    # Upcoming recurring payments due this calendar month not yet paid
    month_start = date(budget.year, budget.month, 1)
    # Last day of month
    if budget.month == 12:
        month_end = date(budget.year + 1, 1, 1)
    else:
        month_end = date(budget.year, budget.month + 1, 1)

    recurring_result = await db.execute(
        select(func.coalesce(func.sum(RecurringPayment.amount), 0)).where(
            RecurringPayment.payload_user_id == payload_user_id,
            RecurringPayment.is_active.is_(True),
            RecurringPayment.status.in_(["upcoming", "overdue"]),
            RecurringPayment.next_due_date >= month_start,
            RecurringPayment.next_due_date < month_end,
        )
    )
    reserved_recurring = Decimal(str(recurring_result.scalar()))

    income = budget.total_income

    available_discretionary = _round(income - total_expenses - reserved_recurring)
    savings = _round(income - total_expenses)
    over_budget = _round(max(Decimal("0.00"), total_expenses - total_allocated))
    utilization = _round(
        (total_expenses / income * 100) if income > 0 else Decimal("0.00")
    )

    return BudgetSummary(
        budget_id=budget.id,
        year=budget.year,
        month=budget.month,
        total_income=_round(income),
        total_allocated=_round(total_allocated),
        total_expenses=_round(total_expenses),
        reserved_recurring=_round(reserved_recurring),
        available_discretionary=available_discretionary,
        savings_this_month=savings,
        over_budget_amount=over_budget,
        utilization_pct=utilization,
    )


async def get_category_spending(
    db: AsyncSession,
    budget_id: str,
) -> dict[str, Decimal]:
    """Returns a mapping of category_id → total spent amount."""
    result = await db.execute(
        select(Expense.category_id, func.sum(Expense.amount))
        .where(Expense.budget_id == budget_id, Expense.category_id.is_not(None))
        .group_by(Expense.category_id)
    )
    return {row[0]: Decimal(str(row[1])) for row in result.fetchall()}


async def advance_recurring_due_date(payment: RecurringPayment) -> date:
    """Compute the next due date after marking a payment as paid."""
    from dateutil.relativedelta import relativedelta

    current = payment.next_due_date
    if payment.frequency == "weekly":
        return current + relativedelta(weeks=1)
    elif payment.frequency == "monthly":
        return current + relativedelta(months=1)
    elif payment.frequency == "yearly":
        return current + relativedelta(years=1)
    return current
