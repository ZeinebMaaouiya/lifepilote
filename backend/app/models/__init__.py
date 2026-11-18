"""
Import every ORM model so SQLAlchemy's registry and Alembic autogenerate
can see the complete metadata.
"""

from app.models.ai import AIConversation, AIMessage, AIRecommendation
from app.models.finance import (
    BudgetCategory,
    Expense,
    MonthlyBudget,
    RecurringPayment,
)
from app.models.food import (
    FoodPreference,
    GroceryItem,
    PlannedMeal,
    Recipe,
    RecipeIngredient,
    WeeklyMealPlan,
)
from app.models.goals import FinancialGoal, PersonalGoal
from app.models.notification import (
    Notification,
    NotificationPreference,
    PushSubscription,
)
from app.models.schedule import Activity, RecurringActivity, WorkingHours
from app.models.user import UserProfile

__all__ = [
    "AIConversation",
    "AIRecommendation",
    "AIMessage",
    "Activity",
    "BudgetCategory",
    "Expense",
    "FinancialGoal",
    "FoodPreference",
    "GroceryItem",
    "MonthlyBudget",
    "Notification",
    "NotificationPreference",
    "PersonalGoal",
    "PlannedMeal",
    "PushSubscription",
    "Recipe",
    "RecipeIngredient",
    "RecurringActivity",
    "RecurringPayment",
    "UserProfile",
    "WeeklyMealPlan",
    "WorkingHours",
]
