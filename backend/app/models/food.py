"""
Food & Meal ORM models:
  - FoodPreference     (user dietary settings)
  - Recipe             (user-created or AI-generated recipes)
  - RecipeIngredient
  - WeeklyMealPlan
  - PlannedMeal        (a meal slot in a plan)
  - GroceryItem
"""

from decimal import Decimal

from sqlalchemy import (
    NUMERIC,
    Boolean,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._base import TimestampMixin, uuid_pk


class FoodPreference(Base, TimestampMixin):
    """User-level food and dietary preferences. One row per user."""

    __tablename__ = "food_preferences"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )

    excluded_ingredients: Mapped[list[str]] = mapped_column(
        PG_ARRAY(String), nullable=False, default=list
    )
    allergies: Mapped[list[str]] = mapped_column(
        PG_ARRAY(String), nullable=False, default=list
    )
    preferred_categories: Mapped[list[str]] = mapped_column(
        PG_ARRAY(String), nullable=False, default=list
    )  # breakfast | lunch | dinner | snack
    preferred_cuisines: Mapped[list[str]] = mapped_column(
        PG_ARRAY(String), nullable=False, default=list
    )
    max_prep_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    weekly_food_budget: Mapped[Decimal] = mapped_column(
        NUMERIC(12, 2), nullable=False, default=Decimal("0.00")
    )


class Recipe(Base, TimestampMixin):
    """A recipe (user-created or AI-generated)."""

    __tablename__ = "recipes"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(
        String(20), nullable=False, default="lunch"
    )  # breakfast | lunch | dinner | snack
    prep_duration_min: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    instructions: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    image_url: Mapped[str | None] = mapped_column(String(500))
    tags: Mapped[list[str]] = mapped_column(PG_ARRAY(String), nullable=False, default=list)

    # Relationships
    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan"
    )
    planned_meals: Mapped[list["PlannedMeal"]] = relationship(
        back_populates="recipe", passive_deletes=True
    )

    @property
    def estimated_cost(self) -> Decimal:
        return sum((i.estimated_price for i in self.ingredients), Decimal("0.00"))


class RecipeIngredient(Base, TimestampMixin):
    """A single ingredient in a recipe, with optional price estimate."""

    __tablename__ = "recipe_ingredients"

    id: Mapped[str] = uuid_pk()
    recipe_id: Mapped[str] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    unit: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    # Price is an estimate — clearly labeled as such in API responses
    estimated_price: Mapped[Decimal] = mapped_column(
        NUMERIC(10, 2), nullable=False, default=Decimal("0.00")
    )

    # Relationship
    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")


class WeeklyMealPlan(Base, TimestampMixin):
    """A 7-day meal plan. Unique per user per week start date."""

    __tablename__ = "weekly_meal_plans"
    __table_args__ = (UniqueConstraint("payload_user_id", "week_start_date"),)

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    week_start_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    planned_meals: Mapped[list["PlannedMeal"]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlannedMeal.day_of_week",
    )
    grocery_items: Mapped[list["GroceryItem"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )


class PlannedMeal(Base, TimestampMixin):
    """A single meal slot (day + meal type) in a weekly plan."""

    __tablename__ = "planned_meals"
    __table_args__ = (
        UniqueConstraint("plan_id", "day_of_week", "meal_type"),
    )

    id: Mapped[str] = uuid_pk()
    plan_id: Mapped[str] = mapped_column(
        ForeignKey("weekly_meal_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipe_id: Mapped[str | None] = mapped_column(
        ForeignKey("recipes.id", ondelete="SET NULL"), index=True
    )

    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon … 6=Sun
    meal_type: Mapped[str] = mapped_column(
        String(15), nullable=False
    )  # breakfast | lunch | dinner | snack
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_manually_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Fallback name if recipe is removed
    meal_name: Mapped[str | None] = mapped_column(String(200))

    # Relationships
    plan: Mapped["WeeklyMealPlan"] = relationship(back_populates="planned_meals")
    recipe: Mapped["Recipe | None"] = relationship(back_populates="planned_meals")


class GroceryItem(Base, TimestampMixin):
    """An item on the grocery shopping list for a meal plan."""

    __tablename__ = "grocery_items"

    id: Mapped[str] = uuid_pk()
    payload_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    plan_id: Mapped[str | None] = mapped_column(
        ForeignKey("weekly_meal_plans.id", ondelete="SET NULL"), index=True
    )

    ingredient_name: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    unit: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    estimated_price: Mapped[Decimal] = mapped_column(
        NUMERIC(10, 2), nullable=False, default=Decimal("0.00")
    )
    is_purchased: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_manual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationship
    plan: Mapped["WeeklyMealPlan | None"] = relationship(back_populates="grocery_items")
