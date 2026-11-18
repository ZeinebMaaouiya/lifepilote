import 'server-only'

import { BackendError, backendFetch, getSessionToken, syncBackendIdentity } from './lifepilot-api'
import type {
  Activity,
  AIStatus,
  AppSnapshot,
  BackendErrorInfo,
  BackendUser,
  Budget,
  BudgetSummary,
  Conversation,
  ConversationDetail,
  ExpenseList,
  FoodPreferences,
  Goal,
  GoalList,
  GroceryList,
  Language,
  NotificationList,
  NotificationPrefs,
  Recipe,
  RecurringPayment,
  Theme,
  WeeklyPlan,
  WorkingHours,
} from './lifepilot-types'
import { emptyExpenseList, emptyNotifications } from './lifepilot-types'

interface AppSessionUser {
  id: string
  email: string
  name: string
  language?: string | null
  theme?: string | null
}

interface DateParts {
  year: number
  month: number
  day: number
}

const pad = (value: number) => String(value).padStart(2, '0')

function localMidnightUtc(date: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  const guess = new Date(Date.UTC(year, month - 1, day))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(guess)
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const localAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  )
  return new Date(guess.getTime() - (localAsUtc - guess.getTime()))
}

function activityRange(weekStart: string, timezone: string) {
  const from = localMidnightUtc(weekStart, timezone)
  const to = localMidnightUtc(addDays(weekStart, 7), timezone)
  to.setMilliseconds(to.getMilliseconds() - 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function localDateParts(timezone: string, date = new Date()): DateParts {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
    return { year: get('year'), month: get('month'), day: get('day') }
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    }
  }
}

export function dateString(parts: DateParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

export function startOfWeek(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const current = new Date(Date.UTC(year, month - 1, day))
  const weekday = current.getUTCDay() // 0 = Sunday
  const offset = (weekday + 6) % 7 // Monday = 0
  return addDays(date, -offset)
}

export function monthRange(
  year: number,
  month: number,
): {
  from: string
  to: string
} {
  const from = `${year}-${pad(month)}-01`
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
  return { from, to: addDays(`${next.year}-${pad(next.month)}-01`, -1) }
}

function emptySnapshot(error: BackendErrorInfo, today: string, weekStart: string): AppSnapshot {
  return {
    connected: false,
    error,
    user: null,
    notificationPrefs: null,
    budgets: [],
    activeBudget: null,
    budgetSummary: null,
    expenses: emptyExpenseList,
    recurring: [],
    goals: [],
    activities: [],
    workingHours: null,
    foodPrefs: null,
    mealPlan: null,
    grocery: null,
    recipes: [],
    notifications: emptyNotifications,
    conversations: [],
    activeConversation: null,
    recommendations: [],
    aiStatus: { configured: false, provider: 'unknown' },
    currency: 'MAD',
    timezone: 'UTC',
    today,
    weekStart,
  }
}

async function optional<T>(
  path: string,
  token: string,
  fallback: T,
  options: { notFound?: T } = {},
): Promise<{ value: T; error: BackendError | null }> {
  try {
    return { value: await backendFetch<T>(path, { token }), error: null }
  } catch (error) {
    if (error instanceof BackendError) {
      if (error.status === 404 && options.notFound !== undefined) {
        return { value: options.notFound, error: null }
      }
      return { value: fallback, error }
    }
    return {
      value: fallback,
      error: new BackendError(0, 'unexpected_error', 'Unexpected backend error.'),
    }
  }
}

const isBlocking = (error: BackendError | null) =>
  Boolean(error && (error.status === 0 || error.status === 401))

export async function loadAppSnapshot(payloadUser: AppSessionUser): Promise<AppSnapshot> {
  const token = await getSessionToken()
  const now = new Date()

  // The user's timezone is stored in the backend profile, but it may not exist
  // yet. Use the auth profile language/theme as a hint and default to UTC.
  const provisionalTimezone = 'UTC'
  const today = dateString(localDateParts(provisionalTimezone, now))
  const weekStart = startOfWeek(today)

  if (!token) {
    return emptySnapshot(
      {
        code: 'missing_session',
        message: 'Your session has expired. Sign in again to continue.',
      },
      today,
      weekStart,
    )
  }

  const language: Language = payloadUser.language === 'fr' ? 'fr' : 'en'
  const theme: Theme = payloadUser.theme === 'light' ? 'light' : 'dark'

  let user: BackendUser
  try {
    user = await syncBackendIdentity({
      authUserId: payloadUser.id,
      email: payloadUser.email,
      firstName: payloadUser.name,
      language,
      theme,
    })
  } catch (error) {
    const info =
      error instanceof BackendError
        ? {
            code: error.code,
            message:
              error.status === 401
                ? 'The LifePilot API rejected this session. Sign in again and try once more.'
                : error.message,
          }
        : { code: 'backend_unreachable', message: 'The LifePilot API is not reachable.' }
    return emptySnapshot(info, today, weekStart)
  }

  const timezone = user.timezone || 'UTC'
  const localToday = dateString(localDateParts(timezone, now))
  const localWeekStart = startOfWeek(localToday)
  const scheduleRange = activityRange(localWeekStart, timezone)
  const monthFrom = `${localToday.slice(0, 7)}-01`

  const [
    prefsResult,
    budgetsResult,
    expensesResult,
    recurringResult,
    goalsResult,
    activitiesResult,
    workingHoursResult,
    foodPrefsResult,
    mealPlanResult,
    groceryResult,
    recipesResult,
    notificationsResult,
    conversationsResult,
    recommendationsResult,
    aiStatusResult,
  ] = await Promise.all([
    optional<NotificationPrefs | null>('/users/me/notification-preferences', token, null),
    optional<Budget[]>('/finance/budgets', token, []),
    optional<ExpenseList>(
      `/finance/expenses?page=1&page_size=100&from=${monthFrom}&to=${localToday}`,
      token,
      emptyExpenseList,
    ),
    optional<RecurringPayment[]>('/finance/recurring-payments', token, []),
    optional<GoalList>('/goals', token, { items: [], total: 0 }),
    optional<Activity[]>(
      `/schedule/activities?from=${encodeURIComponent(scheduleRange.from)}&to=${encodeURIComponent(scheduleRange.to)}`,
      token,
      [],
    ),
    optional<WorkingHours | null>('/schedule/working-hours', token, null),
    optional<FoodPreferences | null>('/food/preferences', token, null),
    optional<WeeklyPlan | null>(`/food/meal-plans?week_start=${localWeekStart}`, token, null, {
      notFound: null,
    }),
    optional<GroceryList | null>('/food/grocery', token, null),
    optional<Recipe[]>('/food/recipes', token, []),
    optional<NotificationList>('/notifications?page=1&page_size=20', token, emptyNotifications),
    optional<Conversation[]>('/ai/conversations', token, []),
    optional<AppSnapshot['recommendations']>('/ai/recommendations', token, []),
    optional<AIStatus>('/ai/status', token, {
      configured: false,
      provider: 'unknown',
    }),
  ])

  const budgets = budgetsResult.value
  const currentMonth = Number(localToday.slice(5, 7))
  const currentYear = Number(localToday.slice(0, 4))
  const activeBudget =
    budgets.find((budget) => budget.year === currentYear && budget.month === currentMonth) ??
    budgets[0] ??
    null

  let expenses = expensesResult.value
  if (activeBudget && (activeBudget.year !== currentYear || activeBudget.month !== currentMonth)) {
    const range = monthRange(activeBudget.year, activeBudget.month)
    const ranged = await optional<ExpenseList>(
      `/finance/expenses?page=1&page_size=100&from=${range.from}&to=${range.to}`,
      token,
      emptyExpenseList,
    )
    expenses = ranged.value
  }

  const [summaryResult, conversationResult] = await Promise.all([
    activeBudget
      ? optional<BudgetSummary | null>(`/finance/budgets/${activeBudget.id}/summary`, token, null)
      : Promise.resolve({ value: null, error: null }),
    conversationsResult.value.length
      ? optional<ConversationDetail | null>(
          `/ai/conversations/${conversationsResult.value[0].id}`,
          token,
          null,
          { notFound: null },
        )
      : Promise.resolve({ value: null, error: null }),
  ])

  const errors = [
    prefsResult.error,
    budgetsResult.error,
    expensesResult.error,
    recurringResult.error,
    goalsResult.error,
    activitiesResult.error,
    workingHoursResult.error,
    foodPrefsResult.error,
    mealPlanResult.error,
    groceryResult.error,
    recipesResult.error,
    notificationsResult.error,
    conversationsResult.error,
    recommendationsResult.error,
    aiStatusResult.error,
    summaryResult.error,
    conversationResult.error,
  ].filter((error): error is BackendError => Boolean(error))

  const blocking = errors.find(isBlocking) ?? null
  const firstError = blocking ?? errors[0] ?? null

  return {
    connected: !blocking,
    error: firstError
      ? {
          code: firstError.code,
          message:
            firstError.status === 401
              ? 'The LifePilot API rejected this session. Sign in again and try once more.'
              : firstError.message,
        }
      : null,
    user,
    notificationPrefs: prefsResult.value,
    budgets,
    activeBudget,
    budgetSummary: summaryResult.value,
    expenses,
    recurring: recurringResult.value,
    goals: goalsResult.value.items,
    activities: activitiesResult.value,
    workingHours: workingHoursResult.value,
    foodPrefs: foodPrefsResult.value,
    mealPlan: mealPlanResult.value,
    grocery: groceryResult.value,
    recipes: recipesResult.value,
    notifications: notificationsResult.value,
    conversations: conversationsResult.value,
    activeConversation: conversationResult.value,
    recommendations: recommendationsResult.value,
    aiStatus: aiStatusResult.value,
    currency: user.currency || 'MAD',
    timezone,
    today: localToday,
    weekStart: localWeekStart,
  }
}

export async function loadScheduleWeek(weekStart: string, timezone: string): Promise<Activity[]> {
  const token = await getSessionToken()
  if (!token) return []
  const scheduleRange = activityRange(weekStart, timezone)
  try {
    return await backendFetch<Activity[]>(
      `/schedule/activities?from=${encodeURIComponent(scheduleRange.from)}&to=${encodeURIComponent(scheduleRange.to)}`,
      { token },
    )
  } catch {
    return []
  }
}

export async function loadMealPlanForWeek(weekStart: string): Promise<WeeklyPlan | null> {
  const token = await getSessionToken()
  if (!token) return null
  try {
    return await backendFetch<WeeklyPlan>(`/food/meal-plans?week_start=${weekStart}`, { token })
  } catch {
    return null
  }
}

export async function loadConversation(conversationId: string): Promise<ConversationDetail | null> {
  const token = await getSessionToken()
  if (!token) return null
  try {
    return await backendFetch<ConversationDetail>(
      `/ai/conversations/${encodeURIComponent(conversationId)}`,
      { token },
    )
  } catch {
    return null
  }
}

export async function loadNotifications(): Promise<NotificationList> {
  const token = await getSessionToken()
  if (!token) return emptyNotifications
  try {
    return await backendFetch<NotificationList>('/notifications?page=1&page_size=20', { token })
  } catch {
    return emptyNotifications
  }
}
