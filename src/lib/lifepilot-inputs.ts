/** Input shapes accepted by the LifePilot server actions. */

export interface ExpenseInput {
  amount: string | number
  description?: string
  date: string
  category_id?: string | null
  payment_method?: 'card' | 'cash' | 'transfer'
}

export interface BudgetInput {
  year: number
  month: number
  total_income: string | number
  notes?: string
}

export interface BudgetUpdateInput {
  total_income?: string | number
  notes?: string | null
}

export interface CategoryInput {
  name: string
  allocated_amount: string | number
  color?: string
  icon?: string
}

export interface CategoryUpdateInput {
  name?: string
  allocated_amount?: string | number
  color?: string
  icon?: string
}

export interface RecurringInput {
  name: string
  amount: string | number
  frequency?: 'weekly' | 'monthly' | 'yearly'
  next_due_date: string
  icon?: string
  color?: string
  notes?: string
}

export interface RecurringUpdateInput {
  name?: string
  amount?: string | number
  frequency?: 'weekly' | 'monthly' | 'yearly'
  next_due_date?: string
  icon?: string
  color?: string
  notes?: string | null
  is_active?: boolean
}

export interface GoalInput {
  title: string
  description?: string
  target_value: string | number
  deadline?: string | null
  priority?: 'low' | 'medium' | 'high' | 'critical'
  period?: 'monthly' | 'yearly'
  color?: string
  icon?: string
  financial_target_amount?: string | number | null
}

export interface GoalUpdateInput {
  title?: string
  description?: string | null
  target_value?: string | number
  current_value?: string | number
  deadline?: string | null
  priority?: 'low' | 'medium' | 'high' | 'critical'
  status?: 'active' | 'completed' | 'paused' | 'cancelled'
  color?: string
  icon?: string
}

export interface ActivityInput {
  title: string
  description?: string
  start_time: string
  end_time: string
  is_fixed?: boolean
  is_flexible?: boolean
  priority?: 'low' | 'medium' | 'high' | 'critical'
  color?: string
  deadline?: string | null
  is_recurring?: boolean
  recurrence_frequency?: 'daily' | 'weekly' | 'monthly' | null
  recurrence_days?: number[] | null
  recurrence_end_date?: string | null
  override_conflict?: boolean
}

export interface ActivityUpdateInput {
  title?: string
  description?: string | null
  start_time?: string
  end_time?: string
  is_fixed?: boolean
  is_flexible?: boolean
  priority?: 'low' | 'medium' | 'high' | 'critical'
  color?: string
  deadline?: string | null
  status?: 'scheduled' | 'completed' | 'cancelled' | 'skipped'
  override_conflict?: boolean
}

export interface WorkingHoursInput {
  work_start: string
  work_end: string
  work_days: number[]
}

export interface FoodPreferencesInput {
  excluded_ingredients?: string[]
  allergies?: string[]
  preferred_categories?: string[]
  preferred_cuisines?: string[]
  max_prep_minutes?: number
  weekly_food_budget?: string | number
}

export interface IngredientInput {
  name: string
  quantity?: string
  unit?: string
  estimated_price?: string | number
}

export interface RecipeInput {
  name: string
  category?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  prep_duration_min?: number
  instructions?: string
  notes?: string
  tags?: string[]
  ingredients?: IngredientInput[]
}

export interface MealUpdateInput {
  recipe_id?: string | null
  meal_name?: string | null
  is_locked?: boolean
}

export interface GroceryItemInput {
  ingredient_name: string
  quantity?: string
  unit?: string
  estimated_price?: string | number
  plan_id?: string | null
}

export interface GroceryItemUpdateInput {
  is_purchased?: boolean
  quantity?: string
  estimated_price?: string | number
}

export interface NotificationPrefsInput {
  enabled?: boolean
  reminder_minutes?: number[]
  in_app_enabled?: boolean
  push_enabled?: boolean
  email_enabled?: boolean
  weekly_summary_enabled?: boolean
  spending_alerts_enabled?: boolean
}

export interface ProfileInput {
  first_name?: string
  language?: 'en' | 'fr'
  theme?: 'dark' | 'light'
  currency?: string
  timezone?: string
  simplified_ui?: boolean
}
