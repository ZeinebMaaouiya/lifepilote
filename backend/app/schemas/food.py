"""Pydantic schemas for food, meals, and grocery management."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

# ── Food Preferences ──────────────────────────────────────────────────────────

class FoodPreferenceUpdate(BaseModel):
    excluded_ingredients: list[str] | None = None
    allergies: list[str] | None = None
    preferred_categories: list[str] | None = None
    preferred_cuisines: list[str] | None = None
    max_prep_minutes: int | None = Field(None, ge=5, le=300)
    weekly_food_budget: Decimal | None = Field(None, ge=0)


class FoodPreferenceOut(BaseModel):
    id: str
    excluded_ingredients: list[str]
    allergies: list[str]
    preferred_categories: list[str]
    preferred_cuisines: list[str]
    max_prep_minutes: int
    weekly_food_budget: Decimal

    model_config = {"from_attributes": True}


# ── Recipe ────────────────────────────────────────────────────────────────────

class IngredientIn(BaseModel):
    name: str = Field(..., max_length=150)
    quantity: str = Field("", max_length=50)
    unit: str = Field("", max_length=30)
    estimated_price: Decimal = Field(Decimal("0.00"), ge=0, decimal_places=2)


class IngredientOut(BaseModel):
    id: str
    name: str
    quantity: str
    unit: str
    estimated_price: Decimal
    price_is_estimate: bool = True  # Always true — never presented as verified market price

    model_config = {"from_attributes": True}


class RecipeCreate(BaseModel):
    name: str = Field(..., max_length=200)
    category: Literal["breakfast", "lunch", "dinner", "snack"] = "lunch"
    prep_duration_min: int = Field(30, ge=1, le=600)
    instructions: str | None = None
    notes: str | None = None
    tags: list[str] = []
    ingredients: list[IngredientIn] = []


class RecipeUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    category: Literal["breakfast", "lunch", "dinner", "snack"] | None = None
    prep_duration_min: int | None = Field(None, ge=1, le=600)
    instructions: str | None = None
    notes: str | None = None
    tags: list[str] | None = None
    ingredients: list[IngredientIn] | None = None


class RecipeOut(BaseModel):
    id: str
    name: str
    category: str
    prep_duration_min: int
    instructions: str | None
    notes: str | None
    tags: list[str]
    is_ai_generated: bool
    ingredients: list[IngredientOut] = []
    estimated_cost: Decimal
    estimated_cost_is_approximate: bool = True

    model_config = {"from_attributes": True}


# ── Meal Plan ─────────────────────────────────────────────────────────────────

class PlannedMealOut(BaseModel):
    id: str
    day_of_week: int  # 0=Mon … 6=Sun
    meal_type: str
    is_locked: bool
    is_manually_edited: bool
    meal_name: str | None
    recipe: RecipeOut | None = None

    model_config = {"from_attributes": True}


class WeeklyPlanOut(BaseModel):
    id: str
    week_start_date: date
    is_ai_generated: bool
    planned_meals: list[PlannedMealOut] = []
    estimated_weekly_cost: Decimal
    weekly_budget: Decimal

    model_config = {"from_attributes": True}


class MealUpdate(BaseModel):
    recipe_id: str | None = None
    meal_name: str | None = Field(None, max_length=200)
    is_locked: bool | None = None


class MealMove(BaseModel):
    meal_id: str
    target_day: int = Field(..., ge=0, le=6)
    target_meal_type: Literal["breakfast", "lunch", "dinner", "snack"]


class GeneratePlanRequest(BaseModel):
    week_start_date: date
    # If true, generate only unlocked slots; locked meals are preserved
    preserve_locked: bool = True
    preferences_override: FoodPreferenceUpdate | None = None


# ── Grocery ───────────────────────────────────────────────────────────────────

class GroceryItemCreate(BaseModel):
    ingredient_name: str = Field(..., max_length=150)
    quantity: str = Field("", max_length=50)
    unit: str = Field("", max_length=30)
    estimated_price: Decimal = Field(Decimal("0.00"), ge=0)
    plan_id: str | None = None


class GroceryItemUpdate(BaseModel):
    is_purchased: bool | None = None
    quantity: str | None = None
    estimated_price: Decimal | None = Field(None, ge=0)


class GroceryItemOut(BaseModel):
    id: str
    ingredient_name: str
    quantity: str
    unit: str
    estimated_price: Decimal
    is_purchased: bool
    is_manual: bool

    model_config = {"from_attributes": True}


class GroceryListOut(BaseModel):
    plan_id: str | None
    items: list[GroceryItemOut]
    estimated_total: Decimal
    purchased_total: Decimal
