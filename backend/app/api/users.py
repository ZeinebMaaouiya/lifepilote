"""User profile, identity sync and notification preferences."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.inspection import inspect

from app.api.helpers import api_error
from app.dependencies import DB, CurrentUser
from app.models.ai import AIConversation, AIMessage, AIRecommendation
from app.models.finance import BudgetCategory, Expense, MonthlyBudget, RecurringPayment
from app.models.food import (
    FoodPreference,
    GroceryItem,
    PlannedMeal,
    Recipe,
    RecipeIngredient,
    WeeklyMealPlan,
)
from app.models.goals import FinancialGoal, PersonalGoal
from app.models.notification import Notification, NotificationPreference
from app.models.schedule import Activity, RecurringActivity, WorkingHours
from app.schemas.user import (
    NotificationPrefOut,
    NotificationPrefUpdate,
    SyncRequest,
    UserProfileOut,
    UserProfileUpdate,
)
from app.services.notification_service import get_or_create_preferences

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfileOut)
async def get_me(user: CurrentUser) -> UserProfileOut:
    return UserProfileOut.model_validate(user)


@router.get("/me/export")
async def export_my_data(user: CurrentUser, db: DB) -> dict:
    """Export the caller's app data in a portable JSON document."""
    direct_models = [
        MonthlyBudget,
        BudgetCategory,
        Expense,
        RecurringPayment,
        PersonalGoal,
        FinancialGoal,
        Activity,
        RecurringActivity,
        WorkingHours,
        FoodPreference,
        Recipe,
        WeeklyMealPlan,
        GroceryItem,
        Notification,
        NotificationPreference,
        AIConversation,
        AIRecommendation,
    ]
    data: dict[str, list[dict]] = {}

    def serialize(row) -> dict:
        return {
            column.key: jsonable_encoder(getattr(row, column.key))
            for column in inspect(type(row)).columns
        }

    for model in direct_models:
        result = await db.execute(
            select(model).where(model.payload_user_id == user.payload_user_id)
        )
        data[model.__tablename__] = [serialize(row) for row in result.scalars().all()]

    child_queries = {
        "ai_messages": select(AIMessage)
        .join(AIConversation, AIMessage.conversation_id == AIConversation.id)
        .where(AIConversation.payload_user_id == user.payload_user_id),
        "recipe_ingredients": select(RecipeIngredient)
        .join(Recipe, RecipeIngredient.recipe_id == Recipe.id)
        .where(Recipe.payload_user_id == user.payload_user_id),
        "planned_meals": select(PlannedMeal)
        .join(WeeklyMealPlan, PlannedMeal.plan_id == WeeklyMealPlan.id)
        .where(WeeklyMealPlan.payload_user_id == user.payload_user_id),
    }
    for name, query in child_queries.items():
        result = await db.execute(query)
        data[name] = [serialize(row) for row in result.scalars().all()]

    # Push endpoint credentials are intentionally excluded from exports.
    return {
        "format": "lifepilot-data-export-v1",
        "exported_at": datetime.now(UTC).isoformat(),
        "profile": jsonable_encoder(
            {
                "first_name": user.first_name,
                "email": user.email,
                "language": user.language,
                "theme": user.theme,
                "timezone": user.timezone,
                "currency": user.currency,
                "simplified_ui": user.simplified_ui,
            }
        ),
        "data": data,
    }


@router.patch("/me", response_model=UserProfileOut)
async def update_me(
    payload: UserProfileUpdate,
    user: CurrentUser,
    db: DB,
) -> UserProfileOut:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return UserProfileOut.model_validate(user)


@router.post("/sync", response_model=UserProfileOut)
async def sync_identity(
    payload: SyncRequest,
    user: CurrentUser,
    db: DB,
) -> UserProfileOut:
    """
    Sync the authenticated Better Auth identity into the backend profile.

    The JWT identity is authoritative: a body that claims a different user id
    is rejected rather than trusted.
    """
    if payload.auth_user_id != user.better_auth_user_id:
        raise api_error(
            status.HTTP_403_FORBIDDEN,
            "identity_mismatch",
            "The supplied auth identity does not match the authenticated token.",
        )

    user.email = payload.email or user.email
    user.first_name = payload.first_name or user.first_name
    user.language = payload.language
    user.theme = payload.theme

    await db.commit()
    await db.refresh(user)
    return UserProfileOut.model_validate(user)


@router.get("/me/notification-preferences", response_model=NotificationPrefOut)
async def get_notification_preferences(
    user: CurrentUser,
    db: DB,
) -> NotificationPrefOut:
    prefs = await get_or_create_preferences(db, user.payload_user_id)
    await db.commit()
    await db.refresh(prefs)
    return NotificationPrefOut.model_validate(prefs)


@router.patch("/me/notification-preferences", response_model=NotificationPrefOut)
async def update_notification_preferences(
    payload: NotificationPrefUpdate,
    user: CurrentUser,
    db: DB,
) -> NotificationPrefOut:
    prefs = await get_or_create_preferences(db, user.payload_user_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(prefs, field, value)
    await db.commit()
    await db.refresh(prefs)
    return NotificationPrefOut.model_validate(prefs)
