"""Food endpoints: preferences, recipes, weekly plans and grocery lists."""

from __future__ import annotations

import json
import logging
from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.helpers import api_error, get_owned, not_found
from app.dependencies import DB, CurrentUser
from app.models.food import (
    FoodPreference,
    GroceryItem,
    PlannedMeal,
    Recipe,
    RecipeIngredient,
    WeeklyMealPlan,
)
from app.schemas.food import (
    FoodPreferenceOut,
    FoodPreferenceUpdate,
    GeneratePlanRequest,
    GroceryItemCreate,
    GroceryItemOut,
    GroceryItemUpdate,
    GroceryListOut,
    IngredientIn,
    IngredientOut,
    MealMove,
    MealUpdate,
    PlannedMealOut,
    RecipeCreate,
    RecipeOut,
    RecipeUpdate,
    WeeklyPlanOut,
)
from app.services.ai_service import (
    AIConfigurationError,
    AIProviderError,
    chat_completion,
    extract_json,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/food", tags=["food"])

MEAL_TYPES = ("breakfast", "lunch", "dinner")
ZERO = Decimal("0.00")


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_preferences(db, user) -> FoodPreference:
    result = await db.execute(
        select(FoodPreference).where(
            FoodPreference.payload_user_id == user.payload_user_id
        )
    )
    prefs = result.scalar_one_or_none()
    if prefs is None:
        prefs = FoodPreference(payload_user_id=user.payload_user_id)
        db.add(prefs)
        await db.flush()
    return prefs


async def _load_recipe(db, recipe_id: str, user) -> Recipe:
    result = await db.execute(
        select(Recipe)
        .options(selectinload(Recipe.ingredients))
        .where(
            Recipe.id == recipe_id,
            Recipe.payload_user_id == user.payload_user_id,
        )
    )
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise not_found("Recipe")
    return recipe


def _recipe_out(recipe: Recipe) -> RecipeOut:
    return RecipeOut(
        id=recipe.id,
        name=recipe.name,
        category=recipe.category,
        prep_duration_min=recipe.prep_duration_min,
        instructions=recipe.instructions,
        notes=recipe.notes,
        tags=recipe.tags or [],
        is_ai_generated=recipe.is_ai_generated,
        ingredients=[
            IngredientOut.model_validate(ingredient)
            for ingredient in recipe.ingredients
        ],
        estimated_cost=recipe.estimated_cost,
    )


def _plan_query():
    return select(WeeklyMealPlan).options(
        selectinload(WeeklyMealPlan.planned_meals)
        .selectinload(PlannedMeal.recipe)
        .selectinload(Recipe.ingredients),
        selectinload(WeeklyMealPlan.grocery_items),
    )


async def _load_plan(db, plan_id: str, user) -> WeeklyMealPlan:
    result = await db.execute(
        _plan_query().where(
            WeeklyMealPlan.id == plan_id,
            WeeklyMealPlan.payload_user_id == user.payload_user_id,
        )
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise not_found("Meal plan")
    return plan


async def _load_plan_by_week(db, user, week_start: date) -> WeeklyMealPlan:
    result = await db.execute(
        _plan_query().where(
            WeeklyMealPlan.payload_user_id == user.payload_user_id,
            WeeklyMealPlan.week_start_date == week_start,
        )
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise not_found("Meal plan")
    return plan


def _plan_out(plan: WeeklyMealPlan, prefs: FoodPreference) -> WeeklyPlanOut:
    meals: list[PlannedMealOut] = []
    total = ZERO
    for meal in plan.planned_meals:
        recipe_out = _recipe_out(meal.recipe) if meal.recipe else None
        if recipe_out:
            total += recipe_out.estimated_cost
        meals.append(
            PlannedMealOut(
                id=meal.id,
                day_of_week=meal.day_of_week,
                meal_type=meal.meal_type,
                is_locked=meal.is_locked,
                is_manually_edited=meal.is_manually_edited,
                meal_name=meal.meal_name,
                recipe=recipe_out,
            )
        )
    return WeeklyPlanOut(
        id=plan.id,
        week_start_date=plan.week_start_date,
        is_ai_generated=plan.is_ai_generated,
        planned_meals=meals,
        estimated_weekly_cost=total,
        weekly_budget=prefs.weekly_food_budget,
    )


def _meal_out(meal: PlannedMeal) -> PlannedMealOut:
    return PlannedMealOut(
        id=meal.id,
        day_of_week=meal.day_of_week,
        meal_type=meal.meal_type,
        is_locked=meal.is_locked,
        is_manually_edited=meal.is_manually_edited,
        meal_name=meal.meal_name,
        recipe=_recipe_out(meal.recipe) if meal.recipe else None,
    )


# ── Preferences ──────────────────────────────────────────────────────────────

@router.get("/preferences", response_model=FoodPreferenceOut)
async def get_preferences(user: CurrentUser, db: DB) -> FoodPreferenceOut:
    prefs = await _get_preferences(db, user)
    await db.commit()
    await db.refresh(prefs)
    return FoodPreferenceOut.model_validate(prefs)


@router.patch("/preferences", response_model=FoodPreferenceOut)
async def update_preferences(
    payload: FoodPreferenceUpdate,
    user: CurrentUser,
    db: DB,
) -> FoodPreferenceOut:
    prefs = await _get_preferences(db, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(prefs, field, value)
    await db.commit()
    await db.refresh(prefs)
    return FoodPreferenceOut.model_validate(prefs)


# ── Recipes ──────────────────────────────────────────────────────────────────

@router.get("/recipes", response_model=list[RecipeOut])
async def list_recipes(
    user: CurrentUser,
    db: DB,
    category: str | None = Query(None),
    search: str | None = Query(None, max_length=100),
) -> list[RecipeOut]:
    query = (
        select(Recipe)
        .options(selectinload(Recipe.ingredients))
        .where(Recipe.payload_user_id == user.payload_user_id)
        .order_by(Recipe.name)
    )
    if category:
        query = query.where(Recipe.category == category)
    if search:
        query = query.where(Recipe.name.ilike(f"%{search}%"))

    result = await db.execute(query)
    return [_recipe_out(recipe) for recipe in result.scalars().all()]


@router.post(
    "/recipes",
    response_model=RecipeOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_recipe(
    payload: RecipeCreate,
    user: CurrentUser,
    db: DB,
) -> RecipeOut:
    recipe = Recipe(
        payload_user_id=user.payload_user_id,
        name=payload.name,
        category=payload.category,
        prep_duration_min=payload.prep_duration_min,
        instructions=payload.instructions,
        notes=payload.notes,
        tags=payload.tags,
    )
    recipe.ingredients = [
        RecipeIngredient(**ingredient.model_dump())
        for ingredient in payload.ingredients
    ]
    db.add(recipe)
    await db.commit()
    return _recipe_out(recipe)


@router.get("/recipes/{recipe_id}", response_model=RecipeOut)
async def get_recipe(
    recipe_id: str,
    user: CurrentUser,
    db: DB,
) -> RecipeOut:
    return _recipe_out(await _load_recipe(db, recipe_id, user))


@router.patch("/recipes/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: str,
    payload: RecipeUpdate,
    user: CurrentUser,
    db: DB,
) -> RecipeOut:
    recipe = await _load_recipe(db, recipe_id, user)
    fields = payload.model_dump(exclude_unset=True)

    ingredients = fields.pop("ingredients", None)
    for field, value in fields.items():
        setattr(recipe, field, value)

    if ingredients is not None:
        recipe.ingredients = [
            RecipeIngredient(**ingredient) for ingredient in ingredients
        ]

    await db.commit()
    return _recipe_out(recipe)


@router.delete("/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(recipe_id: str, user: CurrentUser, db: DB) -> None:
    recipe = await _load_recipe(db, recipe_id, user)
    await db.delete(recipe)
    await db.commit()


# ── Weekly meal plans ────────────────────────────────────────────────────────

class _GeneratedMeal(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    meal_type: str
    name: str = Field(..., max_length=200)
    category: str = "lunch"
    prep_duration_min: int = Field(30, ge=1, le=600)
    ingredients: list[IngredientIn] = []


_GENERATION_SYSTEM = """You are LifePilot AI's meal-planning assistant.
Return ONLY a JSON object of this shape:
{
  "meals": [
    {
      "day_of_week": 0,
      "meal_type": "breakfast|lunch|dinner",
      "name": "dish name",
      "category": "breakfast|lunch|dinner|snack",
      "prep_duration_min": 30,
      "ingredients": [
        {"name": "ingredient", "quantity": "2", "unit": "pcs", "estimated_price": 1.50}
      ]
    }
  ]
}
Provide exactly 21 meals: breakfast, lunch and dinner for each of the 7 days
(day_of_week 0=Monday ... 6=Sunday). Respect every exclusion, allergy and
prep-time limit. Prices are rough estimates in the user's currency.
Do not wrap the JSON in prose or markdown."""


async def _generate_meals(
    prefs: FoodPreference,
    week_start: date,
    currency: str,
) -> list[_GeneratedMeal]:
    profile = {
        "excluded_ingredients": prefs.excluded_ingredients,
        "allergies": prefs.allergies,
        "preferred_categories": prefs.preferred_categories,
        "preferred_cuisines": prefs.preferred_cuisines,
        "max_prep_minutes": prefs.max_prep_minutes,
        "weekly_budget": str(prefs.weekly_food_budget),
        "currency": currency,
    }

    try:
        text, _ = await chat_completion(
            [
                {
                    "role": "user",
                    "content": (
                        f"Week starts {week_start.isoformat()}.\n"
                        f"User preferences: {json.dumps(profile, ensure_ascii=False)}"
                    ),
                }
            ],
            system=_GENERATION_SYSTEM,
            temperature=0.4,
        )
        data = extract_json(text)
        raw_meals = data.get("meals") if isinstance(data, dict) else data
        if not isinstance(raw_meals, list):
            raise ValueError("Expected a 'meals' array.")
        meals = [_GeneratedMeal.model_validate(item) for item in raw_meals]
    except AIConfigurationError as exc:
        raise api_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "ai_not_configured",
            str(exc),
        ) from exc
    except (AIProviderError, ValidationError, ValueError) as exc:
        raise api_error(
            status.HTTP_502_BAD_GATEWAY,
            "ai_invalid_response",
            f"Could not generate a meal plan: {exc}",
        ) from exc

    slots = {(meal.day_of_week, meal.meal_type) for meal in meals}
    if len(meals) != 21 or len(slots) != 21:
        raise api_error(
            status.HTTP_502_BAD_GATEWAY,
            "ai_invalid_response",
            "The AI returned an incomplete meal plan (expected 21 unique slots).",
        )

    return meals


def _sum_quantities(values: list[str]) -> str:
    """Add numeric quantity strings; fall back to joining distinct values."""
    total = Decimal("0")
    for value in values:
        try:
            total += Decimal(value)
        except (InvalidOperation, ValueError):
            return ", ".join(dict.fromkeys(values))
    return str(total.normalize()) if total else ""


async def _rebuild_grocery_items(
    db,
    plan: WeeklyMealPlan,
    recipes: list[Recipe],
) -> None:
    """Regenerate non-manual grocery items from the plan's recipes."""
    existing = await db.execute(
        select(GroceryItem).where(GroceryItem.plan_id == plan.id)
    )
    for item in existing.scalars().all():
        if not item.is_manual:
            await db.delete(item)
    await db.flush()

    aggregated: dict[tuple[str, str], dict] = {}
    for recipe in recipes:
        for ingredient in recipe.ingredients:
            key = (ingredient.name.strip().lower(), ingredient.unit.strip())
            entry = aggregated.setdefault(
                key,
                {
                    "name": ingredient.name,
                    "unit": ingredient.unit,
                    "quantities": [],
                    "price": ZERO,
                },
            )
            if ingredient.quantity:
                entry["quantities"].append(ingredient.quantity)
            entry["price"] += ingredient.estimated_price

    for (_name, unit), entry in aggregated.items():
        db.add(
            GroceryItem(
                payload_user_id=plan.payload_user_id,
                plan_id=plan.id,
                ingredient_name=entry["name"],
                quantity=_sum_quantities(entry["quantities"]),
                unit=unit,
                estimated_price=entry["price"],
                is_purchased=False,
                is_manual=False,
            )
        )
    await db.flush()


@router.get("/meal-plans", response_model=WeeklyPlanOut)
async def get_meal_plan(
    user: CurrentUser,
    db: DB,
    week_start: date = Query(...),
) -> WeeklyPlanOut:
    plan = await _load_plan_by_week(db, user, week_start)
    prefs = await _get_preferences(db, user)
    return _plan_out(plan, prefs)


@router.post("/meal-plans/generate", response_model=WeeklyPlanOut)
async def generate_meal_plan(
    payload: GeneratePlanRequest,
    user: CurrentUser,
    db: DB,
) -> WeeklyPlanOut:
    prefs = await _get_preferences(db, user)
    if payload.preferences_override:
        for field, value in payload.preferences_override.model_dump(
            exclude_unset=True
        ).items():
            setattr(prefs, field, value)
        await db.flush()

    generated = await _generate_meals(
        prefs, payload.week_start_date, user.currency
    )

    result = await db.execute(
        _plan_query().where(
            WeeklyMealPlan.payload_user_id == user.payload_user_id,
            WeeklyMealPlan.week_start_date == payload.week_start_date,
        )
    )
    plan = result.scalar_one_or_none()

    if plan is not None and not payload.preserve_locked:
        await db.delete(plan)
        await db.flush()
        plan = None

    if plan is None:
        plan = WeeklyMealPlan(
            payload_user_id=user.payload_user_id,
            week_start_date=payload.week_start_date,
            is_ai_generated=True,
        )
        db.add(plan)
        await db.flush()
        locked_slots: set[tuple[int, str]] = set()
    else:
        locked_slots = {
            (meal.day_of_week, meal.meal_type)
            for meal in plan.planned_meals
            if meal.is_locked
        }
        for meal in list(plan.planned_meals):
            if not meal.is_locked:
                await db.delete(meal)
        await db.flush()
        plan.is_ai_generated = True

    # Reuse recipes by name across slots.
    recipes_by_name: dict[str, Recipe] = {}
    existing_recipes = await db.execute(
        select(Recipe)
        .options(selectinload(Recipe.ingredients))
        .where(Recipe.payload_user_id == user.payload_user_id)
    )
    for recipe in existing_recipes.scalars().all():
        recipes_by_name[recipe.name.strip().lower()] = recipe

    used_recipes: list[Recipe] = []
    for meal in generated:
        slot = (meal.day_of_week, meal.meal_type)
        if slot in locked_slots:
            continue

        key = meal.name.strip().lower()
        recipe = recipes_by_name.get(key)
        if recipe is None:
            recipe = Recipe(
                payload_user_id=user.payload_user_id,
                name=meal.name,
                category=meal.category,
                prep_duration_min=meal.prep_duration_min,
                is_ai_generated=True,
            )
            recipe.ingredients = [
                RecipeIngredient(**ingredient.model_dump())
                for ingredient in meal.ingredients
            ]
            db.add(recipe)
            await db.flush()
            recipes_by_name[key] = recipe

        used_recipes.append(recipe)
        db.add(
            PlannedMeal(
                plan_id=plan.id,
                recipe_id=recipe.id,
                day_of_week=meal.day_of_week,
                meal_type=meal.meal_type,
                meal_name=meal.name,
            )
        )

    await db.flush()
    await _rebuild_grocery_items(db, plan, used_recipes)
    await db.commit()

    plan = await _load_plan(db, plan.id, user)
    prefs = await _get_preferences(db, user)
    return _plan_out(plan, prefs)


@router.patch(
    "/meal-plans/{plan_id}/meals/{meal_id}",
    response_model=PlannedMealOut,
)
async def update_meal(
    plan_id: str,
    meal_id: str,
    payload: MealUpdate,
    user: CurrentUser,
    db: DB,
) -> PlannedMealOut:
    plan = await _load_plan(db, plan_id, user)
    meal = next((item for item in plan.planned_meals if item.id == meal_id), None)
    if meal is None:
        raise not_found("Planned meal")

    fields = payload.model_dump(exclude_unset=True)
    if "recipe_id" in fields:
        recipe_id = fields.pop("recipe_id")
        if recipe_id:
            recipe = await _load_recipe(db, recipe_id, user)
            meal.recipe = recipe
            meal.recipe_id = recipe.id
            meal.meal_name = recipe.name
        else:
            meal.recipe = None
            meal.recipe_id = None

    for field, value in fields.items():
        setattr(meal, field, value)

    meal.is_manually_edited = True
    await db.commit()
    return _meal_out(meal)


@router.post(
    "/meal-plans/{plan_id}/meals/move",
    response_model=WeeklyPlanOut,
)
async def move_meal(
    plan_id: str,
    payload: MealMove,
    user: CurrentUser,
    db: DB,
) -> WeeklyPlanOut:
    plan = await _load_plan(db, plan_id, user)
    meal = next(
        (item for item in plan.planned_meals if item.id == payload.meal_id),
        None,
    )
    if meal is None:
        raise not_found("Planned meal")

    target = next(
        (
            item
            for item in plan.planned_meals
            if item.day_of_week == payload.target_day
            and item.meal_type == payload.target_meal_type
            and item.id != meal.id
        ),
        None,
    )

    source_day, source_type = meal.day_of_week, meal.meal_type
    if target is not None:
        # Swap the two slots instead of dropping a meal.
        target.day_of_week = source_day
        target.meal_type = source_type
        target.is_manually_edited = True

    meal.day_of_week = payload.target_day
    meal.meal_type = payload.target_meal_type
    meal.is_manually_edited = True

    await db.commit()
    plan = await _load_plan(db, plan_id, user)
    prefs = await _get_preferences(db, user)
    return _plan_out(plan, prefs)


# ── Grocery list ─────────────────────────────────────────────────────────────

@router.get("/grocery", response_model=GroceryListOut)
async def get_grocery_list(
    user: CurrentUser,
    db: DB,
    plan_id: str | None = Query(None),
) -> GroceryListOut:
    conditions = [GroceryItem.payload_user_id == user.payload_user_id]
    if plan_id:
        await _load_plan(db, plan_id, user)
        conditions.append(GroceryItem.plan_id == plan_id)

    result = await db.execute(
        select(GroceryItem)
        .where(*conditions)
        .order_by(GroceryItem.is_purchased, GroceryItem.ingredient_name)
    )
    items = [
        GroceryItemOut.model_validate(item) for item in result.scalars().all()
    ]

    return GroceryListOut(
        plan_id=plan_id,
        items=items,
        estimated_total=sum(
            (item.estimated_price for item in items), ZERO
        ),
        purchased_total=sum(
            (item.estimated_price for item in items if item.is_purchased), ZERO
        ),
    )


@router.post(
    "/grocery",
    response_model=GroceryItemOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_grocery_item(
    payload: GroceryItemCreate,
    user: CurrentUser,
    db: DB,
) -> GroceryItemOut:
    if payload.plan_id:
        await _load_plan(db, payload.plan_id, user)

    item = GroceryItem(
        payload_user_id=user.payload_user_id,
        plan_id=payload.plan_id,
        ingredient_name=payload.ingredient_name,
        quantity=payload.quantity,
        unit=payload.unit,
        estimated_price=payload.estimated_price,
        is_manual=True,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return GroceryItemOut.model_validate(item)


@router.patch("/grocery/{item_id}", response_model=GroceryItemOut)
async def update_grocery_item(
    item_id: str,
    payload: GroceryItemUpdate,
    user: CurrentUser,
    db: DB,
) -> GroceryItemOut:
    item = await get_owned(db, GroceryItem, item_id, user, "Grocery item")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return GroceryItemOut.model_validate(item)


@router.delete("/grocery/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grocery_item(
    item_id: str,
    user: CurrentUser,
    db: DB,
) -> None:
    item = await get_owned(db, GroceryItem, item_id, user, "Grocery item")
    await db.delete(item)
    await db.commit()
