import 'server-only'

import { betterAuth } from 'better-auth/minimal'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { jwt } from 'better-auth/plugins'
import { after } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { sendAuthEmail } from '@/lib/auth-email'

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be configured with at least 32 characters.')
  }
  const baseURL = process.env.BETTER_AUTH_URL
  if (!baseURL) throw new Error('BETTER_AUTH_URL must be configured.')

  const prisma = getPrisma()
  return betterAuth({
    appName: 'LifePilot AI',
    baseURL,
    basePath: '/auth/api',
    secret,
    disabledPaths: ['/token'],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        const origin = process.env.BETTER_AUTH_URL
        if (!origin) throw new Error('Authentication URL is not configured.')
        const url = new URL(`/auth/reset-password/${encodeURIComponent(token)}`, origin)
        after(async () => {
          try {
            await sendAuthEmail({
              to: user.email,
              subject: 'Reset your LifePilot password',
              text: `Use this link to reset your password: ${url.toString()}`,
              html: `<p>Use this link to reset your LifePilot password:</p><p><a href="${url.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
            })
          } catch {
            console.error('[auth-email] password reset delivery failed')
          }
        })
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        after(async () => {
          try {
            await sendAuthEmail({
              to: user.email,
              subject: 'Verify your LifePilot email',
              text: `Use this link to verify your email: ${url}`,
              html: `<p>Verify your LifePilot email address:</p><p><a href="${url}">Verify email</a></p>`,
            })
          } catch {
            console.error('[auth-email] verification delivery failed')
          }
        })
      },
    },
    user: {
      additionalFields: {
        language: { type: 'string', required: false, defaultValue: 'en', input: false },
        theme: { type: 'string', required: false, defaultValue: 'dark', input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      jwt({
        disableSettingJwtHeader: true,
        jwks: { keyPairConfig: { alg: 'RS256', modulusLength: 2048 } },
        jwt: {
          expirationTime: '5 minutes',
          definePayload: ({ user }) => ({
            sub: user.id,
            id: user.id,
            email: user.email,
            name: user.name,
            language: user.language,
            theme: user.theme,
          }),
        },
      }),
      nextCookies(),
    ],
  })
}

let instance: ReturnType<typeof createAuth> | undefined

export function getAuth(): ReturnType<typeof createAuth> {
  if (instance) return instance
  instance = createAuth()
  return instance
}
