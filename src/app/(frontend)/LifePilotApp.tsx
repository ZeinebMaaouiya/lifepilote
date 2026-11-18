'use client'

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { logoutAction } from './auth/actions'
import {
  confirmScheduleProposalAction,
  createActivityAction,
  createBudgetAction,
  createCategoryAction,
  createConversationAction,
  createExpenseAction,
  createGoalAction,
  createGroceryItemAction,
  createRecipeAction,
  createRecurringAction,
  deleteActivityAction,
  deleteCategoryAction,
  deleteConversationAction,
  deleteExpenseAction,
  deleteGoalAction,
  deleteGroceryItemAction,
  deleteRecurringAction,
  exportAccountDataAction,
  generateMealPlanAction,
  loadConversationAction,
  loadMealPlanAction,
  loadMonthlyReportAction,
  loadNotificationsAction,
  loadScheduleWeekAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  moveMealAction,
  payRecurringAction,
  proposeScheduleAction,
  saveProfileAction,
  sendMessageAction,
  updateActivityAction,
  updateBudgetAction,
  updateCategoryAction,
  updateFoodPreferencesAction,
  updateGoalAction,
  updateGoalFinancialAction,
  updateGoalProgressAction,
  updateGroceryItemAction,
  updateMealAction,
  updateNotificationPrefsAction,
  updateRecommendationAction,
  updateRecurringAction,
  updateWorkingHoursAction,
} from './app-actions'
import type {
  ActionResult,
  Activity,
  AppSnapshot,
  BudgetCategory,
  ChatMessage,
  Conversation,
  ConversationDetail,
  Expense,
  Goal,
  GroceryItem,
  Language,
  NotificationItem,
  MonthlyReportRow,
  PlannedMeal,
  Recipe,
  RecurringPayment,
  ScheduleProposal,
  Theme,
  WeeklyPlan,
} from '@/lib/lifepilot-types'

type Page =
  | 'Overview'
  | 'My Budget'
  | 'Expenses'
  | 'Recurring Payments'
  | 'Food Planner'
  | 'My Goals'
  | 'Time Planner'
  | 'AI Assistant'
  | 'Settings'

const french: Record<string, string> = {
  Overview: 'Aperçu',
  'My Budget': 'Mon budget',
  Expenses: 'Dépenses',
  'Recurring Payments': 'Paiements récurrents',
  'Food Planner': 'Planificateur repas',
  'My Goals': 'Mes objectifs',
  'Time Planner': 'Agenda',
  'AI Assistant': 'Assistant IA',
  Settings: 'Paramètres',
  Workspace: 'Espace personnel',
  'Good morning': 'Bonjour',
  'Enable reminders': 'Activer les rappels',
  'Reminders active': 'Rappels actifs',
  'Light mode': 'Mode clair',
  'Dark mode': 'Mode sombre',
  'Sign out': 'Déconnexion',
  'Add expense': 'Ajouter une dépense',
  'Add payment': 'Ajouter un paiement',
  'Add category': 'Ajouter une catégorie',
  'Create goal': 'Créer un objectif',
  'New activity': 'Nouvelle activité',
  'Generate with AI': 'Générer avec IA',
  'Optimize with AI': 'Optimiser avec IA',
  'Save changes': 'Enregistrer',
  Cancel: 'Annuler',
  Save: 'Enregistrer',
  Delete: 'Supprimer',
  'Mark all read': 'Tout marquer comme lu',
  Notifications: 'Notifications',
  'No data yet': 'Aucune donnée',
  'Profile saved.': 'Profil enregistré.',
  'Food preferences saved.': 'Préférences alimentaires enregistrées.',
  'Working hours saved.': 'Heures de travail enregistrées.',
  'Notification preferences saved.': 'Préférences de notification enregistrées.',
  'Switch language': 'Changer de langue',
  'Close navigation': 'Fermer la navigation',
  'Open navigation': 'Ouvrir la navigation',
  'Personalize your LifePilot': 'Personnalisez votre LifePilot',
  'Fine-tune how your assistant plans, recommends and keeps you informed.': 'Personnalisez la façon dont votre assistant planifie, recommande et vous informe.',
  'Switch to light': 'Passer au mode clair',
  'Switch to dark': 'Passer au mode sombre',
  Profile: 'Profil',
  'Budget & currency': 'Budget et devise',
  'Food preferences': 'Préférences alimentaires',
  'Working hours': 'Heures de travail',
  'AI preferences': 'Préférences de l’IA',
  Account: 'Compte',
  'Connected to your LifePilot account': 'Connecté à votre compte LifePilot',
  'First name': 'Prénom',
  Currency: 'Devise',
  Timezone: 'Fuseau horaire',
  Language: 'Langue',
  'Use a simplified interface': 'Utiliser une interface simplifiée',
  'Save profile': 'Enregistrer le profil',
  'Export my LifePilot data': 'Exporter mes données LifePilot',
  'Downloads your app records as JSON. Push subscription credentials are excluded.': 'Télécharge vos données au format JSON. Les identifiants des notifications push sont exclus.',
  'Meal planning': 'Planification des repas',
  'Allergies (comma separated)': 'Allergies (séparées par des virgules)',
  'Ingredients to avoid': 'Ingrédients à éviter',
  'Max prep minutes': 'Temps de préparation maximum (min)',
  'Weekly food budget': 'Budget repas hebdomadaire',
  'Save food preferences': 'Enregistrer les préférences alimentaires',
  Scheduling: 'Planification',
  Start: 'Début',
  End: 'Fin',
  'Save working hours': 'Enregistrer les heures de travail',
  Reminders: 'Rappels',
  'On time': 'À l’heure',
  'at start time': 'à l’heure de début',
  'before the task': 'avant la tâche',
  'Task reminders': 'Rappels de tâches',
  'Receive in-app reminders before scheduled activities.': 'Recevez des rappels dans l’application avant vos activités planifiées.',
  'Proactive spending alerts': 'Alertes de dépenses',
  'Get notified before you exceed a budget.': 'Recevez une alerte avant de dépasser votre budget.',
  'Weekly planning summary': 'Résumé hebdomadaire',
  'Receive a clear plan every Sunday.': 'Recevez un plan clair chaque dimanche.',
  'Email notifications': 'Notifications par e-mail',
  'Send reminders to your email address.': 'Recevez les rappels par e-mail.',
  Assistant: 'Assistant',
  'No AI provider key is configured on the backend. Assistant and AI generation are disabled.': 'Aucune clé de fournisseur IA n’est configurée sur le serveur. L’assistant et la génération IA sont désactivés.',
  'The assistant reads your live budget, goals, meal plan and calendar. It never invents data and always asks for confirmation before changing your schedule.': 'L’assistant consulte votre budget, vos objectifs, vos repas et votre calendrier. Il n’invente aucune donnée et demande toujours votre confirmation avant de modifier votre agenda.',
  Mon: 'Lun',
  Tue: 'Mar',
  Wed: 'Mer',
  Thu: 'Jeu',
  Fri: 'Ven',
  Sat: 'Sam',
  Sun: 'Dim',
  'Monthly budget': 'Budget mensuel',
  'Total expenses': 'Total des dépenses',
  'Available balance': 'Solde disponible',
  'Savings progress': 'Progression de l’épargne',
  'of budget': 'du budget',
  'Safe to spend': 'Disponible',
  'Income left this month': 'Revenu restant ce mois-ci',
  'Spending overview': 'Aperçu des dépenses',
  'Financial analytics': 'Analyse financière',
  Monthly: 'Mensuel',
  Yearly: 'Annuel',
  'Total this month': 'Total ce mois-ci',
  'of income used': 'des revenus utilisés',
  'Expenses by category': 'Dépenses par catégorie',
  'View all': 'Tout voir',
  'No categories yet': 'Aucune catégorie',
  'Add categories to see how your spending is distributed.': 'Ajoutez des catégories pour visualiser la répartition de vos dépenses.',
  'spent': 'dépensé',
  'LifePilot intelligence': 'Intelligence LifePilot',
  'New insight': 'Nouvelle analyse',
  Offline: 'Hors ligne',
  'Smart suggestion': 'Suggestion intelligente',
  'Adjust meal plan': 'Modifier le plan de repas',
  'Ask AI': 'Demander à l’IA',
  'Today’s focus': 'À retenir aujourd’hui',
  Lunch: 'Déjeuner',
  'Planned meal': 'Repas planifié',
  'Nothing scheduled today': 'Rien de prévu aujourd’hui',
  'Open the Time Planner to plan your day.': 'Ouvrez le planificateur pour organiser votre journée.',
  'Daily goals': 'Objectifs du jour',
  'completed': 'terminé(s)',
  of: 'sur',
  priority: 'priorité',
  'Upcoming payments': 'Paiements à venir',
  Manage: 'Gérer',
  'No recurring payments': 'Aucun paiement récurrent',
  'Add rent, subscriptions and bills to keep them visible.': 'Ajoutez le loyer, les abonnements et les factures pour les suivre.',
  Due: 'À payer le',
  'Next 7 days': '7 prochains jours',
  'Here’s your life at a glance.': 'Votre quotidien en un coup d’œil.',
  'Your budget, goals, meals and calendar are connected to your account.': 'Votre budget, vos objectifs, vos repas et votre calendrier sont liés à votre compte.',
  'Some data could not be loaded. Check the connection notice above.': 'Certaines données n’ont pas pu être chargées. Consultez le message de connexion ci-dessus.',
  'Ask LifePilot AI': 'Demander à LifePilot AI',
  'Personalize your workspace': 'Personnalisez votre espace',
  'Set up the basics for better guidance': 'Configurez l’essentiel pour obtenir de meilleurs conseils',
  'Complete a budget, add a goal, and set your working hours to get more useful plans.': 'Créez un budget, ajoutez un objectif et définissez vos heures de travail pour obtenir des plans plus utiles.',
  Goal: 'Objectif',
  'Set up budget': 'Configurer le budget',
  'Add a goal': 'Ajouter un objectif',
  'Set working hours': 'Définir les heures de travail',
  'Your expense history': 'Historique des dépenses',
  'Budget control center': 'Centre de contrôle du budget',
  'Review and understand every dirham you spend.': 'Suivez et comprenez chaque dirham dépensé.',
  'Plan your money with confidence and stay ahead of every category.': 'Gérez votre argent sereinement et gardez le contrôle de chaque catégorie.',
  'Edit budget': 'Modifier le budget',
  'Create budget': 'Créer un budget',
  'Monthly trends': 'Tendances mensuelles',
  'Last six months': 'Six derniers mois',
  Income: 'Revenus',
  'Start here': 'Commencez ici',
  'Create your first monthly budget': 'Créez votre premier budget mensuel',
  'Set your income once, then split it into categories to track spending properly.': 'Saisissez vos revenus, puis répartissez-les par catégorie pour suivre vos dépenses.',
  'Search expenses': 'Rechercher des dépenses',
  'Search description, category, date or amount': 'Rechercher par description, catégorie, date ou montant',
  'Filter by category': 'Filtrer par catégorie',
  'All categories': 'Toutes les catégories',
  'Filter by payment method': 'Filtrer par moyen de paiement',
  'All payment methods': 'Tous les moyens de paiement',
  Card: 'Carte',
  Cash: 'Espèces',
  Transfer: 'Virement',
  'Category budgets': 'Budgets par catégorie',
  'Add categories such as food, transport or education.': 'Ajoutez des catégories comme alimentation, transport ou études.',
  'Recent expenses': 'Dépenses récentes',
  shown: 'affichées',
  'No expenses yet': 'Aucune dépense',
  'No matching expenses': 'Aucune dépense correspondante',
  'Add your first expense to start tracking.': 'Ajoutez votre première dépense pour commencer le suivi.',
  'Change the search or filters and try again.': 'Modifiez la recherche ou les filtres, puis réessayez.',
  Expense: 'Dépense',
  Uncategorized: 'Sans catégorie',
  'Keep every commitment visible and never miss a due date.': 'Gardez vos engagements en vue et ne manquez aucune échéance.',
  'Recurring payments': 'Paiements récurrents',
  'Monthly commitments': 'Engagements mensuels',
  'of monthly income': 'des revenus mensuels',
  'Due this week': 'À payer cette semaine',
  'upcoming payments': 'paiements à venir',
  Overdue: 'En retard',
  'All on time': 'Tout est à jour',
  'Needs attention': 'À vérifier',
  'Add rent, utilities and subscriptions to see them here.': 'Ajoutez le loyer, les services et les abonnements pour les voir ici.',
  'Next payment': 'Prochain paiement',
  'Payment recorded and next date advanced.': 'Paiement enregistré et prochaine échéance mise à jour.',
  'Mark paid': 'Marquer comme payé',
  monthly: 'mensuel',
  weekly: 'hebdomadaire',
  yearly: 'annuel',
  daily: 'quotidien',
  'Payment deleted.': 'Paiement supprimé.',
  'Expense deleted.': 'Dépense supprimée.',
  'Category deleted.': 'Catégorie supprimée.',
  'Delete category': 'Supprimer la catégorie',
  'Delete expense': 'Supprimer la dépense',
  'Delete payment': 'Supprimer le paiement',
}

const translate = (value: string, language: Language) =>
  language === 'fr' ? (french[value] ?? value) : value

const nav: { label: Page; icon: string }[] = [
  { label: 'Overview', icon: 'grid' },
  { label: 'My Budget', icon: 'wallet' },
  { label: 'Expenses', icon: 'card' },
  { label: 'Recurring Payments', icon: 'repeat' },
  { label: 'Food Planner', icon: 'food' },
  { label: 'My Goals', icon: 'target' },
  { label: 'Time Planner', icon: 'calendar' },
  { label: 'AI Assistant', icon: 'sparkles' },
  { label: 'Settings', icon: 'settings' },
]

const paths: Record<string, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a2 2 0 0 1 2 2v12H5.5A2.5 2.5 0 0 1 3 16.5z" />
      <path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z" />
      <path d="M5 5V3h13" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  repeat: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </>
  ),
  food: (
    <>
      <path d="M6 3v8M3 3v5a3 3 0 0 0 6 0V3M6 11v10" />
      <path d="M15 3v18M15 3c4 1 6 4 6 8h-6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z" />
      <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 .63 1.7 1.7 0 0 0-.37 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.57 19.3a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.63-1 1.7 1.7 0 0 0-1.1-.37H2.4v-4h.1A1.7 1.7 0 0 0 4.1 8.57a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.53 3.8l.06.06A1.7 1.7 0 0 0 8.5 4.2a1.7 1.7 0 0 0 1-.63 1.7 1.7 0 0 0 .37-1.1V2.4h4v.1A1.7 1.7 0 0 0 14.93 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.3 8.4a1.7 1.7 0 0 0 .63 1 1.7 1.7 0 0 0 1.1.37h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  arrow: <path d="m9 18 6-6-6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trend: <path d="m3 17 6-6 4 4 8-9M15 6h6v6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  send: <path d="m22 2-7 20-4-9-9-4zM22 2 11 13" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  trash: (
    <>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" />
    </>
  ),
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function Logo() {
  return (
    <div className="logo">
      <div className="logo-mark">
        <Icon name="sparkles" size={19} />
      </div>
      <span>
        LifePilot <b>AI</b>
      </span>
    </div>
  )
}

// ── Formatting helpers ────────────────────────────────────────────────────────

const pad = (value: number) => String(value).padStart(2, '0')

function parseDateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function toDateOnly(value: string) {
  const { year, month, day } = parseDateParts(value)
  return new Date(Date.UTC(year, month - 1, day))
}

function dateString(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function addDays(value: string, days: number) {
  const date = toDateOnly(value)
  date.setUTCDate(date.getUTCDate() + days)
  return dateString(date)
}

function startOfWeek(value: string) {
  const date = toDateOnly(value)
  const weekday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - weekday)
  return dateString(date)
}

function formatDay(
  value: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) {
  return toDateOnly(value).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' })
}

function formatMoney(value: string | number | null | undefined, currency: string) {
  const amount = Number(value ?? 0)
  const safe = Number.isFinite(amount) ? amount : 0
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Number.isInteger(safe) ? 0 : 2,
  }).format(safe)} ${currency}`
}

function formatPct(value: string | number | null | undefined) {
  const amount = Number(value ?? 0)
  return `${Math.round(Number.isFinite(amount) ? amount : 0)}%`
}

function zoneParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '0'
  return {
    date: `${read('year')}-${read('month')}-${read('day')}`,
    hour: Number(read('hour')) % 24,
    minute: Number(read('minute')),
  }
}

function formatTime(iso: string, timeZone: string) {
  const { hour, minute } = zoneParts(iso, timeZone)
  return `${pad(hour)}:${pad(minute)}`
}

function formatDateTime(iso: string, timeZone: string) {
  const { date, hour, minute } = zoneParts(iso, timeZone)
  return `${formatDay(date)} · ${pad(hour)}:${pad(minute)}`
}

function toLocalInput(iso: string, timeZone: string) {
  const { date, hour, minute } = zoneParts(iso, timeZone)
  return `${date}T${pad(hour)}:${pad(minute)}`
}

/** Offset of a timezone at a given instant, in milliseconds. */
function zoneOffsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const wallClock = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  )
  return wallClock - instant.getTime()
}

/** Convert a `datetime-local` value in the user's timezone to an ISO instant. */
function zonedLocalToIso(local: string, timeZone: string) {
  const [datePart, timePart = '00:00'] = local.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute))
  const offset = zoneOffsetMs(guess, timeZone)
  return new Date(guess.getTime() - offset).toISOString()
}

function summaryFor(data: AppSnapshot) {
  const income = Number(data.activeBudget?.total_income ?? 0)
  const allocated =
    data.activeBudget?.categories.reduce(
      (total, category) => total + Number(category.allocated_amount),
      0,
    ) ?? 0
  const spent = Number(
    data.budgetSummary?.total_expenses ??
      data.expenses.items.reduce((total, expense) => total + Number(expense.amount), 0),
  )
  const reserved = Number(data.budgetSummary?.reserved_recurring ?? 0)
  return {
    income,
    allocated,
    spent,
    reserved,
    available: Math.max(income - spent - reserved, 0),
    savings: Math.max(income - spent, 0),
    utilization: income > 0 ? (spent / income) * 100 : 0,
    monthLabel: data.activeBudget
      ? formatDay(`${data.activeBudget.year}-${pad(data.activeBudget.month)}-01`, {
          month: 'long',
          year: 'numeric',
        })
      : formatDay(data.today, { month: 'long', year: 'numeric' }),
  }
}

const colorVar: Record<string, string> = {
  violet: 'var(--violet)',
  blue: 'var(--blue)',
  cyan: 'var(--cyan)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
}

const colorOptions = ['violet', 'blue', 'cyan', 'green', 'amber', 'red'] as const

type Runner = <T>(work: () => Promise<ActionResult<T>>, success: string) => Promise<T | null>

interface Ctx {
  data: AppSnapshot
  busy: boolean
  currency: string
  timezone: string
  t: (value: string) => string
  run: Runner
  quiet: <T>(work: () => Promise<ActionResult<T>>) => Promise<T | null>
  go: (page: Page) => void
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

function SectionHead({
  title,
  eyebrow,
  action,
}: {
  title: string
  eyebrow?: string
  action?: ReactNode
}) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <span className="empty-orb">
        <Icon name="sparkles" size={16} />
      </span>
      <strong>{title}</strong>
      {hint && <small>{hint}</small>}
    </div>
  )
}

function Modal({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>
            {eyebrow && <span>{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Sparkline({ color = 'violet', down = false }: { color?: string; down?: boolean }) {
  return (
    <svg className={`sparkline ${color}`} viewBox="0 0 90 34" preserveAspectRatio="none">
      <path
        className="area"
        d={
          down
            ? 'M0 7 C12 8 14 20 27 16 S43 26 55 20 S69 27 90 24 V34 H0Z'
            : 'M0 28 C12 27 14 16 27 20 S43 8 55 14 S69 4 90 6 V34 H0Z'
        }
      />
      <path
        d={
          down
            ? 'M0 7 C12 8 14 20 27 16 S43 26 55 20 S69 27 90 24'
            : 'M0 28 C12 27 14 16 27 20 S43 8 55 14 S69 4 90 6'
        }
      />
    </svg>
  )
}

function StatCards({ data, currency }: { data: AppSnapshot; currency: string }) {
  const t = (value: string) => translate(value, data.user?.language === 'fr' ? 'fr' : 'en')
  const summary = summaryFor(data)
  const savingsGoal = data.goals.find((goal) => goal.financial_goal)?.financial_goal
  const stats = [
    {
      label: 'Monthly budget',
      value: formatMoney(summary.income, currency),
      note: summary.monthLabel,
      icon: 'wallet',
      color: 'violet',
    },
    {
      label: 'Total expenses',
      value: formatMoney(summary.spent, currency),
      note: `${formatPct(summary.utilization)} of budget`,
      icon: 'card',
      color: 'blue',
    },
    {
      label: 'Available balance',
      value: formatMoney(summary.available, currency),
      note: 'Safe to spend',
      icon: 'trend',
      color: 'cyan',
    },
    {
      label: 'Savings progress',
      value: formatMoney(savingsGoal ? savingsGoal.saved_amount : summary.savings, currency),
      note: savingsGoal
        ? `${formatPct(savingsGoal.completion_pct)} of ${formatMoney(savingsGoal.target_amount, currency)}`
        : 'Income left this month',
      icon: 'target',
      color: 'green',
    },
  ]

  return (
    <div className="stat-grid">
      {stats.map((stat) => (
        <Card className="stat-card" key={stat.label}>
          <div className={`stat-icon ${stat.color}`}>
            <Icon name={stat.icon} />
          </div>
          <span>{t(stat.label)}</span>
          <strong>{stat.value}</strong>
          <small>
            {stat.note.includes(' of ')
              ? `${stat.note.split(' of ')[0]} ${stat.note.endsWith(' of budget') ? t('of budget') : `${t('of')} ${stat.note.split(' of ').slice(1).join(' of ')}`}`
              : t(stat.note)}
          </small>
          <Sparkline color={stat.color} />
        </Card>
      ))}
    </div>
  )
}

// ── Sidebar + header ──────────────────────────────────────────────────────────

function Sidebar({
  page,
  setPage,
  open,
  setOpen,
  language,
  user,
}: {
  page: Page
  setPage: (page: Page) => void
  open: boolean
  setOpen: (value: boolean) => void
  language: Language
  user: { firstName: string; email: string }
}) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="side-top">
        <Logo />
        <button
          className="icon-btn mobile-close"
          onClick={() => setOpen(false)}
          aria-label={translate('Close navigation', language)}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="side-label">{translate('Workspace', language)}</div>
      <nav className="nav-list">
        {nav.map((item) => (
          <button
            key={item.label}
            className={`nav-item ${page === item.label ? 'active' : ''}`}
            onClick={() => {
              setPage(item.label)
              setOpen(false)
            }}
          >
            <Icon name={item.icon} />
            <span>{translate(item.label, language)}</span>
            {item.label === 'AI Assistant' && <i>AI</i>}
          </button>
        ))}
      </nav>
      <form action={logoutAction} className="profile-form">
        <button className="profile" type="submit">
          <span className="avatar">{user.firstName.slice(0, 2).toUpperCase()}</span>
          <span>
            <strong>{user.firstName}</strong>
            <small>{user.email}</small>
          </span>
          <span className="signout-label">{translate('Sign out', language)}</span>
        </button>
      </form>
    </aside>
  )
}

function Header({
  page,
  openNav,
  language,
  theme,
  userName,
  notificationsEnabled,
  unreadCount,
  onLanguage,
  onTheme,
  onNotifications,
}: {
  page: Page
  openNav: () => void
  language: Language
  theme: Theme
  userName: string
  notificationsEnabled: boolean
  unreadCount: number
  onLanguage: () => void
  onTheme: () => void
  onNotifications: () => void
}) {
  return (
    <header className="topbar">
      <div className="top-title">
        <button
          className="icon-btn menu-btn"
          onClick={openNav}
          aria-label={translate('Open navigation', language)}
        >
          <Icon name="menu" />
        </button>
        <div>
          <span>LifePilot / {translate(page, language)}</span>
          <h1>
            {page === 'Overview'
              ? `${translate('Good morning', language)}, ${userName}`
              : translate(page, language)}
          </h1>
        </div>
      </div>
      <div className="top-actions">
        <button
          className="compact-control"
          onClick={onLanguage}
          aria-label={translate('Switch language', language)}
        >
          {language === 'en' ? 'FR' : 'EN'}
        </button>
        <button
          className="compact-control theme-control"
          onClick={onTheme}
          aria-label={translate(theme === 'dark' ? 'Light mode' : 'Dark mode', language)}
        >
          {theme === 'dark' ? '☼' : '☾'}
        </button>
        <button
          className={`icon-btn notification ${notificationsEnabled ? 'enabled' : ''}`}
          onClick={onNotifications}
          aria-label={translate(
            notificationsEnabled ? 'Reminders active' : 'Enable reminders',
            language,
          )}
        >
          <Icon name="bell" />
          {unreadCount > 0 && <i />}
        </button>
        <span className="top-avatar">{userName.slice(0, 2).toUpperCase()}</span>
      </div>
    </header>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

function SpendingChart({ data, currency }: { data: AppSnapshot; currency: string }) {
  const t = (value: string) => translate(value, data.user?.language === 'fr' ? 'fr' : 'en')
  const summary = summaryFor(data)
  const expenses = data.expenses.items
  const max = Math.max(1, ...expenses.map((expense) => Number(expense.amount)))
  const bars = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const expense of expenses) {
      byDay.set(expense.date, (byDay.get(expense.date) ?? 0) + Number(expense.amount))
    }
    const start = data.activeBudget
      ? `${data.activeBudget.year}-${pad(data.activeBudget.month)}-01`
      : data.today
    return Array.from({ length: 14 }, (_, index) => {
      const day = addDays(start, index)
      const total = byDay.get(day) ?? 0
      return {
        label: formatDay(day, { day: 'numeric' }),
        total,
        height: Math.max(4, Math.round((total / max) * 100)),
      }
    })
  }, [data.activeBudget, data.today, expenses, max])

  return (
    <Card className="spending">
      <SectionHead
        title={t('Spending overview')}
        eyebrow={t('Financial analytics')}
        action={
          <div className="segmented">
            <button className="active">{t('Monthly')}</button>
            <button>{t('Yearly')}</button>
          </div>
        }
      />
      <div className="chart-summary">
        <div>
          <small>{t('Total this month')}</small>
          <strong>{formatMoney(summary.spent, currency)}</strong>
          <span>
            <Icon name="trend" size={13} /> {formatPct(summary.utilization)} {t('of income used')}
          </span>
        </div>
        <div className="chart-legend">
          <i />
          {t('Expenses')} <i />
          {t('My Budget')}
        </div>
      </div>
      <div className="bar-chart">
        <div className="y-axis">
          <span>{Math.round(max / 1000)}k</span>
          <span>{Math.round(max / 2000)}k</span>
          <span>0</span>
        </div>
        <div className="bars">
          {bars.map((bar) => (
            <div className="bar-wrap" key={bar.label}>
              <div className="bar budget-bar" />
              <div
                className="bar expense-bar"
                style={{ height: `${bar.height}%` }}
                title={formatMoney(bar.total, currency)}
              />
              <span>{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function CategoryCard({
  data,
  currency,
  go,
}: {
  data: AppSnapshot
  currency: string
  go: (page: Page) => void
}) {
  const t = (value: string) => translate(value, data.user?.language === 'fr' ? 'fr' : 'en')
  const categories = data.activeBudget?.categories ?? []
  const spent = Number(
    data.budgetSummary?.total_expenses ??
      data.expenses.items.reduce((total, expense) => total + Number(expense.amount), 0),
  )
  const totalAllocated = categories.reduce(
    (total, category) => total + Number(category.allocated_amount),
    0,
  )
  const segments: string[] = []
  let cursor = 0
  for (const category of categories.slice(0, 4)) {
    const share =
      totalAllocated > 0 ? (Number(category.allocated_amount) / totalAllocated) * 100 : 0
    segments.push(`${colorVar[category.color] ?? 'var(--violet)'} ${cursor}% ${cursor + share}%`)
    cursor += share
  }
  if (cursor < 100) segments.push(`#282e3b ${cursor}% 100%`)

  return (
    <Card className="category-card">
      <SectionHead
        title={t('Expenses by category')}
        action={
          <button className="text-btn" onClick={() => go('My Budget')}>
            {t('View all')} <Icon name="arrow" size={14} />
          </button>
        }
      />
      {categories.length === 0 ? (
        <Empty
          title={t('No categories yet')}
          hint={t('Add categories to see how your spending is distributed.')}
        />
      ) : (
        <>
          <div className="donut-row">
            <div className="donut" style={{ background: `conic-gradient(${segments.join(',')})` }}>
              <div>
                <strong>
                  {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(spent)}
                </strong>
                <span>{data.currency} {t('spent')}</span>
              </div>
            </div>
            <div className="donut-labels">
              {categories.slice(0, 4).map((category) => (
                <span key={category.id}>
                  <i style={{ background: colorVar[category.color] ?? 'var(--violet)' }} />
                  {category.name}
                  <b>
                    {formatPct(
                      totalAllocated > 0
                        ? (Number(category.allocated_amount) / totalAllocated) * 100
                        : 0,
                    )}
                  </b>
                </span>
              ))}
            </div>
          </div>
          <div className="category-list">
            {categories.slice(0, 3).map((category) => {
              const pct =
                Number(category.allocated_amount) > 0
                  ? Math.min(
                      100,
                      (Number(category.spent_amount) / Number(category.allocated_amount)) * 100,
                    )
                  : 0
              return (
                <div key={category.id}>
                  <div>
                    <span>{category.name}</span>
                    <strong>{formatMoney(category.spent_amount, currency)}</strong>
                  </div>
                  <div className="progress">
                    <i className={category.color} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

function AiInsight({
  data,
  go,
  currency,
}: {
  data: AppSnapshot
  go: (page: Page) => void
  currency: string
}) {
  const summary = summaryFor(data)
  const pending = data.recommendations.find((item) => item.status === 'pending')
  let title = 'Your money and time, connected.'
  let body = `You have ${formatMoney(summary.available, currency)} available this month. Keep tracking expenses to get sharper recommendations.`
  let suggestion = 'Add a few expenses and schedule your week so LifePilot can spot patterns.'

  if (pending) {
    try {
      const parsed = JSON.parse(pending.payload_json) as {
        title?: string
        message?: string
        body?: string
      }
      title = parsed.title ?? title
      body = parsed.message ?? parsed.body ?? body
      suggestion = 'Review this AI recommendation and accept it if it fits your plan.'
    } catch {
      body = pending.payload_json.slice(0, 240)
    }
  } else if (summary.spent > summary.allocated && summary.allocated > 0) {
    title = 'Your spending is above your category plan.'
    body = `You have spent ${formatMoney(summary.spent, currency)} against ${formatMoney(summary.allocated, currency)} allocated.`
    suggestion = 'Move a little budget into your busiest category or plan cheaper meals this week.'
  } else if (data.activeBudget?.categories.length) {
    const top = [...data.activeBudget.categories].sort(
      (a, b) =>
        Number(b.spent_amount) / Math.max(Number(b.allocated_amount), 1) -
        Number(a.spent_amount) / Math.max(Number(a.allocated_amount), 1),
    )[0]
    if (top) {
      title = `${top.name} is your fastest-moving category.`
      body = `You have used ${formatMoney(top.spent_amount, currency)} of ${formatMoney(top.allocated_amount, currency)} this month.`
      suggestion = 'Check the category before your next purchase to stay on plan.'
    }
  }

  return (
    <Card className="ai-insight">
      <div className="ai-glow" />
      <div className="ai-head">
        <div className="ai-orb">
          <Icon name="sparkles" />
        </div>
        <span>LifePilot intelligence</span>
        <i>{data.aiStatus.configured ? 'New insight' : 'Offline'}</i>
      </div>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="ai-suggestion">
        <Icon name="trend" />
        <span>
          <strong>Smart suggestion</strong>
          {suggestion}
        </span>
      </div>
      <div className="ai-actions">
        <button className="primary-btn" onClick={() => go('Food Planner')}>
          Adjust meal plan
        </button>
        <button className="ghost-btn" onClick={() => go('AI Assistant')}>
          Ask AI <Icon name="arrow" size={14} />
        </button>
      </div>
    </Card>
  )
}

function TodayCard({ data, timezone }: { data: AppSnapshot; timezone: string }) {
  const t = (value: string) => translate(value, data.user?.language === 'fr' ? 'fr' : 'en')
  const todayActivities = data.activities
    .filter((activity) => zoneParts(activity.start_time, timezone).date === data.today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
  const weekday = (toDateOnly(data.today).getUTCDay() + 6) % 7
  const lunch = data.mealPlan?.planned_meals.find(
    (meal) => meal.day_of_week === weekday && meal.meal_type === 'lunch',
  )
  const completed = todayActivities.filter((activity) => activity.status === 'completed').length

  return (
    <Card className="today-card">
      <SectionHead
        title={t('Today’s focus')}
        eyebrow={formatDay(data.today, { weekday: 'long', month: 'long', day: 'numeric' })}
        action={<span className="more">•••</span>}
      />
      {lunch && (lunch.recipe || lunch.meal_name) ? (
        <div className="meal-preview">
          <div className="meal-thumb">
            <Icon name="food" />
          </div>
          <div>
            <small>{t('Lunch')}</small>
            <strong>{lunch.recipe?.name ?? lunch.meal_name}</strong>
            <span>
              {lunch.recipe
                ? `${formatMoney(lunch.recipe.estimated_cost, data.currency)} · ${lunch.recipe.prep_duration_min} min`
                : t('Planned meal')}
            </span>
          </div>
        </div>
      ) : null}
      {todayActivities.length === 0 ? (
        <Empty title={t('Nothing scheduled today')} hint={t('Open the Time Planner to plan your day.')} />
      ) : (
        <div className="timeline">
          {todayActivities.slice(0, 4).map((activity) => (
            <div key={activity.id}>
              <i className={activity.color} />
              <span>{formatTime(activity.start_time, timezone)}</span>
              <p>
                <strong>{activity.title}</strong>
                <small>
                  {activity.priority} {t('priority')} · {formatTime(activity.end_time, timezone)}
                </small>
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="daily-progress">
        <div>
          <span>{t('Daily goals')}</span>
          <strong>
            {completed} {t('of')} {todayActivities.length} {t('completed')}
          </strong>
        </div>
        <div className="progress">
          <i
            className="violet"
            style={{
              width: `${todayActivities.length ? (completed / todayActivities.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
    </Card>
  )
}

function Upcoming({
  data,
  go,
  timezone,
}: {
  data: AppSnapshot
  go: (page: Page) => void
  timezone: string
}) {
  const t = (value: string) => translate(value, data.user?.language === 'fr' ? 'fr' : 'en')
  const payments = [...data.recurring]
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
    .slice(0, 3)

  return (
    <Card className="upcoming">
      <SectionHead
        title={t('Upcoming payments')}
        action={
          <button className="text-btn" onClick={() => go('Recurring Payments')}>
            {t('Manage')} <Icon name="arrow" size={14} />
          </button>
        }
      />
      {payments.length === 0 ? (
        <Empty
          title={t('No recurring payments')}
          hint={t('Add rent, subscriptions and bills to keep them visible.')}
        />
      ) : (
        payments.map((payment) => (
          <div className="payment-row" key={payment.id}>
            <div className={`payment-icon ${payment.color}`}>
              <Icon name="repeat" />
            </div>
            <div>
              <strong>{payment.name}</strong>
              <small>
                {t('Due')} {formatDay(payment.next_due_date)} · {payment.status}
              </small>
            </div>
            <b>{formatMoney(payment.amount, data.currency)}</b>
          </div>
        ))
      )}
      <span className="upcoming-footnote">{t('Next 7 days')} · {timezone}</span>
    </Card>
  )
}

function Overview({ ctx }: { ctx: Ctx }) {
  const needsSetup = !ctx.data.activeBudget || !ctx.data.goals.length || !ctx.data.workingHours
  return (
    <div className="page-content">
      <div className="welcome">
        <div>
          <h2>{ctx.t('Here’s your life at a glance.')}</h2>
          <p>
            {ctx.data.connected
              ? ctx.t('Your budget, goals, meals and calendar are connected to your account.')
              : ctx.t('Some data could not be loaded. Check the connection notice above.')}
          </p>
        </div>
        <button className="primary-btn" onClick={() => ctx.go('AI Assistant')}>
          <Icon name="sparkles" /> {ctx.t('Ask LifePilot AI')}
        </button>
      </div>
      {needsSetup && (
        <Card className="setup-card onboarding-card">
          <div>
              <span>{ctx.t('Personalize your workspace')}</span>
              <h3>{ctx.t('Set up the basics for better guidance')}</h3>
            <p>
              {ctx.t('Complete a budget, add a goal, and set your working hours to get more useful plans.')}
            </p>
            <div className="onboarding-steps">
              <span>{ctx.data.activeBudget ? '✓' : '1'} {ctx.t('My Budget')}</span>
              <span>{ctx.data.goals.length ? '✓' : '2'} {ctx.t('Goal')}</span>
              <span>{ctx.data.workingHours ? '✓' : '3'} {ctx.t('Working hours')}</span>
            </div>
          </div>
          <div className="button-row">
            {!ctx.data.activeBudget && (
              <button className="primary-btn" onClick={() => ctx.go('My Budget')}>
                {ctx.t('Set up budget')}
              </button>
            )}
            {!ctx.data.goals.length && (
              <button className="ghost-btn" onClick={() => ctx.go('My Goals')}>
                {ctx.t('Add a goal')}
              </button>
            )}
            {!ctx.data.workingHours && (
              <button className="ghost-btn" onClick={() => ctx.go('Settings')}>
                {ctx.t('Set working hours')}
              </button>
            )}
          </div>
        </Card>
      )}
      <StatCards data={ctx.data} currency={ctx.currency} />
      <div className="dashboard-grid">
        <SpendingChart data={ctx.data} currency={ctx.currency} />
        <CategoryCard data={ctx.data} currency={ctx.currency} go={ctx.go} />
        <AiInsight data={ctx.data} go={ctx.go} currency={ctx.currency} />
        <TodayCard data={ctx.data} timezone={ctx.timezone} />
        <Upcoming data={ctx.data} go={ctx.go} timezone={ctx.timezone} />
      </div>
    </div>
  )
}

// ── Finance forms ─────────────────────────────────────────────────────────────

function ExpenseForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const categories = ctx.data.activeBudget?.categories ?? []
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(ctx.data.today)
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [method, setMethod] = useState<'card' | 'cash' | 'transfer'>('card')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = await ctx.run(
      () =>
        createExpenseAction({
          amount,
          description,
          date,
          category_id: categoryId || null,
          payment_method: method,
        }),
      'Expense added.',
    )
    if (result) onClose()
  }

  return (
    <Modal title="Add an expense" eyebrow="New transaction" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Amount
          <div className="amount-input">
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
            />
            <span>{ctx.currency}</span>
          </div>
        </label>
        <div className="form-grid">
          <label>
            Category
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">No category</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
        </div>
        <label>
          Description
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What did you spend on?"
          />
        </label>
        <label>
          Payment method
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as 'card' | 'cash' | 'transfer')}
          >
            <option value="card">Bank card</option>
            <option value="cash">Cash</option>
            <option value="transfer">Bank transfer</option>
          </select>
        </label>
        <button className="primary-btn modal-save" type="submit" disabled={ctx.busy}>
          Save expense
        </button>
      </form>
    </Modal>
  )
}

function BudgetForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const existing = ctx.data.activeBudget
  const today = ctx.data.today
  const [income, setIncome] = useState(existing?.total_income ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [year, setYear] = useState(String(existing?.year ?? Number(today.slice(0, 4))))
  const [month, setMonth] = useState(String(existing?.month ?? Number(today.slice(5, 7))))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = existing
      ? await ctx.run(
          () => updateBudgetAction(existing.id, { total_income: income, notes }),
          'Budget updated.',
        )
      : await ctx.run(
          () =>
            createBudgetAction({
              year: Number(year),
              month: Number(month),
              total_income: income,
              notes,
            }),
          'Budget created.',
        )
    if (result) onClose()
  }

  return (
    <Modal
      title={existing ? 'Edit monthly budget' : 'Create a monthly budget'}
      eyebrow="Budget"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {!existing && (
          <div className="form-grid">
            <label>
              Year
              <input
                type="number"
                min={2020}
                max={2100}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                required
              />
            </label>
            <label>
              Month
              <input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                required
              />
            </label>
          </div>
        )}
        <label>
          Monthly income
          <div className="amount-input">
            <input
              inputMode="decimal"
              value={income}
              onChange={(event) => setIncome(event.target.value)}
              placeholder="0.00"
              required
            />
            <span>{ctx.currency}</span>
          </div>
        </label>
        <label>
          Notes
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional note"
          />
        </label>
        <button className="primary-btn modal-save" type="submit" disabled={ctx.busy}>
          {existing ? 'Save budget' : 'Create budget'}
        </button>
      </form>
    </Modal>
  )
}

function CategoryForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const budget = ctx.data.activeBudget
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [color, setColor] = useState<string>('violet')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!budget) return
    const result = await ctx.run(
      () =>
        createCategoryAction(budget.id, { name, allocated_amount: amount, color, icon: 'wallet' }),
      'Category added.',
    )
    if (result) onClose()
  }

  return (
    <Modal title="Add a budget category" eyebrow="Category" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Food & groceries"
            required
          />
        </label>
        <label>
          Allocated amount
          <div className="amount-input">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
            />
            <span>{ctx.currency}</span>
          </div>
        </label>
        <label>
          Color
          <select value={color} onChange={(event) => setColor(event.target.value)}>
            {colorOptions.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-btn modal-save" type="submit" disabled={ctx.busy || !budget}>
          Add category
        </button>
      </form>
    </Modal>
  )
}

function RecurringForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly')
  const [dueDate, setDueDate] = useState(addDays(ctx.data.today, 7))
  const [color, setColor] = useState<string>('blue')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = await ctx.run(
      () =>
        createRecurringAction({
          name,
          amount,
          frequency,
          next_due_date: dueDate,
          color,
          icon: 'repeat',
        }),
      'Recurring payment added.',
    )
    if (result) onClose()
  }

  return (
    <Modal title="Add a recurring payment" eyebrow="Commitment" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Apartment rent"
            required
          />
        </label>
        <label>
          Amount
          <div className="amount-input">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
            />
            <span>{ctx.currency}</span>
          </div>
        </label>
        <div className="form-grid">
          <label>
            Frequency
            <select
              value={frequency}
              onChange={(event) =>
                setFrequency(event.target.value as 'weekly' | 'monthly' | 'yearly')
              }
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label>
            Next due date
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </label>
        </div>
        <label>
          Color
          <select value={color} onChange={(event) => setColor(event.target.value)}>
            {colorOptions.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-btn modal-save" type="submit" disabled={ctx.busy}>
          Add payment
        </button>
      </form>
    </Modal>
  )
}

function BudgetPage({ ctx, expensesOnly = false }: { ctx: Ctx; expensesOnly?: boolean }) {
  const t = ctx.t
  const [showExpense, setShowExpense] = useState(false)
  const [showBudget, setShowBudget] = useState(false)
  const [showCategory, setShowCategory] = useState(false)
  const [expenseQuery, setExpenseQuery] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('all')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportRow[]>([])
  const categories = ctx.data.activeBudget?.categories ?? []
  const summary = summaryFor(ctx.data)
  useEffect(() => {
    if (!expensesOnly) return
    void ctx
      .quiet(() => loadMonthlyReportAction())
      .then((report) => {
        if (report) setMonthlyReport(report)
      })
  }, [expensesOnly])
  const filteredExpenses = ctx.data.expenses.items.filter((expense) => {
    const query = expenseQuery.trim().toLowerCase()
    const searchable = [
      expense.description,
      expense.category_name ?? '',
      expense.date,
      expense.amount,
      expense.payment_method,
    ]
      .join(' ')
      .toLowerCase()
    return (
      (!query || searchable.includes(query)) &&
      (expenseCategory === 'all' || expense.category_id === expenseCategory) &&
      (paymentMethod === 'all' || expense.payment_method === paymentMethod)
    )
  })

  const removeExpense = (expense: Expense) => {
    void ctx.run(() => deleteExpenseAction(expense.id), t('Expense deleted.'))
  }

  const removeCategory = (category: BudgetCategory) => {
    void ctx.run(() => deleteCategoryAction(category.id), t('Category deleted.'))
  }

  return (
    <div className="page-content">
      <div className="welcome">
        <div>
          <h2>{t(expensesOnly ? 'Your expense history' : 'Budget control center')}</h2>
          <p>
            {expensesOnly
              ? t('Review and understand every dirham you spend.')
              : t('Plan your money with confidence and stay ahead of every category.')}
          </p>
        </div>
        <div className="button-row">
          <button className="ghost-btn" onClick={() => setShowBudget(true)}>
            <Icon name="wallet" /> {t(ctx.data.activeBudget ? 'Edit budget' : 'Create budget')}
          </button>
          <button className="primary-btn" onClick={() => setShowExpense(true)}>
            <Icon name="plus" />{' '}
            {translate('Add expense', ctx.data.user?.language === 'fr' ? 'fr' : 'en')}
          </button>
        </div>
      </div>

      <StatCards data={ctx.data} currency={ctx.currency} />

      {expensesOnly && monthlyReport.length > 0 && (
        <Card className="monthly-report">
            <SectionHead title={t('Monthly trends')} eyebrow={t('Last six months')} />
          <div className="monthly-report-grid">
            {monthlyReport.map((row) => {
              const maxValue = Math.max(
                1,
                ...monthlyReport.flatMap((item) => [Number(item.income), Number(item.expenses)]),
              )
              const monthLabel = new Intl.DateTimeFormat(
                ctx.data.user?.language === 'fr' ? 'fr' : 'en',
                { month: 'short' },
              ).format(
                new Date(`${row.month}-01T12:00:00Z`),
              )
              return (
                <div className="monthly-report-row" key={row.month}>
                  <div className="monthly-report-label">
                    <strong>{monthLabel}</strong>
                  <span>{formatMoney(row.expenses, ctx.currency)} {t('spent')}</span>
                  </div>
                  <div
                    className="monthly-report-bars"
                    aria-label={`${monthLabel}: income ${row.income}, expenses ${row.expenses}`}
                  >
                    <i
                      className="income-bar"
                      style={{ width: `${Math.max(2, (Number(row.income) / maxValue) * 100)}%` }}
                    />
                    <i
                      className="expense-bar"
                      style={{ width: `${Math.max(2, (Number(row.expenses) / maxValue) * 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="monthly-report-legend">
            <span>{t('Income')}</span>
            <span>{t('Expenses')}</span>
          </div>
        </Card>
      )}

      {!ctx.data.activeBudget && (
        <Card className="setup-card">
          <div>
            <span>{t('Start here')}</span>
            <h3>{t('Create your first monthly budget')}</h3>
            <p>{t('Set your income once, then split it into categories to track spending properly.')}</p>
          </div>
          <button className="primary-btn" onClick={() => setShowBudget(true)}>
            <Icon name="plus" /> {t('Create budget')}
          </button>
        </Card>
      )}

      {expensesOnly && (
        <div className="expense-filters">
          <label className="search expense-search">
            <Icon name="search" size={15} />
            <input
              aria-label={t('Search expenses')}
              placeholder={t('Search description, category, date or amount')}
              value={expenseQuery}
              onChange={(event) => setExpenseQuery(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">{t('Filter by category')}</span>
            <select
              value={expenseCategory}
              onChange={(event) => setExpenseCategory(event.target.value)}
            >
              <option value="all">{t('All categories')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{t('Filter by payment method')}</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option value="all">{t('All payment methods')}</option>
              <option value="card">{t('Card')}</option>
              <option value="cash">{t('Cash')}</option>
              <option value="transfer">{t('Transfer')}</option>
            </select>
          </label>
        </div>
      )}

      <div className="two-col">
        <Card>
          <SectionHead
            title={t('Category budgets')}
            eyebrow={summary.monthLabel}
            action={
              <button
                className="text-btn"
                onClick={() => setShowCategory(true)}
                disabled={!ctx.data.activeBudget}
              >
                {t('Add category')}
              </button>
            }
          />
          {categories.length === 0 ? (
            <Empty
              title={t('No categories yet')}
              hint={t('Add categories such as food, transport or education.')}
            />
          ) : (
            <div className="budget-list">
              {categories.map((category) => {
                const pct =
                  Number(category.allocated_amount) > 0
                    ? Math.min(
                        100,
                        (Number(category.spent_amount) / Number(category.allocated_amount)) * 100,
                      )
                    : 0
                return (
                  <div key={category.id}>
                    <div className={`category-symbol ${category.color}`}>
                      <Icon name="wallet" />
                    </div>
                    <div className="budget-info">
                      <div>
                        <strong>{category.name}</strong>
                        <span>
                          {formatMoney(category.spent_amount, ctx.currency)} {t('of')}{' '}
                          {formatMoney(category.allocated_amount, ctx.currency)}
                        </span>
                      </div>
                      <div className="progress">
                        <i className={category.color} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="row-actions">
                      <b>{formatPct(pct)}</b>
                      <button
                        className="icon-btn tiny"
                        onClick={() => removeCategory(category)}
                        aria-label={t('Delete category')}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <SectionHead
            title={t('Recent expenses')}
            eyebrow={`${expensesOnly ? filteredExpenses.length : ctx.data.expenses.total} ${t('shown')}`}
            action={
              <button className="text-btn" onClick={() => ctx.go('Expenses')}>
                {t('View all')} <Icon name="arrow" size={14} />
              </button>
            }
          />
          {ctx.data.expenses.items.length === 0 ||
          (expensesOnly && filteredExpenses.length === 0) ? (
            <Empty
              title={t(ctx.data.expenses.items.length === 0 ? 'No expenses yet' : 'No matching expenses')}
              hint={t(ctx.data.expenses.items.length === 0
                ? 'Add your first expense to start tracking.'
                : 'Change the search or filters and try again.')}
            />
          ) : (
            <div className="expense-table">
              {(expensesOnly ? filteredExpenses : ctx.data.expenses.items.slice(0, 6)).map(
                (expense) => (
                  <div key={expense.id}>
                    <span>{formatDay(expense.date)}</span>
                    <strong>{expense.description || t('Expense')}</strong>
                    <em>{expense.category_name ?? t('Uncategorized')}</em>
                    <div className="expense-amount">
                      <b>{formatMoney(expense.amount, ctx.currency)}</b>
                      <button
                        className="icon-btn tiny"
                        onClick={() => removeExpense(expense)}
                        aria-label={t('Delete expense')}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </Card>
      </div>

      {showExpense && <ExpenseForm ctx={ctx} onClose={() => setShowExpense(false)} />}
      {showBudget && <BudgetForm ctx={ctx} onClose={() => setShowBudget(false)} />}
      {showCategory && <CategoryForm ctx={ctx} onClose={() => setShowCategory(false)} />}
    </div>
  )
}

function ExpensesPage({ ctx }: { ctx: Ctx }) {
  return <BudgetPage ctx={ctx} expensesOnly />
}

// ── Recurring ─────────────────────────────────────────────────────────────────

function RecurringPage({ ctx }: { ctx: Ctx }) {
  const t = ctx.t
  const [showForm, setShowForm] = useState(false)
  const payments = ctx.data.recurring
  const monthly = payments
    .filter((payment) => payment.is_active && payment.frequency === 'monthly')
    .reduce((total, payment) => total + Number(payment.amount), 0)
  const weekEnd = addDays(ctx.data.today, 7)
  const dueThisWeek = payments
    .filter(
      (payment) => payment.next_due_date >= ctx.data.today && payment.next_due_date <= weekEnd,
    )
    .reduce((total, payment) => total + Number(payment.amount), 0)
  const overdue = payments.filter((payment) => payment.status === 'overdue').length

  return (
    <div className="page-content">
      <div className="welcome">
        <div>
          <h2>{t('Recurring payments')}</h2>
          <p>{t('Keep every commitment visible and never miss a due date.')}</p>
        </div>
        <button className="primary-btn" onClick={() => setShowForm(true)}>
          <Icon name="plus" /> {t('Add payment')}
        </button>
      </div>

      <div className="recurring-summary">
        <Card>
          <small>{t('Monthly commitments')}</small>
          <strong>{formatMoney(monthly, ctx.currency)}</strong>
          <span>
            {formatPct(
              summaryFor(ctx.data).income > 0 ? (monthly / summaryFor(ctx.data).income) * 100 : 0,
            )}{' '}
            {t('of monthly income')}
          </span>
        </Card>
        <Card>
          <small>{t('Due this week')}</small>
          <strong>{formatMoney(dueThisWeek, ctx.currency)}</strong>
          <span>
            {
              payments.filter(
                (payment) =>
                  payment.next_due_date >= ctx.data.today && payment.next_due_date <= weekEnd,
              ).length
            }{' '}
            {t('upcoming payments')}
          </span>
        </Card>
        <Card>
          <small>{t('Overdue')}</small>
          <strong>{overdue}</strong>
          <span className={overdue === 0 ? 'positive' : ''}>
            {t(overdue === 0 ? 'All on time' : 'Needs attention')}
          </span>
        </Card>
      </div>

      {payments.length === 0 ? (
        <Card>
          <Empty
            title={t('No recurring payments')}
            hint={t('Add rent, utilities and subscriptions to see them here.')}
          />
        </Card>
      ) : (
        <div className="payment-cards">
          {payments.map((payment, index) => (
            <Card key={payment.id} className="payment-card">
              <div className={`payment-big-icon c${index % 5}`}>
                <Icon name="repeat" />
              </div>
              <i className={`status ${payment.status}`}>{payment.status}</i>
              <span>{t(payment.frequency)}</span>
              <h3>{payment.name}</h3>
              <strong>{formatMoney(payment.amount, ctx.currency)}</strong>
              <div>
                <small>{t('Next payment')}</small>
                <b>{formatDay(payment.next_due_date)}</b>
              </div>
              <div className="payment-actions">
                <button
                  className="ghost-btn"
                  onClick={() =>
                    void ctx.run(
                      () => payRecurringAction(payment.id),
                      t('Payment recorded and next date advanced.'),
                    )
                  }
                  disabled={ctx.busy}
                >
                  {t('Mark paid')}
                </button>
                <button
                  className="icon-btn tiny"
                  onClick={() =>
                    void ctx.run(() => deleteRecurringAction(payment.id), t('Payment deleted.'))
                  }
                  aria-label={t('Delete payment')}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && <RecurringForm ctx={ctx} onClose={() => setShowForm(false)} />}
    </div>
  )
}

// ── Goals ─────────────────────────────────────────────────────────────────────

function GoalForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [financial, setFinancial] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = await ctx.run(
      () =>
        createGoalAction({
          title,
          description,
          target_value: target,
          deadline: deadline || null,
          priority,
          period,
          color: 'violet',
          icon: 'target',
          financial_target_amount: financial || null,
        }),
      'Goal created.',
    )
    if (result) onClose()
  }

  return (
    <Modal title="Create a goal" eyebrow="Objective" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Title
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Save for a new laptop"
            required
          />
        </label>
        <label>
          Description
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Why does this matter?"
          />
        </label>
        <div className="form-grid">
          <label>
            Target value
            <input
              inputMode="decimal"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="100"
              required
            />
          </label>
          <label>
            Deadline
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Priority
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as 'low' | 'medium' | 'high' | 'critical')
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>
            Period
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as 'monthly' | 'yearly')}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
        </div>
        <label>
          Financial target (optional)
          <input
            inputMode="decimal"
            value={financial}
            onChange={(event) => setFinancial(event.target.value)}
            placeholder="Amount to save"
          />
        </label>
        <button className="primary-btn modal-save" type="submit" disabled={ctx.busy}>
          Create goal
        </button>
      </form>
    </Modal>
  )
}

function GoalProgressForm({ ctx, goal, onClose }: { ctx: Ctx; goal: Goal; onClose: () => void }) {
  const [value, setValue] = useState(goal.current_value)
  const [saved, setSaved] = useState(goal.financial_goal?.saved_amount ?? '')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const progress = await ctx.run(
      () => updateGoalProgressAction(goal.id, value),
      'Progress updated.',
    )
    if (progress && goal.financial_goal) {
      await ctx.run(() => updateGoalFinancialAction(goal.id, saved), 'Savings updated.')
    }
    if (progress) onClose()
  }

  return (
    <Modal title={goal.title} eyebrow="Update progress" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Current value
          <input
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
          />
        </label>
        {goal.financial_goal && (
          <label>
            Saved amount
            <input
              inputMode="decimal"
              value={saved}
              onChange={(event) => setSaved(event.target.value)}
            />
          </label>
        )}
        <div className="modal-actions">
          <button
            className="ghost-btn"
            type="button"
            onClick={() =>
              void ctx.run(() => deleteGoalAction(goal.id), 'Goal deleted.').then(() => onClose())
            }
          >
            Delete goal
          </button>
          <button className="primary-btn" type="submit" disabled={ctx.busy}>
            Save progress
          </button>
        </div>
      </form>
    </Modal>
  )
}

function GoalsPage({ ctx }: { ctx: Ctx }) {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Goal | null>(null)
  const goals = ctx.data.goals
  const yearly =
    goals.find((goal) => goal.financial_goal && goal.period === 'yearly') ??
    goals.find((goal) => goal.financial_goal)
  const active = goals.filter((goal) => goal.status === 'active')

  return (
    <div className="page-content">
      <div className="welcome">
        <div>
          <h2>Goals that move you forward</h2>
          <p>Connect daily actions to the future you’re building.</p>
        </div>
        <button className="primary-btn" onClick={() => setShowForm(true)}>
          <Icon name="plus" /> Create goal
        </button>
      </div>

      {yearly?.financial_goal ? (
        <div className="goal-hero">
          <div>
            <span>{yearly.period} savings goal</span>
            <h2>{yearly.title}</h2>
            <p>
              {formatMoney(yearly.financial_goal.saved_amount, ctx.currency)} saved of{' '}
              {formatMoney(yearly.financial_goal.target_amount, ctx.currency)}.
            </p>
            <div className="progress">
              <i
                style={{ width: `${Math.min(100, Number(yearly.financial_goal.completion_pct))}%` }}
              />
            </div>
            <small>
              {formatMoney(yearly.financial_goal.saved_amount, ctx.currency)} saved
              <b>{formatPct(yearly.financial_goal.completion_pct)}</b>
            </small>
          </div>
          <div
            className="goal-ring"
            style={{
              background: `radial-gradient(circle,#141525 58%,transparent 60%),conic-gradient(var(--violet) ${Math.min(100, Number(yearly.financial_goal.completion_pct))}%,#29253e 0)`,
            }}
          >
            <span>{formatPct(yearly.financial_goal.completion_pct)}</span>
          </div>
        </div>
      ) : (
        <Card className="setup-card">
          <div>
            <span>Set a direction</span>
            <h3>Create your first goal</h3>
            <p>Goals with a financial target appear here with a live savings ring.</p>
          </div>
          <button className="primary-btn" onClick={() => setShowForm(true)}>
            <Icon name="plus" /> Create goal
          </button>
        </Card>
      )}

      <SectionHead
        title="Active goals"
        action={
          <div className="segmented">
            <button className="active">All</button>
            <button>Financial</button>
          </div>
        }
      />
      {active.length === 0 ? (
        <Card>
          <Empty title="No active goals" hint="Create a goal to start tracking progress." />
        </Card>
      ) : (
        <div className="goal-grid">
          {active.map((goal) => (
            <Card className="goal-card" key={goal.id}>
              <button
                className="goal-open"
                onClick={() => setSelected(goal)}
                aria-label={`Update ${goal.title}`}
              >
                <div className={`goal-icon ${goal.color}`}>
                  <Icon name="target" />
                </div>
                <i>{goal.priority} priority</i>
                <h3>{goal.title}</h3>
                <p>
                  {goal.description ||
                    `${formatMoney(goal.current_value, ctx.currency)} of ${formatMoney(goal.target_value, ctx.currency)}`}
                </p>
                <div className="progress">
                  <i
                    className={goal.color}
                    style={{ width: `${Math.min(100, Number(goal.completion_pct))}%` }}
                  />
                </div>
                <div>
                  <strong>{formatPct(goal.completion_pct)}</strong>
                  <span>{goal.deadline ? `Due ${formatDay(goal.deadline)}` : goal.period}</span>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}

      {showForm && <GoalForm ctx={ctx} onClose={() => setShowForm(false)} />}
      {selected && <GoalProgressForm ctx={ctx} goal={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ── Food planner ──────────────────────────────────────────────────────────────

function MealEditor({
  ctx,
  plan,
  meal,
  onClose,
}: {
  ctx: Ctx
  plan: WeeklyPlan
  meal: PlannedMeal
  onClose: () => void
}) {
  const [name, setName] = useState(meal.meal_name ?? meal.recipe?.name ?? '')
  const [recipeId, setRecipeId] = useState(meal.recipe?.id ?? '')
  const [locked, setLocked] = useState(meal.is_locked)
  const [day, setDay] = useState(meal.day_of_week)
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(
    (meal.meal_type as 'breakfast' | 'lunch' | 'dinner' | 'snack') ?? 'lunch',
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const updated = await ctx.run(
      () =>
        updateMealAction(plan.id, meal.id, {
          recipe_id: recipeId || null,
          meal_name: recipeId ? null : name || null,
          is_locked: locked,
        }),
      'Meal updated.',
    )
    if (updated && (day !== meal.day_of_week || mealType !== meal.meal_type)) {
      await ctx.run(() => moveMealAction(plan.id, meal.id, day, mealType), 'Meal moved.')
    }
    if (updated) onClose()
  }

  return (
    <Modal
      title={meal.recipe?.name ?? meal.meal_name ?? 'Plan a meal'}
      eyebrow={`${meal.meal_type} · day ${meal.day_of_week + 1}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          Recipe
          <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
            <option value="">Custom meal name</option>
            {ctx.data.recipes.map((recipe) => (
              <option value={recipe.id} key={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </select>
        </label>
        {!recipeId && (
          <label>
            Meal name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Vegetable tagine"
            />
          </label>
        )}
        <div className="form-grid">
          <label>
            Day
            <select value={day} onChange={(event) => setDay(Number(event.target.value))}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => (
                <option value={index} key={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Meal type
            <select
              value={mealType}
              onChange={(event) =>
                setMealType(event.target.value as 'breakfast' | 'lunch' | 'dinner' | 'snack')
              }
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </label>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={locked}
            onChange={(event) => setLocked(event.target.checked)}
          />
          Lock this meal when regenerating with AI
        </label>
        <button className="primary-btn modal-save" type="submit" disabled={ctx.busy}>
          Save meal
        </button>
      </form>
    </Modal>
  )
}

function RecipeForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch')
  const [minutes, setMinutes] = useState('30')
  const [instructions, setInstructions] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = await ctx.run(
      () =>
        createRecipeAction({
          name,
          category,
          prep_duration_min: Number(minutes) || 30,
          instructions,
        }),
      'Recipe saved.',
    )
    if (result) onClose()
  }

  return (
    <Modal title="Add a recipe" eyebrow="Recipe library" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Lentil soup"
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Meal type
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as 'breakfast' | 'lunch' | 'dinner' | 'snack')
              }
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </label>
          <label>
            Prep minutes
            <input
              type="number"
              min={1}
              max={600}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </label>
        </div>
        <label>
          Instructions
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={4}
            placeholder="How do you make it?"
          />
        </label>
        <button className="primary-btn modal-save" type="submit" disabled={ctx.busy}>
          Save recipe
        </button>
      </form>
    </Modal>
  )
}

function FoodPage({ ctx }: { ctx: Ctx }) {
  const [week, setWeek] = useState(ctx.data.weekStart)
  const [plan, setPlan] = useState<WeeklyPlan | null>(ctx.data.mealPlan)
  const [grocery, setGrocery] = useState(ctx.data.grocery)
  const [selectedDay, setSelectedDay] = useState(
    Math.max(0, (toDateOnly(ctx.data.today).getUTCDay() + 6) % 7),
  )
  const [editing, setEditing] = useState<PlannedMeal | null>(null)
  const [showRecipe, setShowRecipe] = useState(false)
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')

  useEffect(() => {
    if (week === ctx.data.weekStart) setPlan(ctx.data.mealPlan)
  }, [ctx.data.mealPlan, ctx.data.weekStart, week])

  useEffect(() => {
    setGrocery(ctx.data.grocery)
  }, [ctx.data.grocery])

  const changeWeek = async (offset: number) => {
    const next = addDays(week, offset * 7)
    setWeek(next)
    const result = await ctx.quiet(() => loadMealPlanAction(next))
    setPlan(result ?? null)
    if (next === ctx.data.weekStart) setGrocery(ctx.data.grocery)
  }

  const generate = async () => {
    if (!ctx.data.aiStatus.configured) return
    const result = await ctx.run(() => generateMealPlanAction(week), 'Meal plan generated.')
    if (result) setPlan(result)
  }

  const dayMeals = plan?.planned_meals.filter((meal) => meal.day_of_week === selectedDay) ?? []
  const mealTypes: PlannedMeal['meal_type'][] = ['breakfast', 'lunch', 'dinner', 'snack']
  const planBudget = Number(plan?.weekly_budget ?? ctx.data.foodPrefs?.weekly_food_budget ?? 0)
  const planCost = Number(plan?.estimated_weekly_cost ?? 0)

  const addGrocery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const created = await ctx.run(
      () =>
        createGroceryItemAction({
          ingredient_name: itemName,
          estimated_price: itemPrice || '0',
          plan_id: plan?.id ?? null,
        }),
      'Grocery item added.',
    )
    if (created) {
      setItemName('')
      setItemPrice('')
      setGrocery((current) =>
        current
          ? {
              ...current,
              items: [...current.items, created],
              estimated_total: String(
                Number(current.estimated_total) + Number(created.estimated_price),
              ),
            }
          : {
              plan_id: plan?.id ?? null,
              items: [created],
              estimated_total: created.estimated_price,
              purchased_total: '0.00',
            },
      )
    }
  }

  return (
    <div className="page-content">
      <div className="welcome">
        <div>
          <h2>Your weekly meal plan</h2>
          <p>Balanced, affordable, and personalized for your goals.</p>
        </div>
        <div className="button-row">
          <button className="ghost-btn" onClick={() => setShowRecipe(true)}>
            <Icon name="plus" /> Add recipe
          </button>
          <button
            className="primary-btn"
            onClick={generate}
            disabled={ctx.busy || !ctx.data.aiStatus.configured}
          >
            <Icon name="sparkles" /> Generate with AI
          </button>
        </div>
      </div>

      {!ctx.data.aiStatus.configured && (
        <div className="banner info">
          <Icon name="sparkles" size={16} />
          <span>
            AI meal generation is not configured. Add an AI provider key on the backend to enable
            it. You can still plan meals manually.
          </span>
        </div>
      )}

      <Card className="food-budget">
        <div>
          <span>Weekly food budget</span>
          <strong>
            {formatMoney(planCost, ctx.currency)}{' '}
            <small>/ {formatMoney(planBudget || 0, ctx.currency)}</small>
          </strong>
        </div>
        <div>
          <span>
            {planBudget > 0
              ? `${formatPct((planCost / planBudget) * 100)} used · ${formatMoney(Math.max(0, planBudget - planCost), ctx.currency)} remaining`
              : 'Set a weekly food budget in Settings'}
          </span>
          <div className="progress">
            <i
              className="violet"
              style={{
                width: `${planBudget > 0 ? Math.min(100, (planCost / planBudget) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="week-nav">
          <button
            className="icon-btn"
            onClick={() => void changeWeek(-1)}
            aria-label="Previous week"
          >
            ‹
          </button>
          <strong>
            {formatDay(week)} – {formatDay(addDays(week, 6))}
          </strong>
          <button className="icon-btn" onClick={() => void changeWeek(1)} aria-label="Next week">
            ›
          </button>
        </div>
      </Card>

      <div className="week-tabs">
        {Array.from({ length: 7 }, (_, index) => {
          const day = addDays(week, index)
          const date = toDateOnly(day)
          return (
            <button
              className={selectedDay === index ? 'active' : ''}
              onClick={() => setSelectedDay(index)}
              key={day}
            >
              <span>{date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}</span>
              <b>{date.getUTCDate()}</b>
              {day === ctx.data.today && <i />}
            </button>
          )
        })}
      </div>

      {!plan ? (
        <Card>
          <Empty
            title="No meal plan for this week"
            hint={
              ctx.data.aiStatus.configured
                ? 'Generate a plan with AI or add recipes to build it manually.'
                : 'Add a recipe, then use it in your meal plan.'
            }
          />
        </Card>
      ) : (
        <div className="meal-grid">
          {mealTypes.map((type) => {
            const meal = dayMeals.find((entry) => entry.meal_type === type)
            return (
              <Card className="meal-card" key={type}>
                <div className="meal-image">
                  <div className="meal-art">
                    <Icon name="food" size={30} />
                  </div>
                  <span>{type}</span>
                  <button
                    onClick={() =>
                      meal &&
                      void ctx.run(
                        () => updateMealAction(plan.id, meal.id, { is_locked: !meal.is_locked }),
                        meal.is_locked ? 'Meal unlocked.' : 'Meal locked.',
                      )
                    }
                    aria-label={meal?.is_locked ? 'Unlock meal' : 'Lock meal'}
                    disabled={!meal}
                  >
                    <Icon name="lock" size={15} />
                  </button>
                </div>
                <div className="meal-body">
                  <h3>{meal?.recipe?.name ?? meal?.meal_name ?? 'Not planned'}</h3>
                  <p>
                    {meal?.recipe
                      ? `${meal.recipe.category} · ${meal.recipe.tags.join(', ') || 'balanced'}`
                      : meal
                        ? 'Custom meal'
                        : 'Tap edit to plan this meal'}
                  </p>
                  <div>
                    <span>
                      <Icon name="clock" size={14} /> {meal?.recipe?.prep_duration_min ?? 0} min
                    </span>
                    <b>{formatMoney(meal?.recipe?.estimated_cost ?? 0, ctx.currency)}</b>
                  </div>
                  <button
                    className="ghost-btn"
                    onClick={() => meal && setEditing(meal)}
                    disabled={!meal}
                  >
                    Edit meal
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <div className="two-col food-lower">
        <Card>
          <SectionHead
            title="Shopping list"
            eyebrow={grocery ? `${grocery.items.length} items` : 'No plan selected'}
          />
          {!grocery || grocery.items.length === 0 ? (
            <Empty title="Your list is empty" hint="Add ingredients you need to buy." />
          ) : (
            <div className="grocery-list">
              {grocery.items.map((item: GroceryItem) => (
                <div className={item.is_purchased ? 'purchased' : ''} key={item.id}>
                  <button
                    className="check-dot"
                    onClick={() =>
                      void ctx.run(
                        () =>
                          updateGroceryItemAction(item.id, { is_purchased: !item.is_purchased }),
                        'List updated.',
                      )
                    }
                    aria-label={item.is_purchased ? 'Mark unpurchased' : 'Mark purchased'}
                  >
                    {item.is_purchased && <Icon name="check" size={12} />}
                  </button>
                  <span>{item.ingredient_name}</span>
                  <small>
                    {item.quantity} {item.unit}
                  </small>
                  <b>{formatMoney(item.estimated_price, ctx.currency)}</b>
                  <button
                    className="icon-btn tiny"
                    onClick={() =>
                      void ctx.run(() => deleteGroceryItemAction(item.id), 'Item removed.')
                    }
                    aria-label="Remove item"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form className="inline-form" onSubmit={addGrocery}>
            <input
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              placeholder="Add an item"
              required
            />
            <input
              value={itemPrice}
              onChange={(event) => setItemPrice(event.target.value)}
              placeholder="Price"
              inputMode="decimal"
            />
            <button className="ghost-btn" type="submit" disabled={ctx.busy}>
              Add
            </button>
          </form>
        </Card>

        <Card>
          <SectionHead
            title="Recipe library"
            eyebrow={`${ctx.data.recipes.length} recipes`}
            action={
              <button className="text-btn" onClick={() => setShowRecipe(true)}>
                New recipe
              </button>
            }
          />
          {ctx.data.recipes.length === 0 ? (
            <Empty title="No recipes yet" hint="Save recipes to reuse them in weekly plans." />
          ) : (
            <div className="recipe-list">
              {ctx.data.recipes.slice(0, 8).map((recipe: Recipe) => (
                <div key={recipe.id}>
                  <div className="recipe-icon">
                    <Icon name="food" size={16} />
                  </div>
                  <div>
                    <strong>{recipe.name}</strong>
                    <small>
                      {recipe.category} · {recipe.prep_duration_min} min ·{' '}
                      {recipe.ingredients.length} ingredients
                    </small>
                  </div>
                  <b>{formatMoney(recipe.estimated_cost, ctx.currency)}</b>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {editing && plan && (
        <MealEditor ctx={ctx} plan={plan} meal={editing} onClose={() => setEditing(null)} />
      )}
      {showRecipe && <RecipeForm ctx={ctx} onClose={() => setShowRecipe(false)} />}
    </div>
  )
}

// ── Time planner ──────────────────────────────────────────────────────────────

function ActivityForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(`${ctx.data.today}T09:00`)
  const [end, setEnd] = useState(`${ctx.data.today}T10:00`)
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [color, setColor] = useState<string>('violet')
  const [fixed, setFixed] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = await ctx.run(
      () =>
        createActivityAction({
          title,
          start_time: zonedLocalToIso(start, ctx.timezone),
          end_time: zonedLocalToIso(end, ctx.timezone),
          priority,
          color,
          is_fixed: fixed,
          is_flexible: !fixed,
        }),
      'Activity scheduled.',
    )
    if (result) onClose()
  }

  return (
    <Modal title="Schedule an activity" eyebrow="New activity" onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Title
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Design sprint"
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Starts
            <input
              type="datetime-local"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              required
            />
          </label>
          <label>
            Ends
            <input
              type="datetime-local"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              required
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Priority
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as 'low' | 'medium' | 'high' | 'critical')
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>
            Color
            <select value={color} onChange={(event) => setColor(event.target.value)}>
              {colorOptions.map((option) => (
                <option value={option} key={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={fixed}
            onChange={(event) => setFixed(event.target.checked)}
          />
          This activity has a fixed time
        </label>
        <button className="primary-btn modal-save" type="submit" disabled={ctx.busy}>
          Schedule activity
        </button>
      </form>
    </Modal>
  )
}

function ActivityEditor({
  ctx,
  activity,
  onClose,
}: {
  ctx: Ctx
  activity: Activity
  onClose: () => void
}) {
  const submit = async (status: 'completed' | 'scheduled') => {
    const result = await ctx.run(
      () => updateActivityAction(activity.id, { status }),
      status === 'completed' ? 'Activity completed.' : 'Activity reopened.',
    )
    if (result) onClose()
  }

  return (
    <Modal
      title={activity.title}
      eyebrow={`${formatDateTime(activity.start_time, ctx.timezone)} · ${activity.priority}`}
      onClose={onClose}
    >
      <div className="activity-detail">
        <div>
          <span>Ends</span>
          <strong>{formatDateTime(activity.end_time, ctx.timezone)}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{activity.status}</strong>
        </div>
        <div>
          <span>Color</span>
          <strong>{activity.color}</strong>
        </div>
      </div>
      {activity.description && <p className="activity-description">{activity.description}</p>}
      <div className="modal-actions">
        <button
          className="ghost-btn"
          onClick={() =>
            void ctx
              .run(() => deleteActivityAction(activity.id), 'Activity deleted.')
              .then(() => onClose())
          }
        >
          Delete
        </button>
        <button
          className="primary-btn"
          onClick={() => void submit(activity.status === 'completed' ? 'scheduled' : 'completed')}
          disabled={ctx.busy}
        >
          {activity.status === 'completed' ? 'Reopen activity' : 'Mark complete'}
        </button>
      </div>
    </Modal>
  )
}

function ProposalModal({
  ctx,
  proposal,
  onClose,
}: {
  ctx: Ctx
  proposal: ScheduleProposal
  onClose: () => void
}) {
  const confirm = async () => {
    const result = await ctx.run(
      () => confirmScheduleProposalAction(proposal.proposal_id),
      'Schedule updated.',
    )
    if (result) onClose()
  }

  return (
    <Modal title="AI schedule proposal" eyebrow="Review before saving" onClose={onClose}>
      <p className="proposal-explanation">{proposal.explanation}</p>
      <div className="proposal-list">
        {proposal.activities.map((activity) => (
          <div key={`${activity.title}-${activity.start_time}`}>
            <i className={activity.color} />
            <div>
              <strong>{activity.title}</strong>
              <small>
                {formatDateTime(activity.start_time, ctx.timezone)} –{' '}
                {formatTime(activity.end_time, ctx.timezone)}
              </small>
            </div>
            <b>{activity.is_new ? 'New' : 'Updated'}</b>
          </div>
        ))}
      </div>
      {proposal.conflicts.length > 0 && (
        <div className="banner error">
          <Icon name="bell" size={16} />
          <span>
            {proposal.conflicts.length} conflict(s) detected. Review your calendar after confirming.
          </span>
        </div>
      )}
      <div className="modal-actions">
        <button className="ghost-btn" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-btn" onClick={() => void confirm()} disabled={ctx.busy}>
          Confirm schedule
        </button>
      </div>
    </Modal>
  )
}

function PlannerPage({ ctx }: { ctx: Ctx }) {
  const [week, setWeek] = useState(ctx.data.weekStart)
  const [activities, setActivities] = useState<Activity[]>(ctx.data.activities)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Activity | null>(null)
  const [proposal, setProposal] = useState<ScheduleProposal | null>(null)

  useEffect(() => {
    if (week === ctx.data.weekStart) setActivities(ctx.data.activities)
  }, [ctx.data.activities, ctx.data.weekStart, week])

  const changeWeek = async (offset: number) => {
    const next = addDays(week, offset * 7)
    setWeek(next)
    const result = await ctx.quiet(() => loadScheduleWeekAction(next, ctx.timezone))
    setActivities(result ?? [])
  }

  const optimize = async () => {
    if (!ctx.data.aiStatus.configured) return
    const result = await ctx.run(
      () =>
        proposeScheduleAction('Balance my week around my priorities, deadlines and energy.', week),
      'Proposal ready.',
    )
    if (result) setProposal(result)
  }

  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index))
  const hours = Array.from({ length: 13 }, (_, index) => 8 + index)

  return (
    <div className="page-content planner-page">
      <div className="welcome">
        <div>
          <h2>Plan a calmer, smarter week</h2>
          <p>Your priorities, balanced automatically around your energy and time.</p>
        </div>
        <div className="button-row">
          <button className="ghost-btn" onClick={() => setShowForm(true)}>
            <Icon name="plus" /> New activity
          </button>
          <button
            className="primary-btn"
            onClick={optimize}
            disabled={ctx.busy || !ctx.data.aiStatus.configured}
          >
            <Icon name="sparkles" /> Optimize with AI
          </button>
        </div>
      </div>

      {!ctx.data.aiStatus.configured && (
        <div className="banner info">
          <Icon name="sparkles" size={16} />
          <span>AI scheduling is not configured. You can still plan activities manually.</span>
        </div>
      )}

      <Card className="calendar-card">
        <div className="calendar-toolbar">
          <div>
            <button
              className="icon-btn"
              onClick={() => void changeWeek(-1)}
              aria-label="Previous week"
            >
              ‹
            </button>
            <strong>
              {formatDay(week)} – {formatDay(addDays(week, 6))}
            </strong>
            <button className="icon-btn" onClick={() => void changeWeek(1)} aria-label="Next week">
              ›
            </button>
          </div>
          <div className="segmented">
            <button className="active">Week</button>
            <button>Day</button>
          </div>
        </div>
        <div className="calendar-grid planner-grid">
          <div className="time-column">
            <span />
            {hours.map((hour) => (
              <span key={hour}>{pad(hour)}:00</span>
            ))}
          </div>
          {days.map((day, dayIndex) => {
            const dayActivities = activities
              .filter((activity) => zoneParts(activity.start_time, ctx.timezone).date === day)
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
            return (
              <div className="day-column" key={day}>
                <div className={day === ctx.data.today ? 'today' : ''}>
                  <span>{formatDay(day, { weekday: 'short' })}</span>
                  <b>{formatDay(day, { day: 'numeric' })}</b>
                </div>
                {dayActivities.map((activity) => {
                  const start = zoneParts(activity.start_time, ctx.timezone)
                  const end = zoneParts(activity.end_time, ctx.timezone)
                  const startMinutes = start.hour * 60 + start.minute
                  const endMinutes = end.hour * 60 + end.minute
                  const top = ((startMinutes - 8 * 60) / (12 * 60)) * 100
                  const height = Math.max(4, ((endMinutes - startMinutes) / (12 * 60)) * 100)
                  return (
                    <button
                      className={`event ${activity.color} ${activity.status === 'completed' ? 'done' : ''}`}
                      style={{
                        top: `${Math.max(0, Math.min(94, top))}%`,
                        height: `${Math.min(60, height)}%`,
                      }}
                      key={activity.id}
                      onClick={() => setSelected(activity)}
                    >
                      <b>{activity.title}</b>
                      <span>
                        {formatTime(activity.start_time, ctx.timezone)} –{' '}
                        {formatTime(activity.end_time, ctx.timezone)}
                      </span>
                    </button>
                  )
                })}
                {dayActivities.length === 0 && dayIndex === 0 && (
                  <span className="day-hint">No events</span>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {showForm && <ActivityForm ctx={ctx} onClose={() => setShowForm(false)} />}
      {selected && (
        <ActivityEditor ctx={ctx} activity={selected} onClose={() => setSelected(null)} />
      )}
      {proposal && (
        <ProposalModal ctx={ctx} proposal={proposal} onClose={() => setProposal(null)} />
      )}
    </div>
  )
}

// ── AI assistant ──────────────────────────────────────────────────────────────

function AssistantPage({ ctx }: { ctx: Ctx }) {
  const [chat, setChat] = useState<ConversationDetail | null>(ctx.data.activeConversation)
  const [conversations, setConversations] = useState<Conversation[]>(ctx.data.conversations)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!chat && ctx.data.activeConversation) setChat(ctx.data.activeConversation)
    setConversations(ctx.data.conversations)
  }, [ctx.data.activeConversation, ctx.data.conversations, chat])

  const openConversation = async (conversation: Conversation) => {
    const result = await ctx.quiet(() => loadConversationAction(conversation.id))
    if (result) setChat(result)
  }

  const newConversation = async () => {
    const created = await ctx.run(() => createConversationAction(), 'New conversation started.')
    if (created) {
      setConversations((current) => [created, ...current])
      setChat({ ...created, messages: [] })
    }
  }

  const send = async (content: string) => {
    if (!content.trim() || !ctx.data.aiStatus.configured) return
    setSending(true)
    let conversationId = chat?.id
    if (!conversationId) {
      const created = await createConversationAction()
      if (!created.ok) {
        setSending(false)
        return
      }
      conversationId = created.data.id
      setConversations((current) => [created.data, ...current])
      setChat({ ...created.data, messages: [] })
    }
    setMessage('')
    const result = await ctx.run(
      () => sendMessageAction(conversationId as string, content),
      'Message sent.',
    )
    if (result) {
      const detail = await loadConversationAction(conversationId as string)
      if (detail.ok && detail.data) setChat(detail.data)
    }
    setSending(false)
  }

  const removeConversation = async (conversation: Conversation) => {
    const result = await ctx.run(
      () => deleteConversationAction(conversation.id),
      'Conversation deleted.',
    )
    if (result) {
      setConversations((current) => current.filter((item) => item.id !== conversation.id))
      if (chat?.id === conversation.id) setChat(null)
    }
  }

  const prompts = [
    'Can I afford this purchase?',
    'Help me reduce food expenses',
    'Organize my week',
    'Suggest an affordable meal plan',
  ]

  return (
    <div className="page-content assistant-page">
      <div className="chat-intro">
        <div className="ai-orb large">
          <Icon name="sparkles" size={25} />
        </div>
        <div>
          <span>LifePilot AI</span>
          <h2>Your decisions, made clearer.</h2>
          <p>
            I use your real budget, goals, meals and calendar to help you make informed choices.
          </p>
        </div>
      </div>

      {!ctx.data.aiStatus.configured && (
        <div className="banner info">
          <Icon name="sparkles" size={16} />
          <span>
            AI is not configured yet. Set an AI provider key on the backend (
            <code>OPENAI_API_KEY</code> or <code>ANTHROPIC_API_KEY</code>) to enable the assistant.
            Your data stays connected and ready.
          </span>
        </div>
      )}

      <div className="chat-layout">
        <Card className="chat-panel">
          <div className="chat-messages">
            {!chat || chat.messages.length === 0 ? (
              <Empty
                title={chat ? 'Start the conversation' : 'No conversation selected'}
                hint={
                  ctx.data.aiStatus.configured
                    ? 'Ask about your money, meals, goals or schedule.'
                    : 'The assistant becomes available once AI is configured.'
                }
              />
            ) : (
              chat.messages.map((entry: ChatMessage) => (
                <div
                  className={`message ${entry.role === 'user' ? 'user-message' : 'ai-message'}`}
                  key={entry.id}
                >
                  {entry.role !== 'user' && (
                    <div className="ai-orb">
                      <Icon name="sparkles" size={15} />
                    </div>
                  )}
                  <div>
                    <span>
                      {entry.role === 'user'
                        ? 'You'
                        : `LifePilot AI${entry.model_used ? ` · ${entry.model_used}` : ''}`}{' '}
                      · {formatDateTime(entry.created_at, ctx.timezone)}
                    </span>
                    <p>{entry.content}</p>
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="message ai-message">
                <div className="ai-orb">
                  <Icon name="sparkles" size={15} />
                </div>
                <div>
                  <span>LifePilot AI</span>
                  <p>Thinking…</p>
                </div>
              </div>
            )}
          </div>
          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault()
              void send(message)
            }}
          >
            <button
              className="icon-btn"
              type="button"
              onClick={() => void newConversation()}
              aria-label="New conversation"
            >
              <Icon name="plus" />
            </button>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                ctx.data.aiStatus.configured
                  ? 'Ask about your money, meals, goals or schedule...'
                  : 'Configure AI to start chatting'
              }
              disabled={!ctx.data.aiStatus.configured || sending}
            />
            <button
              className="send-btn"
              type="submit"
              disabled={!ctx.data.aiStatus.configured || sending || !message.trim()}
            >
              <Icon name="send" />
            </button>
          </form>
        </Card>

        <div className="chat-side">
          <Card>
            <SectionHead
              title="Conversations"
              action={
                <button className="text-btn" onClick={() => void newConversation()}>
                  New <Icon name="plus" size={13} />
                </button>
              }
            />
            {conversations.length === 0 ? (
              <Empty title="No conversations" hint="Start a new chat to keep your history." />
            ) : (
              <div className="conversation-list">
                {conversations.map((conversation) => (
                  <div
                    className={chat?.id === conversation.id ? 'active' : ''}
                    key={conversation.id}
                  >
                    <button onClick={() => void openConversation(conversation)}>
                      <strong>{conversation.title}</strong>
                      <small>{formatDay(conversation.created_at.slice(0, 10))}</small>
                    </button>
                    <button
                      className="icon-btn tiny"
                      onClick={() => void removeConversation(conversation)}
                      aria-label="Delete conversation"
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <SectionHead title="Try asking" />
            <div className="prompt-list">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void send(prompt)}
                  disabled={!ctx.data.aiStatus.configured || sending}
                >
                  <Icon name="sparkles" size={15} />
                  {prompt}
                  <Icon name="arrow" size={13} />
                </button>
              ))}
            </div>
          </Card>
          <Card className="context-card">
            <span>Context connected</span>
            {['Live budget', 'Savings goals', 'Meal plan', 'Weekly calendar'].map((label) => (
              <div key={label}>
                <Icon name="check" size={14} />
                {label}
              </div>
            ))}
            <small className="context-disclosure">
              Each message includes a limited summary of this data and sends it to your configured
              AI provider to answer your question.
            </small>
          </Card>
          {ctx.data.recommendations.filter((item) => item.status === 'pending').length > 0 && (
            <Card>
              <SectionHead title="Pending recommendations" />
              <div className="recommendation-list">
                {ctx.data.recommendations
                  .filter((item) => item.status === 'pending')
                  .slice(0, 3)
                  .map((item) => (
                    <div key={item.id}>
                      <p>{item.payload_json.slice(0, 140)}</p>
                      <div>
                        <button
                          className="text-btn"
                          onClick={() =>
                            void ctx.run(
                              () => updateRecommendationAction(item.id, 'accepted'),
                              'Recommendation accepted.',
                            )
                          }
                        >
                          Accept
                        </button>
                        <button
                          className="text-btn muted"
                          onClick={() =>
                            void ctx.run(
                              () => updateRecommendationAction(item.id, 'rejected'),
                              'Recommendation dismissed.',
                            )
                          }
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────

function SettingsPage({
  ctx,
  language,
  theme,
  onLanguage,
  onTheme,
}: {
  ctx: Ctx
  language: Language
  theme: Theme
  onLanguage: (value: Language) => void
  onTheme: (value: Theme) => void
}) {
  const profile = ctx.data.user
  const t = (value: string) => translate(value, language)
  const prefs = ctx.data.notificationPrefs
  const food = ctx.data.foodPrefs
  const hours = ctx.data.workingHours
  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [currency, setCurrency] = useState(profile?.currency ?? 'MAD')
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'UTC')
  const [simplified, setSimplified] = useState(profile?.simplified_ui ?? false)
  const [allergies, setAllergies] = useState((food?.allergies ?? []).join(', '))
  const [excluded, setExcluded] = useState((food?.excluded_ingredients ?? []).join(', '))
  const [maxPrep, setMaxPrep] = useState(String(food?.max_prep_minutes ?? 45))
  const [foodBudget, setFoodBudget] = useState(food?.weekly_food_budget ?? '0')
  const [workStart, setWorkStart] = useState(hours?.work_start ?? '09:00')
  const [workEnd, setWorkEnd] = useState(hours?.work_end ?? '18:00')
  const [workDays, setWorkDays] = useState<number[]>(hours?.work_days ?? [0, 1, 2, 3, 4])

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await ctx.run(
      () =>
        saveProfileAction({ first_name: firstName, currency, timezone, simplified_ui: simplified }),
      t('Profile saved.'),
    )
  }

  const exportAccountData = async () => {
    const result = await ctx.quiet(() => exportAccountDataAction())
    if (!result) return
    const file = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = href
    link.download = `lifepilot-data-${ctx.data.today}.json`
    link.click()
    URL.revokeObjectURL(href)
  }

  const saveFood = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await ctx.run(
      () =>
        updateFoodPreferencesAction({
          allergies: allergies
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          excluded_ingredients: excluded
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          max_prep_minutes: Number(maxPrep) || 45,
          weekly_food_budget: foodBudget,
        }),
      t('Food preferences saved.'),
    )
  }

  const saveHours = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await ctx.run(
      () =>
        updateWorkingHoursAction({ work_start: workStart, work_end: workEnd, work_days: workDays }),
      t('Working hours saved.'),
    )
  }

  const togglePref = (
    patch: Partial<
      Record<
        | 'enabled'
        | 'in_app_enabled'
        | 'push_enabled'
        | 'email_enabled'
        | 'weekly_summary_enabled'
        | 'spending_alerts_enabled',
        boolean
      >
    >,
  ) => {
    void ctx.run(() => updateNotificationPrefsAction(patch), t('Notification preferences saved.'))
  }

  const toggleDay = (day: number) => {
    setWorkDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort(),
    )
  }

  return (
    <div className="page-content">
      <div className="welcome">
        <div>
          <h2>{t('Personalize your LifePilot')}</h2>
          <p>{t('Fine-tune how your assistant plans, recommends and keeps you informed.')}</p>
        </div>
        <button
          className="primary-btn"
          onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {t(theme === 'dark' ? 'Switch to light' : 'Switch to dark')}
        </button>
      </div>

      <div className="settings-layout">
        <Card className="settings-nav">
          {[
            t('Profile'),
            'Budget & currency',
            t('Food preferences'),
            t('Working hours'),
            t('Notifications'),
            t('AI preferences'),
          ].map((label, index) => (
            <button className={index === 0 ? 'active' : ''} key={label}>
              {label}
              <Icon name="arrow" size={14} />
            </button>
          ))}
        </Card>

        <div className="settings-stack">
          <Card className="settings-form">
              <SectionHead title={t('Profile')} eyebrow={t('Account')} />
            <form onSubmit={saveProfile}>
              <div className="profile-edit">
                <span className="avatar large">
                  {(profile?.first_name ?? 'L').slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{profile?.email ?? '—'}</strong>
                  <small>{t('Connected to your LifePilot account')}</small>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  {t('First name')}
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  {t('Currency')}
                  <input
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                    maxLength={5}
                    required
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  {t('Timezone')}
                  <input
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    placeholder="Africa/Casablanca"
                    required
                  />
                </label>
                <label>
                  {t('Language')}
                  <select
                    value={language}
                    onChange={(event) => onLanguage(event.target.value as Language)}
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </label>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={simplified}
                  onChange={(event) => setSimplified(event.target.checked)}
                />
                {t('Use a simplified interface')}
              </label>
              <button className="primary-btn" type="submit" disabled={ctx.busy}>
                {t('Save profile')}
              </button>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => void exportAccountData()}
                disabled={ctx.busy}
              >
                {t('Export my LifePilot data')}
              </button>
              <small>
                {t('Downloads your app records as JSON. Push subscription credentials are excluded.')}
              </small>
            </form>
          </Card>

          <Card className="settings-form">
            <SectionHead title={t('Food preferences')} eyebrow={t('Meal planning')} />
            <form onSubmit={saveFood}>
              <label>
                {t('Allergies (comma separated)')}
                <input
                  value={allergies}
                  onChange={(event) => setAllergies(event.target.value)}
                  placeholder="peanuts, shellfish"
                />
              </label>
              <label>
                {t('Ingredients to avoid')}
                <input
                  value={excluded}
                  onChange={(event) => setExcluded(event.target.value)}
                  placeholder="pork, alcohol"
                />
              </label>
              <div className="form-grid">
                <label>
                  {t('Max prep minutes')}
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={maxPrep}
                    onChange={(event) => setMaxPrep(event.target.value)}
                  />
                </label>
                <label>
                  {t('Weekly food budget')}
                  <input
                    inputMode="decimal"
                    value={foodBudget}
                    onChange={(event) => setFoodBudget(event.target.value)}
                  />
                </label>
              </div>
              <button className="primary-btn" type="submit" disabled={ctx.busy}>
                {t('Save food preferences')}
              </button>
            </form>
          </Card>

          <Card className="settings-form">
            <SectionHead title={t('Working hours')} eyebrow={t('Scheduling')} />
            <form onSubmit={saveHours}>
              <div className="form-grid">
                <label>
                    {t('Start')}
                  <input
                    type="time"
                    value={workStart}
                    onChange={(event) => setWorkStart(event.target.value)}
                    required
                  />
                </label>
                <label>
                    {t('End')}
                  <input
                    type="time"
                    value={workEnd}
                    onChange={(event) => setWorkEnd(event.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="day-picker">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => (
                  <button
                    type="button"
                    className={workDays.includes(index) ? 'active' : ''}
                    key={label}
                    onClick={() => toggleDay(index)}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
              <button className="primary-btn" type="submit" disabled={ctx.busy}>
                {t('Save working hours')}
              </button>
            </form>
          </Card>

          <Card className="settings-form">
            <SectionHead title={t('Notifications')} eyebrow={t('Reminders')} />
            <div className="reminder-grid">
              {[30, 15, 5, 0].map((minutes) => (
                <div className="reminder-option" key={minutes}>
                  <span>{minutes}</span>
                  <div>
                    <strong>{minutes === 0 ? t('On time') : `${minutes} min`}</strong>
                    <small>{minutes === 0 ? t('at start time') : t('before the task')}</small>
                  </div>
                  <Icon name="check" size={15} />
                </div>
              ))}
            </div>
            <label className="toggle-row">
              <span>
                <strong>{t('Task reminders')}</strong>
                <small>{t('Receive in-app reminders before scheduled activities.')}</small>
              </span>
              <input
                type="checkbox"
                checked={prefs?.in_app_enabled ?? false}
                onChange={(event) =>
                  togglePref({
                    enabled: event.target.checked,
                    in_app_enabled: event.target.checked,
                  })
                }
              />
              <i />
            </label>
            <label className="toggle-row">
              <span>
                <strong>{t('Proactive spending alerts')}</strong>
                <small>{t('Get notified before you exceed a budget.')}</small>
              </span>
              <input
                type="checkbox"
                checked={prefs?.spending_alerts_enabled ?? false}
                onChange={(event) => togglePref({ spending_alerts_enabled: event.target.checked })}
              />
              <i />
            </label>
            <label className="toggle-row">
              <span>
                <strong>{t('Weekly planning summary')}</strong>
                <small>{t('Receive a clear plan every Sunday.')}</small>
              </span>
              <input
                type="checkbox"
                checked={prefs?.weekly_summary_enabled ?? false}
                onChange={(event) => togglePref({ weekly_summary_enabled: event.target.checked })}
              />
              <i />
            </label>
            <label className="toggle-row">
              <span>
                <strong>{t('Email notifications')}</strong>
                <small>{t('Send reminders to your email address.')}</small>
              </span>
              <input
                type="checkbox"
                checked={prefs?.email_enabled ?? false}
                onChange={(event) => togglePref({ email_enabled: event.target.checked })}
              />
              <i />
            </label>
          </Card>

          <Card className="settings-form">
            <SectionHead title={t('AI preferences')} eyebrow={t('Assistant')} />
            <div className={`banner ${ctx.data.aiStatus.configured ? 'success' : 'info'}`}>
              <Icon name="sparkles" size={16} />
              <span>
                {ctx.data.aiStatus.configured
                  ? `AI provider connected: ${ctx.data.aiStatus.provider}.`
                  : t('No AI provider key is configured on the backend. Assistant and AI generation are disabled.')}
              </span>
            </div>
            <p className="settings-hint">
              {t('The assistant reads your live budget, goals, meal plan and calendar. It never invents data and always asks for confirmation before changing your schedule.')}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

interface Notice {
  tone: 'success' | 'error'
  text: string
}

export default function LifePilotApp({
  user,
  initialData,
}: {
  user: { email: string; firstName: string; language: Language; theme: Theme }
  initialData: AppSnapshot
}) {
  const [page, setPage] = useState<Page>('Overview')
  const [sideOpen, setSideOpen] = useState(false)
  const [language, setLanguage] = useState<Language>(user.language)
  const [theme, setTheme] = useState<Theme>(user.theme)
  const [data, setData] = useState<AppSnapshot>(initialData)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const router = useRouter()

  useEffect(() => setData(initialData), [initialData])

  useEffect(() => {
    if (!data.user) return
    setLanguage(data.user.language === 'fr' ? 'fr' : 'en')
    setTheme(data.user.theme === 'light' ? 'light' : 'dark')
  }, [data.user])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const run: Runner = async (work, success) => {
    setBusy(true)
    try {
      const result = await work()
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error.message })
        return null
      }
      setNotice({ tone: 'success', text: success })
      router.refresh()
      return result.data
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Something went wrong.',
      })
      return null
    } finally {
      setBusy(false)
    }
  }

  const quiet = async <T,>(work: () => Promise<ActionResult<T>>): Promise<T | null> => {
    try {
      const result = await work()
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error.message })
        return null
      }
      return result.data
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Something went wrong.',
      })
      return null
    }
  }

  const savePreference = async (input: { language?: Language; theme?: Theme }) => {
    const result = await saveProfileAction(input)
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error.message })
      return
    }
    router.refresh()
  }

  const switchLanguage = () => {
    const next = language === 'en' ? 'fr' : 'en'
    setLanguage(next)
    void savePreference({ language: next })
  }

  const switchTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    void savePreference({ theme: next })
  }

  const changeTheme = (next: Theme) => {
    setTheme(next)
    void savePreference({ theme: next })
  }

  const changeLanguage = (next: Language) => {
    setLanguage(next)
    void savePreference({ language: next })
  }

  const refreshNotifications = async () => {
    const result = await loadNotificationsAction()
    if (result.ok) {
      setData((current) => ({ ...current, notifications: result.data }))
    }
  }

  const markRead = async (notification: NotificationItem) => {
    const result = await markNotificationReadAction(notification.id)
    if (result.ok) {
      setData((current) => ({
        ...current,
        notifications: {
          ...current.notifications,
          unread_count: Math.max(0, current.notifications.unread_count - 1),
          items: current.notifications.items.map((item) =>
            item.id === notification.id ? result.data : item,
          ),
        },
      }))
    }
  }

  const markAllRead = async () => {
    const result = await markAllNotificationsReadAction()
    if (result.ok) {
      setData((current) => ({
        ...current,
        notifications: {
          ...current.notifications,
          unread_count: 0,
          items: current.notifications.items.map((item) => ({ ...item, status: 'read' })),
        },
      }))
      setNotice({ tone: 'success', text: 'All notifications marked as read.' })
    }
  }

  const enableReminders = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setNotice({ tone: 'error', text: 'Please allow notifications in your browser.' })
        return
      }
    }
    await run(
      () => updateNotificationPrefsAction({ enabled: true, in_app_enabled: true }),
      'Reminders enabled: 30, 15, 5 minutes and at start time.',
    )
  }

  const ctx: Ctx = {
    data,
    busy,
    currency: data.currency || 'MAD',
    timezone: data.timezone || 'UTC',
    t: (value) => translate(value, language),
    run,
    quiet,
    go: setPage,
  }

  const unread = data.notifications.unread_count

  return (
    <div className={`app-shell theme-${theme}`}>
      <Sidebar
        page={page}
        setPage={setPage}
        open={sideOpen}
        setOpen={setSideOpen}
        language={language}
        user={{
          firstName: data.user?.first_name || user.firstName,
          email: data.user?.email || user.email,
        }}
      />
      {sideOpen && <div className="side-scrim" onClick={() => setSideOpen(false)} />}
      <main>
        <Header
          page={page}
          openNav={() => setSideOpen(true)}
          language={language}
          theme={theme}
          userName={data.user?.first_name || user.firstName}
          notificationsEnabled={data.notificationPrefs?.enabled ?? false}
          unreadCount={unread}
          onLanguage={switchLanguage}
          onTheme={switchTheme}
          onNotifications={() => {
            setShowNotifications((current) => !current)
            void refreshNotifications()
          }}
        />

        {notice && (
          <button className={`reminder-toast ${notice.tone}`} onClick={() => setNotice(null)}>
            <Icon name={notice.tone === 'error' ? 'bell' : 'check'} />
            <span>{notice.text}</span>
            <Icon name="close" size={14} />
          </button>
        )}

        {showNotifications && (
          <div className="notification-panel">
            <div className="notification-head">
              <strong>{translate('Notifications', language)}</strong>
              <div>
                <button className="text-btn" onClick={() => void markAllRead()}>
                  Mark all read
                </button>
                <button
                  className="icon-btn tiny"
                  onClick={() => setShowNotifications(false)}
                  aria-label="Close notifications"
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
            </div>
            {data.notifications.items.length === 0 ? (
              <Empty
                title="No notifications yet"
                hint="Reminders appear here before scheduled activities."
              />
            ) : (
              data.notifications.items.slice(0, 8).map((item) => (
                <button
                  className={`notification-item ${item.status === 'delivered' ? 'unread' : ''}`}
                  key={item.id}
                  onClick={() => void markRead(item)}
                >
                  <span className="notification-dot" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                    <em>{formatDateTime(item.scheduled_at, data.timezone || 'UTC')}</em>
                  </span>
                </button>
              ))
            )}
            <button className="text-btn notification-enable" onClick={() => void enableReminders()}>
              {data.notificationPrefs?.enabled ? 'Reminders active' : 'Enable reminders'}
            </button>
          </div>
        )}

        {!data.connected && data.error && (
          <div className="connection-banner">
            <Icon name="bell" size={16} />
            <span>
              <strong>Backend connection issue.</strong> {data.error.message}
            </span>
          </div>
        )}

        {page === 'Overview' && <Overview ctx={ctx} />}
        {page === 'My Budget' && <BudgetPage ctx={ctx} />}
        {page === 'Expenses' && <ExpensesPage ctx={ctx} />}
        {page === 'Recurring Payments' && <RecurringPage ctx={ctx} />}
        {page === 'Food Planner' && <FoodPage ctx={ctx} />}
        {page === 'My Goals' && <GoalsPage ctx={ctx} />}
        {page === 'Time Planner' && <PlannerPage ctx={ctx} />}
        {page === 'AI Assistant' && <AssistantPage ctx={ctx} />}
        {page === 'Settings' && (
          <SettingsPage
            ctx={ctx}
            language={language}
            theme={theme}
            onLanguage={changeLanguage}
            onTheme={changeTheme}
          />
        )}
      </main>
    </div>
  )
}
