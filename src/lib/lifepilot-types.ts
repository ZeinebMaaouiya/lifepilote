/**
 * Serializable types for the LifePilot AI FastAPI backend.
 *
 * Money values arrive as strings (Pydantic serialises Decimal as a string) and
 * timestamps are ISO-8601 strings, so these types are safe to pass from Server
 * Components into Client Components.
 */

export type Language = 'en' | 'fr'
export type Theme = 'dark' | 'light'
export type Money = string

export interface BackendErrorInfo {
  code: string
  message: string
  details?: Record<string, unknown>
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: BackendErrorInfo }

export interface BackendUser {
  id: string
  payload_user_id: string
  first_name: string
  email: string
  language: string
  theme: string
  timezone: string
  currency: string
  simplified_ui: boolean
  created_at: string
}

export interface NotificationPrefs {
  id: string
  enabled: boolean
  reminder_minutes: number[]
  in_app_enabled: boolean
  push_enabled: boolean
  email_enabled: boolean
  weekly_summary_enabled: boolean
  spending_alerts_enabled: boolean
}

export interface BudgetCategory {
  id: string
  name: string
  allocated_amount: Money
  color: string
  icon: string
  spent_amount: Money
}

export interface Budget {
  id: string
  year: number
  month: number
  total_income: Money
  notes: string | null
  categories: BudgetCategory[]
}

export interface BudgetSummary {
  budget_id: string
  year: number
  month: number
  total_income: Money
  total_allocated: Money
  total_expenses: Money
  reserved_recurring: Money
  available_discretionary: Money
  savings_this_month: Money
  over_budget_amount: Money
  utilization_pct: Money
}

export interface MonthlyReportRow {
  month: string
  income: Money
  expenses: Money
  savings: Money
}

export type PaymentMethod = 'card' | 'cash' | 'transfer'

export interface Expense {
  id: string
  amount: Money
  description: string
  date: string
  payment_method: PaymentMethod | string
  category_id: string | null
  category_name: string | null
  created_at: string
}

export interface ExpenseList {
  items: Expense[]
  total: number
  page: number
  page_size: number
}

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly'

export interface RecurringPayment {
  id: string
  name: string
  amount: Money
  frequency: RecurringFrequency | string
  next_due_date: string
  status: 'upcoming' | 'paid' | 'overdue' | string
  icon: string
  color: string
  notes: string | null
  is_active: boolean
}

export interface FinancialGoal {
  id: string
  target_amount: Money
  saved_amount: Money
  completion_pct: Money
}

export type GoalPriority = 'low' | 'medium' | 'high' | 'critical'
export type GoalStatus = 'active' | 'completed' | 'paused' | 'cancelled'
export type GoalPeriod = 'monthly' | 'yearly'

export interface Goal {
  id: string
  title: string
  description: string | null
  target_value: Money
  current_value: Money
  completion_pct: Money
  deadline: string | null
  priority: GoalPriority | string
  status: GoalStatus | string
  period: GoalPeriod | string
  color: string
  icon: string
  financial_goal: FinancialGoal | null
  created_at: string
}

export interface GoalList {
  items: Goal[]
  total: number
}

export type ActivityStatus = 'scheduled' | 'completed' | 'cancelled' | 'skipped'

export interface Activity {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  is_fixed: boolean
  is_flexible: boolean
  is_recurring: boolean
  priority: GoalPriority | string
  status: ActivityStatus | string
  color: string
  deadline: string | null
  recurring_config_id: string | null
  created_at: string
}

export interface ConflictInfo {
  conflicting_activity_id: string
  conflicting_title: string
  overlap_start: string
  overlap_end: string
}

export interface ActivityCreateResult {
  activity: Activity
  conflicts: ConflictInfo[]
}

export interface WorkingHours {
  id: string
  work_start: string
  work_end: string
  work_days: number[]
}

export interface ProposedActivity {
  title: string
  start_time: string
  end_time: string
  priority: string
  color: string
  is_new: boolean
}

export interface ScheduleProposal {
  proposal_id: string
  activities: ProposedActivity[]
  conflicts: ConflictInfo[]
  explanation: string
  requires_confirmation: boolean
}

export interface FoodPreferences {
  id: string
  excluded_ingredients: string[]
  allergies: string[]
  preferred_categories: string[]
  preferred_cuisines: string[]
  max_prep_minutes: number
  weekly_food_budget: Money
}

export interface Ingredient {
  id: string
  name: string
  quantity: string
  unit: string
  estimated_price: Money
  price_is_estimate: boolean
}

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Recipe {
  id: string
  name: string
  category: MealCategory | string
  prep_duration_min: number
  instructions: string | null
  notes: string | null
  tags: string[]
  is_ai_generated: boolean
  ingredients: Ingredient[]
  estimated_cost: Money
  estimated_cost_is_approximate: boolean
}

export interface PlannedMeal {
  id: string
  day_of_week: number
  meal_type: string
  is_locked: boolean
  is_manually_edited: boolean
  meal_name: string | null
  recipe: Recipe | null
}

export interface WeeklyPlan {
  id: string
  week_start_date: string
  is_ai_generated: boolean
  planned_meals: PlannedMeal[]
  estimated_weekly_cost: Money
  weekly_budget: Money
}

export interface GroceryItem {
  id: string
  ingredient_name: string
  quantity: string
  unit: string
  estimated_price: Money
  is_purchased: boolean
  is_manual: boolean
}

export interface GroceryList {
  plan_id: string | null
  items: GroceryItem[]
  estimated_total: Money
  purchased_total: Money
}

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  status: string
  scheduled_at: string
  delivered_at: string | null
  sent_in_app: boolean
  sent_push: boolean
  sent_email: boolean
  activity_id: string | null
  created_at: string
}

export interface NotificationList {
  items: NotificationItem[]
  unread_count: number
  total: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  token_count: number | null
  model_used: string | null
  created_at: string
}

export interface Conversation {
  id: string
  title: string
  is_archived: boolean
  created_at: string
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[]
}

export interface Recommendation {
  id: string
  type: string
  payload_json: string
  status: string
  expires_at: string | null
  created_at: string
}

export interface AIStatus {
  configured: boolean
  provider: string
}

export interface AppSnapshot {
  connected: boolean
  error: BackendErrorInfo | null
  user: BackendUser | null
  notificationPrefs: NotificationPrefs | null
  budgets: Budget[]
  activeBudget: Budget | null
  budgetSummary: BudgetSummary | null
  expenses: ExpenseList
  recurring: RecurringPayment[]
  goals: Goal[]
  activities: Activity[]
  workingHours: WorkingHours | null
  foodPrefs: FoodPreferences | null
  mealPlan: WeeklyPlan | null
  grocery: GroceryList | null
  recipes: Recipe[]
  notifications: NotificationList
  conversations: Conversation[]
  activeConversation: ConversationDetail | null
  recommendations: Recommendation[]
  aiStatus: AIStatus
  currency: string
  timezone: string
  today: string
  weekStart: string
}

export const emptyExpenseList: ExpenseList = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
}

export const emptyNotifications: NotificationList = {
  items: [],
  unread_count: 0,
  total: 0,
}
