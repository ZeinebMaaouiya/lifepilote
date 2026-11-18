"""Goals endpoints: personal goals and their financial dimension."""

from __future__ import annotations

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.helpers import api_error, not_found
from app.dependencies import DB, CurrentUser
from app.models.goals import FinancialGoal, PersonalGoal
from app.schemas.goals import (
    FinancialGoalOut,
    FinancialGoalUpdate,
    GoalCreate,
    GoalListOut,
    GoalOut,
    GoalUpdate,
    ProgressUpdate,
)

router = APIRouter(prefix="/goals", tags=["goals"])


def _goal_out(goal: PersonalGoal) -> GoalOut:
    financial = None
    if goal.financial_goal is not None:
        financial = FinancialGoalOut(
            id=goal.financial_goal.id,
            target_amount=goal.financial_goal.target_amount,
            saved_amount=goal.financial_goal.saved_amount,
            completion_pct=goal.financial_goal.completion_pct,
        )
    return GoalOut(
        id=goal.id,
        title=goal.title,
        description=goal.description,
        target_value=goal.target_value,
        current_value=goal.current_value,
        completion_pct=goal.completion_pct,
        deadline=goal.deadline,
        priority=goal.priority,
        status=goal.status,
        period=goal.period,
        color=goal.color,
        icon=goal.icon,
        financial_goal=financial,
        created_at=goal.created_at,
    )


async def _load_goal(db, goal_id: str, user) -> PersonalGoal:
    result = await db.execute(
        select(PersonalGoal)
        .options(selectinload(PersonalGoal.financial_goal))
        .where(
            PersonalGoal.id == goal_id,
            PersonalGoal.payload_user_id == user.payload_user_id,
        )
    )
    goal = result.scalar_one_or_none()
    if goal is None:
        raise not_found("Goal")
    return goal


@router.get("", response_model=GoalListOut)
async def list_goals(
    user: CurrentUser,
    db: DB,
    status_filter: str | None = Query(None, alias="status"),
    period: str | None = Query(None, pattern="^(monthly|yearly)$"),
) -> GoalListOut:
    conditions = [PersonalGoal.payload_user_id == user.payload_user_id]
    if status_filter:
        conditions.append(PersonalGoal.status == status_filter)
    if period:
        conditions.append(PersonalGoal.period == period)

    total = await db.scalar(
        select(func.count()).select_from(PersonalGoal).where(*conditions)
    )
    result = await db.execute(
        select(PersonalGoal)
        .options(selectinload(PersonalGoal.financial_goal))
        .where(*conditions)
        .order_by(PersonalGoal.created_at.desc())
    )
    return GoalListOut(
        items=[_goal_out(goal) for goal in result.scalars().all()],
        total=int(total or 0),
    )


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: GoalCreate,
    user: CurrentUser,
    db: DB,
) -> GoalOut:
    data = payload.model_dump(exclude={"financial_target_amount"})
    goal = PersonalGoal(payload_user_id=user.payload_user_id, **data)

    if payload.financial_target_amount is not None:
        goal.financial_goal = FinancialGoal(
            payload_user_id=user.payload_user_id,
            target_amount=payload.financial_target_amount,
            saved_amount=0,
        )

    db.add(goal)
    await db.commit()
    return _goal_out(goal)


@router.get("/{goal_id}", response_model=GoalOut)
async def get_goal(goal_id: str, user: CurrentUser, db: DB) -> GoalOut:
    return _goal_out(await _load_goal(db, goal_id, user))


@router.patch("/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: str,
    payload: GoalUpdate,
    user: CurrentUser,
    db: DB,
) -> GoalOut:
    goal = await _load_goal(db, goal_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)

    # Completing the target auto-completes an active goal.
    if (
        goal.current_value >= goal.target_value
        and goal.status == "active"
        and goal.target_value > 0
    ):
        goal.status = "completed"

    await db.commit()
    return _goal_out(goal)


@router.patch("/{goal_id}/progress", response_model=GoalOut)
async def update_progress(
    goal_id: str,
    payload: ProgressUpdate,
    user: CurrentUser,
    db: DB,
) -> GoalOut:
    goal = await _load_goal(db, goal_id, user)
    goal.current_value = payload.current_value

    if goal.target_value > 0 and goal.current_value >= goal.target_value:
        goal.status = "completed"
    elif goal.status == "completed":
        goal.status = "active"

    await db.commit()
    return _goal_out(goal)


@router.patch("/{goal_id}/financial", response_model=FinancialGoalOut)
async def update_financial_goal(
    goal_id: str,
    payload: FinancialGoalUpdate,
    user: CurrentUser,
    db: DB,
) -> FinancialGoalOut:
    goal = await _load_goal(db, goal_id, user)
    if goal.financial_goal is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "financial_goal_missing",
            "This goal has no financial target.",
        )

    goal.financial_goal.saved_amount = payload.saved_amount
    await db.commit()
    return FinancialGoalOut(
        id=goal.financial_goal.id,
        target_amount=goal.financial_goal.target_amount,
        saved_amount=goal.financial_goal.saved_amount,
        completion_pct=goal.financial_goal.completion_pct,
    )


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(goal_id: str, user: CurrentUser, db: DB) -> None:
    goal = await _load_goal(db, goal_id, user)
    await db.delete(goal)
    await db.commit()
