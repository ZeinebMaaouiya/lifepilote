'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth'
import { appAuth } from '@/lib/app-auth'
import { getPrisma } from '@/lib/prisma'

export type AuthState = { error?: string; success?: string }

const readText = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const readPassword = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = readText(formData, 'email').toLowerCase()
  const password = readPassword(formData, 'password')
  if (!validEmail(email) || !password) return { error: 'Enter your email and password.' }

  try {
    await appAuth.login(email, password)
  } catch {
    return { error: 'Sign-in failed. Check your email and password.' }
  }
  redirect('/')
}

export async function registerAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const firstName = readText(formData, 'firstName')
  const email = readText(formData, 'email').toLowerCase()
  const password = readPassword(formData, 'password')

  if (firstName.length < 2 || firstName.length > 80) return { error: 'Enter your first name.' }
  if (!validEmail(email)) return { error: 'Enter a valid email address.' }
  if (password.length < 8 || password.length > 128) {
    return { error: 'Use a password between 8 and 128 characters.' }
  }

  try {
    await getAuth().api.signUpEmail({
      headers: await headers(),
      body: { name: firstName, email, password },
    })
  } catch {
    return { error: 'We could not complete signup. Check your details and try again.' }
  }

  return { success: 'Your account is ready. You can now sign in.' }
}

export async function requestPasswordResetAction(
  _: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readText(formData, 'email').toLowerCase()
  if (!validEmail(email)) return { error: 'Enter a valid email address.' }

  try {
    await getAuth().api.requestPasswordReset({
      headers: await headers(),
      body: { email, redirectTo: '/auth/reset-password' },
    })
  } catch {
    // Keep the response identical for unknown accounts and delivery failures.
  }

  return {
    success: 'If an account uses that email, password reset instructions will be sent.',
  }
}

export async function resetPasswordAction(
  token: string,
  _: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = readPassword(formData, 'password')
  const confirmation = readPassword(formData, 'confirmation')
  if (token.length < 20 || token.length > 512) return { error: 'This reset link is invalid.' }
  if (password.length < 8 || password.length > 128) {
    return { error: 'Use a password between 8 and 128 characters.' }
  }
  if (password !== confirmation) return { error: 'The passwords do not match.' }

  try {
    await getAuth().api.resetPassword({
      headers: await headers(),
      body: { newPassword: password, token },
    })
    return { success: 'Your password has been reset. You can now sign in.' }
  } catch {
    return { error: 'This reset link is invalid or has expired. Request a new one.' }
  }
}

export async function logoutAction() {
  await appAuth.logout()
  redirect('/auth')
}

export async function updatePreferences(input: {
  language?: 'en' | 'fr'
  theme?: 'dark' | 'light'
}) {
  const user = await appAuth.currentUser()
  if (!user) return { ok: false as const, error: 'signed-out' }

  const data: { language?: 'en' | 'fr'; theme?: 'dark' | 'light' } = {}
  if (input.language === 'en' || input.language === 'fr') data.language = input.language
  if (input.theme === 'dark' || input.theme === 'light') data.theme = input.theme
  if (!Object.keys(data).length) return { ok: false as const, error: 'invalid-preferences' }

  await getPrisma().user.update({ where: { id: user.id }, data })
  return { ok: true as const }
}
