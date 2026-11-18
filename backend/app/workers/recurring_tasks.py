"""
Recurring-payment maintenance tasks.

Runs hourly from Celery beat: any active payment whose due date has passed is
flagged as overdue so the UI and budget summary stay accurate.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date

from sqlalchemy import select

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("closed")
        return loop.run_until_complete(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


@celery_app.task(
    name="app.workers.recurring_tasks.update_overdue_payments",
    queue="default",
)
def update_overdue_payments() -> dict:
    """Flag active payments past their due date as overdue."""
    return _run_async(_update_overdue_payments_async())


async def _update_overdue_payments_async() -> dict:
    from app.database import AsyncSessionLocal
    from app.models.finance import RecurringPayment

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(RecurringPayment).where(
                RecurringPayment.is_active.is_(True),
                RecurringPayment.status == "upcoming",
                RecurringPayment.next_due_date < date.today(),
            )
        )
        payments = result.scalars().all()
        for payment in payments:
            payment.status = "overdue"

        if payments:
            await db.commit()

        logger.info("Marked %d recurring payment(s) overdue.", len(payments))
        return {"updated": len(payments)}
