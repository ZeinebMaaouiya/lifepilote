'use server'

import { appAuth } from '@/lib/app-auth'
import { getPrisma } from '@/lib/prisma'
import { BackendError, backendFetch, errorInfo } from '@/lib/lifepilot-api'
import {
  loadConversation,
  loadMealPlanForWeek,
  loadNotifications,
  loadScheduleWeek,
} from '@/lib/lifepilot-data'
import type {
  Activity,
  ActivityCreateResult,
  ActionResult,
  AIStatus,
  BackendUser,
  Budget,
  BudgetCategory,
  ChatMessage,
  Conversation,
  ConversationDetail,
  Expense,
  FoodPreferences,
  Goal,
  GroceryItem,
  NotificationItem,
  NotificationList,
  NotificationPrefs,
  MonthlyReportRow,
  Recipe,
  Recommendation,
  RecurringPayment,
  ScheduleProposal,
  WeeklyPlan,
  WorkingHours,
} from '@/lib/lifepilot-types'
import type {
  ActivityInput,
  ActivityUpdateInput,
  BudgetInput,
  BudgetUpdateInput,
  CategoryInput,
  CategoryUpdateInput,
  ExpenseInput,
  FoodPreferencesInput,
  GoalInput,
  GoalUpdateInput,
  GroceryItemInput,
  GroceryItemUpdateInput,
  NotificationPrefsInput,
  ProfileInput,
  RecipeInput,
  RecurringInput,
  RecurringUpdateInput,
  WorkingHoursInput,
} from '@/lib/lifepilot-inputs'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

function fail(message: string): never {
  throw new BackendError(422, 'validation_error', message)
}

function text(value: unknown, label: string, maxLength: number, required = true): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    if (required) fail(`${label} is required.`)
    return ''
  }
  if (raw.length > maxLength) fail(`${label} is too long.`)
  return raw
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const raw = value.trim()
  if (!raw) return undefined
  if (raw.length > maxLength) fail('One of the text values is too long.')
  return raw
}

function money(value: unknown, label: string, options: { positive?: boolean } = {}): string {
  const raw = typeof value === 'number' ? String(value) : String(value ?? '').replace(',', '.')
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0 || (options.positive && parsed <= 0)) {
    fail(`${label} must be ${options.positive ? 'greater than zero' : 'a positive amount'}.`)
  }
  return parsed.toFixed(2)
}

function optionalMoney(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return money(value, label)
}

function date(value: unknown, label: string, required = true): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    if (required) fail(`${label} is required.`)
    return ''
  }
  if (!DATE_RE.test(raw)) fail(`${label} must be a valid date.`)
  return raw
}

function isoDateTime(value: unknown, label: string): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  const parsed = new Date(raw)
  if (!raw || Number.isNaN(parsed.getTime())) fail(`${label} must be a valid date and time.`)
  return parsed.toISOString()
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(`${label} is not a supported value.`)
  }
  return value as T
}

function stringList(value: unknown, maxItems = 30, maxLength = 80): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength))
}

async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() }
  } catch (error) {
    return { ok: false, error: errorInfo(error) }
  }
}

function id(value: unknown, label = 'Record'): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 64) {
    fail(`${label} identifier is invalid.`)
  }
  return value
}

// ── Finance ───────────────────────────────────────────────────────────────────

export async function createBudgetAction(input: BudgetInput): Promise<ActionResult<Budget>> {
  return run(() => {
    const year = Number(input.year)
    const month = Number(input.month)
    if (!Number.isInteger(year) || year < 2020 || year > 2100) fail('Year is out of range.')
    if (!Number.isInteger(month) || month < 1 || month > 12) fail('Month is out of range.')
    return backendFetch<Budget>('/finance/budgets', {
      method: 'POST',
      body: {
        year,
        month,
        total_income: money(input.total_income, 'Income'),
        notes: optionalText(input.notes, 1000) ?? null,
      },
    })
  })
}

export async function updateBudgetAction(
  budgetId: string,
  input: BudgetUpdateInput,
): Promise<ActionResult<Budget>> {
  return run(() => {
    const body: Record<string, unknown> = {}
    if (input.total_income !== undefined) {
      body.total_income = money(input.total_income, 'Income')
    }
    if (input.notes !== undefined) {
      body.notes = optionalText(input.notes, 1000) ?? null
    }
    if (!Object.keys(body).length) fail('Nothing to update.')
    return backendFetch<Budget>(`/finance/budgets/${id(budgetId, 'Budget')}`, {
      method: 'PATCH',
      body,
    })
  })
}

export async function createCategoryAction(
  budgetId: string,
  input: CategoryInput,
): Promise<ActionResult<BudgetCategory>> {
  return run(() =>
    backendFetch<BudgetCategory>(`/finance/budgets/${id(budgetId, 'Budget')}/categories`, {
      method: 'POST',
      body: {
        name: text(input.name, 'Category name', 100),
        allocated_amount: money(input.allocated_amount, 'Allocated amount'),
        color: optionalText(input.color, 20) ?? 'violet',
        icon: optionalText(input.icon, 30) ?? 'wallet',
      },
    }),
  )
}

export async function updateCategoryAction(
  categoryId: string,
  input: CategoryUpdateInput,
): Promise<ActionResult<BudgetCategory>> {
  return run(() => {
    const body: Record<string, unknown> = {}
    if (input.name !== undefined) body.name = text(input.name, 'Category name', 100)
    if (input.allocated_amount !== undefined) {
      body.allocated_amount = money(input.allocated_amount, 'Allocated amount')
    }
    if (input.color !== undefined) body.color = optionalText(input.color, 20)
    if (input.icon !== undefined) body.icon = optionalText(input.icon, 30)
    if (!Object.keys(body).length) fail('Nothing to update.')
    return backendFetch<BudgetCategory>(`/finance/categories/${id(categoryId, 'Category')}`, {
      method: 'PATCH',
      body,
    })
  })
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await backendFetch<void>(`/finance/categories/${id(categoryId, 'Category')}`, {
      method: 'DELETE',
    })
    return null
  })
}

export async function createExpenseAction(input: ExpenseInput): Promise<ActionResult<Expense>> {
  return run(() =>
    backendFetch<Expense>('/finance/expenses', {
      method: 'POST',
      body: {
        amount: money(input.amount, 'Amount', { positive: true }),
        description: optionalText(input.description, 255) ?? '',
        date: date(input.date, 'Date'),
        category_id: input.category_id ? id(input.category_id, 'Category') : null,
        payment_method:
          oneOf(input.payment_method, ['card', 'cash', 'transfer'] as const, 'Payment method') ??
          'card',
      },
    }),
  )
}

export async function updateExpenseAction(
  expenseId: string,
  input: ExpenseInput,
): Promise<ActionResult<Expense>> {
  return run(() => {
    const body: Record<string, unknown> = {
      amount: money(input.amount, 'Amount', { positive: true }),
      description: optionalText(input.description, 255) ?? '',
      date: date(input.date, 'Date'),
    }
    if (input.category_id !== undefined) {
      body.category_id = input.category_id ? id(input.category_id, 'Category') : null
    }
    const method = oneOf(
      input.payment_method,
      ['card', 'cash', 'transfer'] as const,
      'Payment method',
    )
    if (method) body.payment_method = method
    return backendFetch<Expense>(`/finance/expenses/${id(expenseId, 'Expense')}`, {
      method: 'PATCH',
      body,
    })
  })
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await backendFetch<void>(`/finance/expenses/${id(expenseId, 'Expense')}`, {
      method: 'DELETE',
    })
    return null
  })
}

export async function createRecurringAction(
  input: RecurringInput,
): Promise<ActionResult<RecurringPayment>> {
  return run(() =>
    backendFetch<RecurringPayment>('/finance/recurring-payments', {
      method: 'POST',
      body: {
        name: text(input.name, 'Payment name', 150),
        amount: money(input.amount, 'Amount', { positive: true }),
        frequency:
          oneOf(input.frequency, ['weekly', 'monthly', 'yearly'] as const, 'Frequency') ??
          'monthly',
        next_due_date: date(input.next_due_date, 'Next due date'),
        icon: optionalText(input.icon, 30) ?? 'repeat',
        color: optionalText(input.color, 20) ?? 'blue',
        notes: optionalText(input.notes, 2000) ?? null,
      },
    }),
  )
}

export async function updateRecurringAction(
  paymentId: string,
  input: RecurringUpdateInput,
): Promise<ActionResult<RecurringPayment>> {
  return run(() => {
    const body: Record<string, unknown> = {}
    if (input.name !== undefined) body.name = text(input.name, 'Payment name', 150)
    if (input.amount !== undefined) body.amount = money(input.amount, 'Amount', { positive: true })
    if (input.frequency !== undefined) {
      body.frequency = oneOf(input.frequency, ['weekly', 'monthly', 'yearly'] as const, 'Frequency')
    }
    if (input.next_due_date !== undefined)
      body.next_due_date = date(input.next_due_date, 'Next due date')
    if (input.icon !== undefined) body.icon = optionalText(input.icon, 30)
    if (input.color !== undefined) body.color = optionalText(input.color, 20)
    if (input.notes !== undefined) body.notes = optionalText(input.notes, 2000) ?? null
    if (input.is_active !== undefined) body.is_active = Boolean(input.is_active)
    if (!Object.keys(body).length) fail('Nothing to update.')
    return backendFetch<RecurringPayment>(
      `/finance/recurring-payments/${id(paymentId, 'Recurring payment')}`,
      { method: 'PATCH', body },
    )
  })
}

export async function payRecurringAction(
  paymentId: string,
): Promise<ActionResult<RecurringPayment>> {
  return run(() =>
    backendFetch<RecurringPayment>(
      `/finance/recurring-payments/${id(paymentId, 'Recurring payment')}/pay`,
      { method: 'POST' },
    ),
  )
}

export async function deleteRecurringAction(paymentId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await backendFetch<void>(`/finance/recurring-payments/${id(paymentId, 'Recurring payment')}`, {
      method: 'DELETE',
    })
    return null
  })
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export async function createGoalAction(input: GoalInput): Promise<ActionResult<Goal>> {
  return run(() => {
    const body: Record<string, unknown> = {
      title: text(input.title, 'Goal title', 200),
      description: optionalText(input.description, 4000) ?? null,
      target_value: money(input.target_value, 'Target value'),
      deadline: input.deadline ? date(input.deadline, 'Deadline') : null,
      priority:
        oneOf(input.priority, ['low', 'medium', 'high', 'critical'] as const, 'Priority') ??
        'medium',
      period: oneOf(input.period, ['monthly', 'yearly'] as const, 'Period') ?? 'monthly',
      color: optionalText(input.color, 20) ?? 'violet',
      icon: optionalText(input.icon, 30) ?? 'target',
    }
    if (input.financial_target_amount !== undefined && input.financial_target_amount !== null) {
      body.financial_target_amount = money(input.financial_target_amount, 'Financial target')
    }
    return backendFetch<Goal>('/goals', { method: 'POST', body })
  })
}

export async function updateGoalAction(
  goalId: string,
  input: GoalUpdateInput,
): Promise<ActionResult<Goal>> {
  return run(() => {
    const body: Record<string, unknown> = {}
    if (input.title !== undefined) body.title = text(input.title, 'Goal title', 200)
    if (input.description !== undefined)
      body.description = optionalText(input.description, 4000) ?? null
    if (input.target_value !== undefined)
      body.target_value = money(input.target_value, 'Target value')
    if (input.current_value !== undefined)
      body.current_value = money(input.current_value, 'Current value')
    if (input.deadline !== undefined)
      body.deadline = input.deadline ? date(input.deadline, 'Deadline') : null
    if (input.priority !== undefined) {
      body.priority = oneOf(
        input.priority,
        ['low', 'medium', 'high', 'critical'] as const,
        'Priority',
      )
    }
    if (input.status !== undefined) {
      body.status = oneOf(
        input.status,
        ['active', 'completed', 'paused', 'cancelled'] as const,
        'Status',
      )
    }
    if (input.color !== undefined) body.color = optionalText(input.color, 20)
    if (input.icon !== undefined) body.icon = optionalText(input.icon, 30)
    if (!Object.keys(body).length) fail('Nothing to update.')
    return backendFetch<Goal>(`/goals/${id(goalId, 'Goal')}`, { method: 'PATCH', body })
  })
}

export async function updateGoalProgressAction(
  goalId: string,
  currentValue: string | number,
): Promise<ActionResult<Goal>> {
  return run(() =>
    backendFetch<Goal>(`/goals/${id(goalId, 'Goal')}/progress`, {
      method: 'PATCH',
      body: { current_value: money(currentValue, 'Progress value') },
    }),
  )
}

export async function updateGoalFinancialAction(
  goalId: string,
  savedAmount: string | number,
): Promise<
  ActionResult<{ id: string; target_amount: string; saved_amount: string; completion_pct: string }>
> {
  return run(() =>
    backendFetch(`/goals/${id(goalId, 'Goal')}/financial`, {
      method: 'PATCH',
      body: { saved_amount: money(savedAmount, 'Saved amount') },
    }),
  )
}

export async function deleteGoalAction(goalId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await backendFetch<void>(`/goals/${id(goalId, 'Goal')}`, { method: 'DELETE' })
    return null
  })
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export async function createActivityAction(
  input: ActivityInput,
): Promise<ActionResult<ActivityCreateResult>> {
  return run(() => {
    const body: Record<string, unknown> = {
      title: text(input.title, 'Activity title', 200),
      description: optionalText(input.description, 4000) ?? null,
      start_time: isoDateTime(input.start_time, 'Start time'),
      end_time: isoDateTime(input.end_time, 'End time'),
      is_fixed: Boolean(input.is_fixed),
      is_flexible: input.is_flexible ?? true,
      priority:
        oneOf(input.priority, ['low', 'medium', 'high', 'critical'] as const, 'Priority') ??
        'medium',
      color: optionalText(input.color, 20) ?? 'violet',
      deadline: input.deadline ? date(input.deadline, 'Deadline') : null,
      is_recurring: Boolean(input.is_recurring),
      recurrence_frequency: input.is_recurring
        ? (oneOf(
            input.recurrence_frequency,
            ['daily', 'weekly', 'monthly'] as const,
            'Recurrence',
          ) ?? 'weekly')
        : null,
      recurrence_days:
        input.is_recurring && Array.isArray(input.recurrence_days)
          ? input.recurrence_days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
          : null,
      recurrence_end_date:
        input.is_recurring && input.recurrence_end_date
          ? date(input.recurrence_end_date, 'Recurrence end date')
          : null,
      override_conflict: Boolean(input.override_conflict),
    }
    return backendFetch<ActivityCreateResult>('/schedule/activities', { method: 'POST', body })
  })
}

export async function updateActivityAction(
  activityId: string,
  input: ActivityUpdateInput,
): Promise<ActionResult<ActivityCreateResult>> {
  return run(() => {
    const body: Record<string, unknown> = {}
    if (input.title !== undefined) body.title = text(input.title, 'Activity title', 200)
    if (input.description !== undefined)
      body.description = optionalText(input.description, 4000) ?? null
    if (input.start_time !== undefined)
      body.start_time = isoDateTime(input.start_time, 'Start time')
    if (input.end_time !== undefined) body.end_time = isoDateTime(input.end_time, 'End time')
    if (input.is_fixed !== undefined) body.is_fixed = Boolean(input.is_fixed)
    if (input.is_flexible !== undefined) body.is_flexible = Boolean(input.is_flexible)
    if (input.priority !== undefined) {
      body.priority = oneOf(
        input.priority,
        ['low', 'medium', 'high', 'critical'] as const,
        'Priority',
      )
    }
    if (input.color !== undefined) body.color = optionalText(input.color, 20)
    if (input.deadline !== undefined)
      body.deadline = input.deadline ? date(input.deadline, 'Deadline') : null
    if (input.status !== undefined) {
      body.status = oneOf(
        input.status,
        ['scheduled', 'completed', 'cancelled', 'skipped'] as const,
        'Status',
      )
    }
    if (input.override_conflict !== undefined)
      body.override_conflict = Boolean(input.override_conflict)
    if (!Object.keys(body).length) fail('Nothing to update.')
    return backendFetch<ActivityCreateResult>(
      `/schedule/activities/${id(activityId, 'Activity')}`,
      {
        method: 'PATCH',
        body,
      },
    )
  })
}

export async function deleteActivityAction(activityId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await backendFetch<void>(`/schedule/activities/${id(activityId, 'Activity')}`, {
      method: 'DELETE',
    })
    return null
  })
}

export async function updateWorkingHoursAction(
  input: WorkingHoursInput,
): Promise<ActionResult<WorkingHours>> {
  return run(() => {
    if (!TIME_RE.test(input.work_start) || !TIME_RE.test(input.work_end)) {
      fail('Working hours must use the HH:MM format.')
    }
    const days = Array.isArray(input.work_days)
      ? input.work_days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : []
    if (!days.length) fail('Select at least one working day.')
    return backendFetch<WorkingHours>('/schedule/working-hours', {
      method: 'PUT',
      body: { work_start: input.work_start, work_end: input.work_end, work_days: days },
    })
  })
}

export async function proposeScheduleAction(
  requestText: string,
  weekStart?: string,
): Promise<ActionResult<ScheduleProposal>> {
  return run(() =>
    backendFetch<ScheduleProposal>('/schedule/proposals', {
      method: 'POST',
      body: {
        text: text(requestText, 'Request', 2000),
        target_week_start: weekStart ? date(weekStart, 'Week start') : null,
      },
      timeoutMs: 60_000,
    }),
  )
}

export async function confirmScheduleProposalAction(
  proposalId: string,
): Promise<ActionResult<Activity[]>> {
  return run(() =>
    backendFetch<Activity[]>(`/schedule/proposals/${id(proposalId, 'Proposal')}/confirm`, {
      method: 'POST',
      body: { proposal_id: id(proposalId, 'Proposal') },
    }),
  )
}

// ── Food ──────────────────────────────────────────────────────────────────────

export async function updateFoodPreferencesAction(
  input: FoodPreferencesInput,
): Promise<ActionResult<FoodPreferences>> {
  return run(() => {
    const body: Record<string, unknown> = {}
    const excluded = stringList(input.excluded_ingredients)
    const allergies = stringList(input.allergies)
    const categories = stringList(input.preferred_categories)
    const cuisines = stringList(input.preferred_cuisines)
    if (excluded !== undefined) body.excluded_ingredients = excluded
    if (allergies !== undefined) body.allergies = allergies
    if (categories !== undefined) body.preferred_categories = categories
    if (cuisines !== undefined) body.preferred_cuisines = cuisines
    if (input.max_prep_minutes !== undefined) {
      const minutes = Number(input.max_prep_minutes)
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 300) {
        fail('Max prep time must be between 5 and 300 minutes.')
      }
      body.max_prep_minutes = minutes
    }
    if (input.weekly_food_budget !== undefined) {
      body.weekly_food_budget = money(input.weekly_food_budget, 'Weekly food budget')
    }
    if (!Object.keys(body).length) fail('Nothing to update.')
    return backendFetch<FoodPreferences>('/food/preferences', { method: 'PATCH', body })
  })
}

export async function generateMealPlanAction(
  weekStart: string,
  preserveLocked = true,
): Promise<ActionResult<WeeklyPlan>> {
  return run(() =>
    backendFetch<WeeklyPlan>('/food/meal-plans/generate', {
      method: 'POST',
      body: {
        week_start_date: date(weekStart, 'Week start'),
        preserve_locked: Boolean(preserveLocked),
      },
      timeoutMs: 90_000,
    }),
  )
}

export async function updateMealAction(
  planId: string,
  mealId: string,
  input: { recipe_id?: string | null; meal_name?: string | null; is_locked?: boolean },
): Promise<ActionResult<WeeklyPlan['planned_meals'][number]>> {
  return run(() => {
    const body: Record<string, unknown> = {}
    if (input.recipe_id !== undefined) body.recipe_id = input.recipe_id || null
    if (input.meal_name !== undefined) body.meal_name = optionalText(input.meal_name, 200) ?? null
    if (input.is_locked !== undefined) body.is_locked = Boolean(input.is_locked)
    if (!Object.keys(body).length) fail('Nothing to update.')
    return backendFetch(`/food/meal-plans/${id(planId, 'Meal plan')}/meals/${id(mealId, 'Meal')}`, {
      method: 'PATCH',
      body,
    })
  })
}

export async function moveMealAction(
  planId: string,
  mealId: string,
  targetDay: number,
  targetMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
): Promise<ActionResult<WeeklyPlan>> {
  return run(() => {
    if (!Number.isInteger(targetDay) || targetDay < 0 || targetDay > 6)
      fail('Target day is invalid.')
    return backendFetch<WeeklyPlan>(`/food/meal-plans/${id(planId, 'Meal plan')}/meals/move`, {
      method: 'POST',
      body: {
        meal_id: id(mealId, 'Meal'),
        target_day: targetDay,
        target_meal_type: targetMealType,
      },
    })
  })
}

export async function createRecipeAction(input: RecipeInput): Promise<ActionResult<Recipe>> {
  return run(() => {
    const ingredients = Array.isArray(input.ingredients)
      ? input.ingredients.slice(0, 60).map((item) => ({
          name: text(item.name, 'Ingredient name', 150),
          quantity: optionalText(item.quantity, 50) ?? '',
          unit: optionalText(item.unit, 30) ?? '',
          estimated_price: optionalMoney(item.estimated_price, 'Ingredient price') ?? '0.00',
        }))
      : []
    return backendFetch<Recipe>('/food/recipes', {
      method: 'POST',
      body: {
        name: text(input.name, 'Recipe name', 200),
        category:
          oneOf(input.category, ['breakfast', 'lunch', 'dinner', 'snack'] as const, 'Meal type') ??
          'lunch',
        prep_duration_min: Math.min(Math.max(Number(input.prep_duration_min) || 30, 1), 600),
        instructions: optionalText(input.instructions, 8000) ?? null,
        notes: optionalText(input.notes, 4000) ?? null,
        tags: stringList(input.tags, 20, 40) ?? [],
        ingredients,
      },
    })
  })
}

export async function createGroceryItemAction(
  input: GroceryItemInput,
): Promise<ActionResult<GroceryItem>> {
  return run(() =>
    backendFetch<GroceryItem>('/food/grocery', {
      method: 'POST',
      body: {
        ingredient_name: text(input.ingredient_name, 'Item name', 150),
        quantity: optionalText(input.quantity, 50) ?? '',
        unit: optionalText(input.unit, 30) ?? '',
        estimated_price: optionalMoney(input.estimated_price, 'Estimated price') ?? '0.00',
        plan_id: input.plan_id ? id(input.plan_id, 'Meal plan') : null,
      },
    }),
  )
}

export async function updateGroceryItemAction(
  itemId: string,
  input: GroceryItemUpdateInput,
): Promise<ActionResult<GroceryItem>> {
  return run(() => {
    const body: Record<string, unknown> = {}
    if (input.is_purchased !== undefined) body.is_purchased = Boolean(input.is_purchased)
    if (input.quantity !== undefined) body.quantity = optionalText(input.quantity, 50) ?? ''
    if (input.estimated_price !== undefined) {
      body.estimated_price = money(input.estimated_price, 'Estimated price')
    }
    if (!Object.keys(body).length) fail('Nothing to update.')
    return backendFetch<GroceryItem>(`/food/grocery/${id(itemId, 'Grocery item')}`, {
      method: 'PATCH',
      body,
    })
  })
}

export async function deleteGroceryItemAction(itemId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await backendFetch<void>(`/food/grocery/${id(itemId, 'Grocery item')}`, { method: 'DELETE' })
    return null
  })
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function updateNotificationPrefsAction(
  input: NotificationPrefsInput,
): Promise<ActionResult<NotificationPrefs>> {
  return run(() => {
    const body: Record<string, unknown> = {}
    if (input.enabled !== undefined) body.enabled = Boolean(input.enabled)
    if (input.in_app_enabled !== undefined) body.in_app_enabled = Boolean(input.in_app_enabled)
    if (input.push_enabled !== undefined) body.push_enabled = Boolean(input.push_enabled)
    if (input.email_enabled !== undefined) body.email_enabled = Boolean(input.email_enabled)
    if (input.weekly_summary_enabled !== undefined) {
      body.weekly_summary_enabled = Boolean(input.weekly_summary_enabled)
    }
    if (input.spending_alerts_enabled !== undefined) {
      body.spending_alerts_enabled = Boolean(input.spending_alerts_enabled)
    }
    if (input.reminder_minutes !== undefined) {
      const minutes = Array.isArray(input.reminder_minutes)
        ? input.reminder_minutes
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0 && value <= 1440)
        : []
      body.reminder_minutes = minutes
    }
    if (!Object.keys(body).length) fail('Nothing to update.')
    return backendFetch<NotificationPrefs>('/users/me/notification-preferences', {
      method: 'PATCH',
      body,
    })
  })
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionResult<NotificationItem>> {
  return run(() =>
    backendFetch<NotificationItem>(`/notifications/${id(notificationId, 'Notification')}/read`, {
      method: 'POST',
    }),
  )
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ updated: number }>> {
  return run(() => backendFetch<{ updated: number }>('/notifications/read-all', { method: 'POST' }))
}

// ── AI ────────────────────────────────────────────────────────────────────────

export async function createConversationAction(
  title = 'New conversation',
): Promise<ActionResult<Conversation>> {
  return run(() =>
    backendFetch<Conversation>('/ai/conversations', {
      method: 'POST',
      body: { title: text(title, 'Conversation title', 200) },
    }),
  )
}

export async function sendMessageAction(
  conversationId: string,
  content: string,
): Promise<ActionResult<ChatMessage>> {
  return run(() =>
    backendFetch<ChatMessage>(`/ai/conversations/${id(conversationId, 'Conversation')}/messages`, {
      method: 'POST',
      body: { content: text(content, 'Message', 4000) },
      timeoutMs: 60_000,
    }),
  )
}

export async function deleteConversationAction(
  conversationId: string,
): Promise<ActionResult<null>> {
  return run(async () => {
    await backendFetch<void>(`/ai/conversations/${id(conversationId, 'Conversation')}`, {
      method: 'DELETE',
    })
    return null
  })
}

export async function updateRecommendationAction(
  recommendationId: string,
  status: 'accepted' | 'rejected',
): Promise<ActionResult<Recommendation>> {
  return run(() =>
    backendFetch<Recommendation>(`/ai/recommendations/${id(recommendationId, 'Recommendation')}`, {
      method: 'PATCH',
      body: { status: oneOf(status, ['accepted', 'rejected'] as const, 'Status') },
    }),
  )
}

export async function getAIStatusAction(): Promise<ActionResult<AIStatus>> {
  return run(() => backendFetch<AIStatus>('/ai/status'))
}

export async function exportAccountDataAction(): Promise<ActionResult<Record<string, unknown>>> {
  return run(() => backendFetch<Record<string, unknown>>('/users/me/export'))
}

export async function loadMonthlyReportAction(): Promise<ActionResult<MonthlyReportRow[]>> {
  return run(() => backendFetch<MonthlyReportRow[]>('/finance/reports/monthly?months=6'))
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function saveProfileAction(input: ProfileInput): Promise<ActionResult<BackendUser>> {
  return run(async () => {
    const body: Record<string, unknown> = {}
    if (input.first_name !== undefined) body.first_name = text(input.first_name, 'First name', 80)
    if (input.language !== undefined) {
      body.language = oneOf(input.language, ['en', 'fr'] as const, 'Language')
    }
    if (input.theme !== undefined)
      body.theme = oneOf(input.theme, ['dark', 'light'] as const, 'Theme')
    if (input.currency !== undefined)
      body.currency = text(input.currency, 'Currency', 5).toUpperCase()
    if (input.timezone !== undefined) {
      const timezone = text(input.timezone, 'Timezone', 50)
      try {
        new Intl.DateTimeFormat('en', { timeZone: timezone })
      } catch {
        fail('Timezone must be a valid IANA timezone, such as Africa/Casablanca.')
      }
      body.timezone = timezone
    }
    if (input.simplified_ui !== undefined) body.simplified_ui = Boolean(input.simplified_ui)
    if (!Object.keys(body).length) fail('Nothing to update.')

    const sessionUser = await appAuth.currentUser()
    if (sessionUser) {
      const userData: { name?: string; language?: 'en' | 'fr'; theme?: 'dark' | 'light' } = {}
      if (typeof body.first_name === 'string') userData.name = body.first_name
      if (body.language === 'en' || body.language === 'fr') userData.language = body.language
      if (body.theme === 'dark' || body.theme === 'light') userData.theme = body.theme
      if (Object.keys(userData).length) {
        await getPrisma().user.update({ where: { id: sessionUser.id }, data: userData })
      }
    }

    return backendFetch<BackendUser>('/users/me', { method: 'PATCH', body })
  })
}

// ── Reads used after mutations that change a whole collection ─────────────────

export async function loadConversationAction(
  conversationId: string,
): Promise<ActionResult<ConversationDetail | null>> {
  return run(() => loadConversation(id(conversationId, 'Conversation')))
}

export async function loadScheduleWeekAction(
  weekStart: string,
  timezone: string,
): Promise<ActionResult<Activity[]>> {
  return run(() => loadScheduleWeek(date(weekStart, 'Week start'), text(timezone, 'Timezone', 50)))
}

export async function loadMealPlanAction(
  weekStart: string,
): Promise<ActionResult<WeeklyPlan | null>> {
  return run(() => loadMealPlanForWeek(date(weekStart, 'Week start')))
}

export async function loadNotificationsAction(): Promise<ActionResult<NotificationList>> {
  return run(() => loadNotifications())
}
