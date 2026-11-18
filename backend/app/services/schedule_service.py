"""
Schedule service — conflict detection and free-slot finding.
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schedule import Activity
from app.schemas.schedule import ConflictInfo


async def find_conflicts(
    db: AsyncSession,
    payload_user_id: str,
    start_time: datetime,
    end_time: datetime,
    exclude_id: str | None = None,
) -> list[ConflictInfo]:
    """
    Return any FIXED activities that overlap with [start_time, end_time].
    Non-fixed activities generate a warning but are not hard conflicts.
    """
    query = select(Activity).where(
        Activity.payload_user_id == payload_user_id,
        Activity.is_fixed.is_(True),
        Activity.status.not_in(["cancelled", "completed"]),
        # Overlapping: existing.start < new.end AND existing.end > new.start
        Activity.start_time < end_time,
        Activity.end_time > start_time,
    )
    if exclude_id:
        query = query.where(Activity.id != exclude_id)

    result = await db.execute(query)
    conflicts = result.scalars().all()

    return [
        ConflictInfo(
            conflicting_activity_id=a.id,
            conflicting_title=a.title,
            overlap_start=max(a.start_time, start_time),
            overlap_end=min(a.end_time, end_time),
        )
        for a in conflicts
    ]


async def find_free_slots(
    db: AsyncSession,
    payload_user_id: str,
    week_start: datetime,
    duration_minutes: int,
    work_start: str = "09:00",
    work_end: str = "18:00",
    work_days: list[int] = None,
) -> list[tuple[datetime, datetime]]:
    """
    Find available time slots in the given week for an activity of duration_minutes.
    Returns a list of (start, end) tuples in UTC.
    """
    if work_days is None:
        work_days = [0, 1, 2, 3, 4]  # Mon–Fri

    week_end = week_start + timedelta(days=7)

    # Fetch all activities for the week
    result = await db.execute(
        select(Activity).where(
            Activity.payload_user_id == payload_user_id,
            Activity.status.not_in(["cancelled", "skipped"]),
            Activity.start_time >= week_start,
            Activity.end_time <= week_end,
        )
    )
    existing = sorted(result.scalars().all(), key=lambda a: a.start_time)

    free_slots: list[tuple[datetime, datetime]] = []
    duration = timedelta(minutes=duration_minutes)

    for day_offset in range(7):
        day = week_start + timedelta(days=day_offset)
        if day.weekday() not in work_days:
            continue

        wh, wm = map(int, work_start.split(":"))
        eh, em = map(int, work_end.split(":"))
        day_start = day.replace(hour=wh, minute=wm, second=0, microsecond=0)
        day_end = day.replace(hour=eh, minute=em, second=0, microsecond=0)

        # Busy intervals on this day
        busy = [
            (a.start_time, a.end_time)
            for a in existing
            if a.start_time.date() == day.date()
        ]
        busy.sort()

        cursor = day_start
        for b_start, b_end in busy:
            if cursor + duration <= b_start:
                free_slots.append((cursor, cursor + duration))
            cursor = max(cursor, b_end)

        if cursor + duration <= day_end:
            free_slots.append((cursor, cursor + duration))

    return free_slots
