import 'server-only'

import { appAuth } from './app-auth'
import type { BackendErrorInfo, BackendUser, Language, Theme } from './lifepilot-types'

const API_PREFIX = '/api/v1'

export class BackendError extends Error {
  status: number
  code: string
  details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'BackendError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function backendBaseUrl(): string {
  const configured =
    process.env.BACKEND_URL || process.env.LIFEPILOT_API_URL || 'http://127.0.0.1:8000'
  return configured.replace(/\/+$/, '')
}

export async function getSessionToken(): Promise<string | null> {
  try {
    return await appAuth.backendToken()
  } catch {
    return null
  }
}

export async function requireSessionToken(): Promise<string> {
  const token = await getSessionToken()
  if (!token) {
    throw new BackendError(
      401,
      'missing_session',
      'Your session has expired. Sign in again to continue.',
    )
  }
  return token
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function validationMessage(detail: unknown): string {
  if (!Array.isArray(detail)) return 'The request was rejected by the server.'
  return detail
    .map((entry) => {
      if (!isRecord(entry)) return 'Invalid value.'
      const location = Array.isArray(entry.loc)
        ? entry.loc.filter((part) => part !== 'body').join('.')
        : ''
      const message = typeof entry.msg === 'string' ? entry.msg : 'Invalid value.'
      return location ? `${location}: ${message}` : message
    })
    .join(' ')
}

export function errorInfo(error: unknown): BackendErrorInfo {
  if (error instanceof BackendError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    }
  }
  if (error instanceof Error) {
    return { code: 'unexpected_error', message: error.message }
  }
  return { code: 'unexpected_error', message: 'Something went wrong.' }
}

interface BackendRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  token?: string
  timeoutMs?: number
}

export async function backendFetch<T>(path: string, options: BackendRequest = {}): Promise<T> {
  const token = options.token ?? (await requireSessionToken())
  const url = `${backendBaseUrl()}${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    })
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'TimeoutError'
        ? 'The LifePilot API took too long to respond.'
        : 'The LifePilot API is not reachable. Start the backend and try again.'
    throw new BackendError(0, 'backend_unreachable', message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const raw = await response.text()
  let payload: unknown = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const detail = isRecord(payload) ? payload.detail : undefined

    if (isRecord(detail)) {
      const code = typeof detail.code === 'string' ? detail.code : 'request_failed'
      const message =
        typeof detail.message === 'string' ? detail.message : `Request failed (${response.status}).`
      throw new BackendError(response.status, code, message, detail)
    }

    if (typeof detail === 'string') {
      throw new BackendError(response.status, 'request_failed', detail)
    }

    if (Array.isArray(detail)) {
      throw new BackendError(response.status, 'validation_error', validationMessage(detail), {
        detail,
      })
    }

    throw new BackendError(
      response.status,
      'request_failed',
      `Request failed (${response.status}).`,
    )
  }

  return payload as T
}

/** Sync the authenticated app identity into the backend profile on each app load. */
export async function syncBackendIdentity(input: {
  authUserId: string
  email: string
  firstName: string
  language: Language
  theme: Theme
}): Promise<BackendUser> {
  return backendFetch<BackendUser>('/users/sync', {
    method: 'POST',
    body: {
      auth_user_id: input.authUserId,
      email: input.email,
      first_name: input.firstName,
      language: input.language,
      theme: input.theme,
    },
  })
}
