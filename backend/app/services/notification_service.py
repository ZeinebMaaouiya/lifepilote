"""
Notification service — creates Notification records and schedules Celery tasks.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationPreference
from app.models.schedule import Activity
from app.utils.i18n import get_reminder_message


async def get_or_create_preferences(
    db: AsyncSession,
    payload_user_id: str,
) -> NotificationPreference:
    """Return the user's notification preferences, creating defaults if absent."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.payload_user_id == payload_user_id
        )
    )
    prefs = result.scalar_one_or_none()
    if prefs is None:
        prefs = NotificationPreference(
            payload_user_id=payload_user_id,
            reminder_minutes=[30, 15, 5, 0],
        )
        db.add(prefs)
        await db.flush()
    return prefs


async def schedule_activity_reminders(
    db: AsyncSession,
    activity: Activity,
    payload_user_id: str,
    language: str = "en",
) -> list[Notification]:
    """
    Create or re-arm Notification rows and Celery tasks for an activity.

    Rows are upserted per (user, activity, type) because that triple is unique:
    moving an activity must update its existing reminders rather than insert
    duplicates.
    """
    from app.workers.notification_tasks import send_reminder  # Avoid circular at module level

    prefs = await get_or_create_preferences(db, payload_user_id)

    existing_result = await db.execute(
        select(Notification).where(
            Notification.payload_user_id == payload_user_id,
            Notification.activity_id == activity.id,
        )
    )
    existing = {row.type: row for row in existing_result.scalars().all()}

    if not prefs.enabled:
        for row in existing.values():
            if row.status == "pending":
                row.status = "cancelled"
        await db.flush()
        return []

    notifications: list[Notification] = []
    wanted: set[str] = set()
    now = datetime.now(tz=UTC)

    for minutes in prefs.reminder_minutes:
        scheduled_at = activity.start_time - timedelta(minutes=minutes)
        reminder_type = f"{minutes}min" if minutes > 0 else "start"
        wanted.add(reminder_type)

        notification = existing.get(reminder_type)
        if scheduled_at < now:
            # Never deliver a reminder whose lead time has already passed.
            if notification is not None and notification.status == "pending":
                notification.status = "cancelled"
            continue

        title, body = get_reminder_message(activity.title, minutes, language)

        if notification is None:
            notification = Notification(
                id=str(uuid.uuid4()),
                payload_user_id=payload_user_id,
                activity_id=activity.id,
                type=reminder_type,
                scheduled_at=scheduled_at,
                title=title,
                body=body,
                status="pending",
            )
            db.add(notification)
            await db.flush()
        else:
            notification.scheduled_at = scheduled_at
            notification.title = title
            notification.body = body
            notification.status = "pending"
            notification.delivered_at = None
            notification.sent_in_app = False
            notification.sent_push = False
            notification.sent_email = False

        # A new task id per scheduled time avoids colliding with a revoked task.
        task = send_reminder.apply_async(
            args=[notification.id],
            eta=scheduled_at,
            task_id=f"reminder-{notification.id}-{int(scheduled_at.timestamp())}",
        )
        notification.celery_task_id = task.id
        notifications.append(notification)

    # Cancel reminders whose lead time is no longer configured.
    for reminder_type, row in existing.items():
        if reminder_type not in wanted and row.status == "pending":
            row.status = "cancelled"

    await db.flush()
    return notifications


async def cancel_activity_reminders(
    db: AsyncSession,
    activity_id: str,
    payload_user_id: str,
) -> None:
    """Cancel all pending Celery tasks for an activity and mark them cancelled."""
    from app.workers.celery_app import celery_app

    result = await db.execute(
        select(Notification).where(
            Notification.activity_id == activity_id,
            Notification.payload_user_id == payload_user_id,
            Notification.status == "pending",
        )
    )
    notifications = result.scalars().all()

    for notif in notifications:
        if notif.celery_task_id:
            try:
                celery_app.control.revoke(notif.celery_task_id, terminate=False)
            except Exception:
                pass  # Best-effort cancellation
        notif.status = "cancelled"

    await db.flush()
