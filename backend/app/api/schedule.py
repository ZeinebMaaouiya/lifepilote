"""Schedule endpoints: activities, conflicts, free slots and AI proposals."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from app.api.helpers import api_error, not_found
from app.dependencies import DB, CurrentUser
from app.models.ai import AIRecommendation
from app.models.schedule import Activity, RecurringActivity, WorkingHours
from app.schemas.schedule import (
    ActivityCreate,
    ActivityCreateResult,
    ActivityOut,
    ActivityUpdate,
    ConflictInfo,
    NLScheduleRequest,
    ProposedActivity,
    ScheduleConfirm,
    ScheduleProposal,
    WorkingHoursOut,
    WorkingHoursUpdate,
)
from app.services.ai_service import (
    AIConfigurationError,
    AIProviderError,
    chat_completion,
    extract_json,
)
from app.services.notification_service import (
    cancel_activity_reminders,
    schedule_activity_reminders,
)
from app.services.schedule_service import find_conflicts, find_free_slots

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/schedule", tags=["schedule"])


async def _load_activity(db, activity_id: str, user) -> Activity:
    result = await db.execute(
        select(Activity).where(
            Activity.id == activity_id,
            Activity.payload_user_id == user.payload_user_id,
        )
    )
    activity = result.scalar_one_or_none()
    if activity is None:
        raise not_found("Activity")
    return activity


async def _get_working_hours(db, user) -> WorkingHours:
    result = await db.execute(
        select(WorkingHours).where(
            WorkingHours.payload_user_id == user.payload_user_id
        )
    )
    hours = result.scalar_one_or_none()
    if hours is None:
        hours = WorkingHours(
            payload_user_id=user.payload_user_id,
            work_start="09:00",
            work_end="18:00",
            work_days=[0, 1, 2, 3, 4],
        )
        db.add(hours)
        await db.flush()
    return hours


def _conflict_payload(conflicts: list[ConflictInfo]) -> list[dict]:
    return [conflict.model_dump(mode="json") for conflict in conflicts]


async def _best_effort_schedule_reminders(db, activity: Activity, user) -> None:
    """Create reminder rows/tasks without failing the main request."""
    try:
        await schedule_activity_reminders(
            db, activity, user.payload_user_id, user.language
        )
        await db.commit()
    except Exception as exc:  # broker unavailable, etc.
        await db.rollback()
        logger.warning("Could not schedule reminders for %s: %s", activity.id, exc)


async def _best_effort_cancel_reminders(db, activity_id: str, user) -> None:
    try:
        await cancel_activity_reminders(db, activity_id, user.payload_user_id)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.warning("Could not cancel reminders for %s: %s", activity_id, exc)


# ── Activities ───────────────────────────────────────────────────────────────

@router.get("/activities", response_model=list[ActivityOut])
async def list_activities(
    user: CurrentUser,
    db: DB,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
) -> list[ActivityOut]:
    query = select(Activity).where(
        Activity.payload_user_id == user.payload_user_id
    )
    if date_from:
        query = query.where(Activity.end_time >= date_from)
    if date_to:
        query = query.where(Activity.start_time <= date_to)

    result = await db.execute(query.order_by(Activity.start_time))
    return [
        ActivityOut.model_validate(activity)
        for activity in result.scalars().all()
    ]


@router.post(
    "/activities",
    response_model=ActivityCreateResult,
    status_code=status.HTTP_201_CREATED,
)
async def create_activity(
    payload: ActivityCreate,
    user: CurrentUser,
    db: DB,
) -> ActivityCreateResult:
    conflicts = await find_conflicts(
        db, user.payload_user_id, payload.start_time, payload.end_time
    )
    if conflicts and not payload.override_conflict:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "schedule_conflict",
            "This activity overlaps a fixed activity.",
            conflicts=_conflict_payload(conflicts),
        )

    activity = Activity(
        payload_user_id=user.payload_user_id,
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_fixed=payload.is_fixed,
        is_flexible=payload.is_flexible,
        is_recurring=payload.is_recurring,
        priority=payload.priority,
        color=payload.color,
        deadline=payload.deadline,
    )
    db.add(activity)
    await db.flush()

    if payload.is_recurring and payload.recurrence_frequency:
        config = RecurringActivity(
            payload_user_id=user.payload_user_id,
            base_activity_id=activity.id,
            frequency=payload.recurrence_frequency,
            days_of_week=payload.recurrence_days or [],
            end_date=payload.recurrence_end_date,
        )
        db.add(config)
        await db.flush()
        activity.recurring_config_id = config.id

    await db.commit()
    await db.refresh(activity)
    await _best_effort_schedule_reminders(db, activity, user)

    return ActivityCreateResult(
        activity=ActivityOut.model_validate(activity),
        conflicts=conflicts,
    )


@router.get("/activities/{activity_id}", response_model=ActivityOut)
async def get_activity(
    activity_id: str,
    user: CurrentUser,
    db: DB,
) -> ActivityOut:
    return ActivityOut.model_validate(await _load_activity(db, activity_id, user))


@router.patch("/activities/{activity_id}", response_model=ActivityCreateResult)
async def update_activity(
    activity_id: str,
    payload: ActivityUpdate,
    user: CurrentUser,
    db: DB,
) -> ActivityCreateResult:
    activity = await _load_activity(db, activity_id, user)
    fields = payload.model_dump(exclude_unset=True)
    fields.pop("override_conflict", None)

    new_start = fields.get("start_time", activity.start_time)
    new_end = fields.get("end_time", activity.end_time)
    if new_end <= new_start:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "invalid_time_range",
            "end_time must be after start_time.",
        )

    conflicts: list[ConflictInfo] = []
    if "start_time" in fields or "end_time" in fields:
        conflicts = await find_conflicts(
            db,
            user.payload_user_id,
            new_start,
            new_end,
            exclude_id=activity.id,
        )
        if conflicts and not payload.override_conflict:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "schedule_conflict",
                "This activity overlaps a fixed activity.",
                conflicts=_conflict_payload(conflicts),
            )

    time_changed = "start_time" in fields or "end_time" in fields
    if time_changed:
        await _best_effort_cancel_reminders(db, activity.id, user)

    for field, value in fields.items():
        setattr(activity, field, value)

    await db.commit()
    await db.refresh(activity)

    if time_changed:
        await _best_effort_schedule_reminders(db, activity, user)

    return ActivityCreateResult(
        activity=ActivityOut.model_validate(activity),
        conflicts=conflicts,
    )


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(
    activity_id: str,
    user: CurrentUser,
    db: DB,
) -> None:
    activity = await _load_activity(db, activity_id, user)
    await _best_effort_cancel_reminders(db, activity.id, user)
    await db.delete(activity)
    await db.commit()


# ── Working hours & free slots ───────────────────────────────────────────────

@router.get("/working-hours", response_model=WorkingHoursOut)
async def get_working_hours(user: CurrentUser, db: DB) -> WorkingHoursOut:
    hours = await _get_working_hours(db, user)
    await db.commit()
    await db.refresh(hours)
    return WorkingHoursOut.model_validate(hours)


@router.put("/working-hours", response_model=WorkingHoursOut)
async def update_working_hours(
    payload: WorkingHoursUpdate,
    user: CurrentUser,
    db: DB,
) -> WorkingHoursOut:
    hours = await _get_working_hours(db, user)
    hours.work_start = payload.work_start
    hours.work_end = payload.work_end
    hours.work_days = sorted(set(payload.work_days))
    await db.commit()
    await db.refresh(hours)
    return WorkingHoursOut.model_validate(hours)


@router.get("/free-slots")
async def get_free_slots(
    user: CurrentUser,
    db: DB,
    week_start: datetime = Query(...),
    duration_minutes: int = Query(60, ge=5, le=480),
) -> list[dict]:
    hours = await _get_working_hours(db, user)
    await db.commit()
    slots = await find_free_slots(
        db,
        user.payload_user_id,
        week_start,
        duration_minutes,
        work_start=hours.work_start,
        work_end=hours.work_end,
        work_days=hours.work_days,
    )
    return [{"start": start, "end": end} for start, end in slots]


# ── AI schedule proposals ────────────────────────────────────────────────────

_PROPOSAL_SYSTEM = """You are LifePilot AI's scheduling assistant.
Return ONLY a JSON object with this exact shape:
{
  "activities": [
    {
      "title": "string",
      "start_time": "ISO-8601 datetime with timezone offset",
      "end_time": "ISO-8601 datetime with timezone offset",
      "priority": "low|medium|high|critical",
      "color": "violet|blue|green|amber|rose",
      "is_new": true
    }
  ],
  "explanation": "short explanation for the user"
}
Do not wrap the JSON in prose or markdown. Never invent past dates."""


@router.post("/proposals", response_model=ScheduleProposal)
async def create_schedule_proposal(
    payload: NLScheduleRequest,
    user: CurrentUser,
    db: DB,
) -> ScheduleProposal:
    now = datetime.now(tz=UTC)
    week_start = payload.target_week_start or now.date()
    window_start = datetime.combine(week_start, datetime.min.time(), tzinfo=UTC)
    window_end = window_start + timedelta(days=14)

    result = await db.execute(
        select(Activity)
        .where(
            Activity.payload_user_id == user.payload_user_id,
            Activity.start_time >= window_start,
            Activity.start_time < window_end,
        )
        .order_by(Activity.start_time)
    )
    existing = [
        {
            "title": activity.title,
            "start_time": activity.start_time.isoformat(),
            "end_time": activity.end_time.isoformat(),
            "is_fixed": activity.is_fixed,
        }
        for activity in result.scalars().all()
    ]

    context = json.dumps(existing, ensure_ascii=False)
    try:
        text, model = await chat_completion(
            [
                {
                    "role": "user",
                    "content": (
                        f"Current time (UTC): {now.isoformat()}\n"
                        f"Requested window starts: {window_start.isoformat()}\n"
                        f"Existing activities: {context}\n\n"
                        f"User request: {payload.text}"
                    ),
                }
            ],
            system=_PROPOSAL_SYSTEM,
            temperature=0.2,
        )
        data = extract_json(text)
        if not isinstance(data, dict):
            raise AIProviderError("The AI response must be a JSON object.")
        proposed = [
            ProposedActivity.model_validate(item)
            for item in data.get("activities", [])
        ]
    except AIConfigurationError as exc:
        raise api_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "ai_not_configured",
            str(exc),
        ) from exc
    except (AIProviderError, ValueError) as exc:
        raise api_error(
            status.HTTP_502_BAD_GATEWAY,
            "ai_invalid_response",
            f"Could not build a schedule proposal: {exc}",
        ) from exc

    conflicts: list[ConflictInfo] = []
    for item in proposed:
        conflicts.extend(
            await find_conflicts(
                db, user.payload_user_id, item.start_time, item.end_time
            )
        )

    explanation = str(data.get("explanation", ""))
    recommendation = AIRecommendation(
        payload_user_id=user.payload_user_id,
        type="schedule",
        payload_json=json.dumps(
            {
                "activities": [item.model_dump(mode="json") for item in proposed],
                "explanation": explanation,
                "model": model,
            },
            ensure_ascii=False,
        ),
        status="pending",
        expires_at=now + timedelta(hours=1),
    )
    db.add(recommendation)
    await db.commit()
    await db.refresh(recommendation)

    return ScheduleProposal(
        proposal_id=recommendation.id,
        activities=proposed,
        conflicts=conflicts,
        explanation=explanation,
        requires_confirmation=True,
    )


@router.post(
    "/proposals/{proposal_id}/confirm",
    response_model=list[ActivityOut],
)
async def confirm_schedule_proposal(
    proposal_id: str,
    payload: ScheduleConfirm,
    user: CurrentUser,
    db: DB,
) -> list[ActivityOut]:
    if payload.proposal_id != proposal_id:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "proposal_mismatch",
            "proposal_id in the body does not match the URL.",
        )

    result = await db.execute(
        select(AIRecommendation).where(
            AIRecommendation.id == proposal_id,
            AIRecommendation.payload_user_id == user.payload_user_id,
            AIRecommendation.type == "schedule",
        )
    )
    recommendation = result.scalar_one_or_none()
    if recommendation is None:
        raise not_found("Schedule proposal")
    if recommendation.status != "pending":
        raise api_error(
            status.HTTP_409_CONFLICT,
            "proposal_not_pending",
            f"This proposal is already {recommendation.status}.",
        )
    if recommendation.expires_at and recommendation.expires_at < datetime.now(
        tz=UTC
    ):
        recommendation.status = "expired"
        await db.commit()
        raise api_error(
            status.HTTP_410_GONE,
            "proposal_expired",
            "This proposal has expired. Generate a new one.",
        )

    data = json.loads(recommendation.payload_json)
    created: list[Activity] = []
    for item in data.get("activities", []):
        activity = Activity(
            payload_user_id=user.payload_user_id,
            title=item["title"],
            start_time=datetime.fromisoformat(item["start_time"]),
            end_time=datetime.fromisoformat(item["end_time"]),
            priority=item.get("priority", "medium"),
            color=item.get("color", "violet"),
        )
        db.add(activity)
        created.append(activity)

    recommendation.status = "accepted"
    recommendation.responded_at = datetime.now(tz=UTC)
    await db.commit()

    for activity in created:
        await db.refresh(activity)
        await _best_effort_schedule_reminders(db, activity, user)

    return [ActivityOut.model_validate(activity) for activity in created]
