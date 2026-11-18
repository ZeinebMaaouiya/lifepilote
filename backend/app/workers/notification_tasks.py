"""
Celery notification tasks — deliver reminders via in-app, push and email channels.
"""

import asyncio
import logging
from datetime import UTC, datetime

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a sync Celery task."""
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
    name="app.workers.notification_tasks.send_reminder",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="notifications",
)
def send_reminder(self, notification_id: str) -> dict:
    """
    Deliver a single scheduled reminder.
    Loads the notification from the database and dispatches to all
    enabled channels (in-app, push, email).
    """
    return _run_async(_send_reminder_async(self, notification_id))


async def _send_reminder_async(task, notification_id: str) -> dict:
    from sqlalchemy import select

    from app.database import AsyncSessionLocal
    from app.models.notification import Notification, NotificationPreference, PushSubscription
    from app.services.push_service import send_push_notification

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        notif = result.scalar_one_or_none()

        if notif is None:
            logger.warning(f"Notification {notification_id} not found — skipped.")
            return {"status": "not_found"}

        if notif.status != "pending":
            logger.info(f"Notification {notification_id} status={notif.status} — skipped.")
            return {"status": "skipped"}

        # Fetch preferences
        prefs_result = await db.execute(
            select(NotificationPreference).where(
                NotificationPreference.payload_user_id == notif.payload_user_id
            )
        )
        prefs = prefs_result.scalar_one_or_none()

        errors: list[str] = []

        # ── In-app (always delivered if notification exists) ─────────────
        notif.sent_in_app = True

        # ── Push notification ─────────────────────────────────────────────
        if prefs and prefs.push_enabled:
            subs_result = await db.execute(
                select(PushSubscription).where(
                    PushSubscription.payload_user_id == notif.payload_user_id,
                    PushSubscription.is_active.is_(True),
                )
            )
            subscriptions = subs_result.scalars().all()
            for sub in subscriptions:
                try:
                    await send_push_notification(
                        endpoint=sub.endpoint,
                        p256dh=sub.p256dh,
                        auth=sub.auth,
                        title=notif.title,
                        body=notif.body,
                    )
                    notif.sent_push = True
                except Exception as exc:
                    logger.error(f"Push failed for sub {sub.id}: {exc}")
                    errors.append(f"push:{exc}")
                    sub.is_active = False  # Invalidate bad subscription

        # ── Email ─────────────────────────────────────────────────────────
        if prefs and prefs.email_enabled:
            from app.workers.email_tasks import send_reminder_email
            send_reminder_email.delay(
                user_id=notif.payload_user_id,
                title=notif.title,
                body=notif.body,
            )
            notif.sent_email = True

        # ── Mark delivered ────────────────────────────────────────────────
        notif.status = "delivered" if not errors else "failed"
        notif.delivered_at = datetime.now(tz=UTC)
        await db.commit()

        return {
            "status": notif.status,
            "notification_id": notification_id,
            "errors": errors,
        }
