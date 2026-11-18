'use client'

import { useActionState, useState } from 'react'
import {
  loginAction,
  registerAction,
  requestPasswordResetAction,
  resendVerificationAction,
  type AuthState,
} from './actions'

const initialState: AuthState = {}

export function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, initialState)
  const [registerState, registerFormAction, registerPending] = useActionState(
    registerAction,
    initialState,
  )
  const [resetState, resetFormAction, resetPending] = useActionState(
    requestPasswordResetAction,
    initialState,
  )
  const [verificationState, verificationFormAction, verificationPending] = useActionState(
    resendVerificationAction,
    initialState,
  )
  const state = mode === 'login' ? loginState : mode === 'register' ? registerState : resetState
  const pending =
    mode === 'login' ? loginPending : mode === 'register' ? registerPending : resetPending

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span>✦</span>
        <strong>
          LifePilot <b>AI</b>
        </strong>
      </div>
      <div className="auth-copy">
        <span>
          {mode === 'login'
            ? 'WELCOME BACK'
            : mode === 'register'
              ? 'CREATE YOUR ACCOUNT'
              : 'ACCOUNT RECOVERY'}
        </span>
        <h1>
          {mode === 'login'
            ? 'Continue your journey'
            : mode === 'register'
              ? 'Your life, organized'
              : 'Reset your password'}
        </h1>
        <p>
          {mode === 'login'
            ? 'Sign in to access your budget, goals and schedule.'
            : mode === 'register'
              ? 'Start managing your money, time and goals in one calm space.'
              : 'Enter your email and we’ll send reset instructions if an account matches.'}
        </p>
      </div>
      {mode !== 'forgot' && (
        <div className="auth-tabs">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
            type="button"
          >
            Sign in
          </button>
          <button
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
            type="button"
          >
            Create account
          </button>
        </div>
      )}
      <form
        action={
          mode === 'login'
            ? loginFormAction
            : mode === 'register'
              ? registerFormAction
              : resetFormAction
        }
      >
        {mode === 'register' && (
          <label>
            First name
            <input name="firstName" autoComplete="given-name" required />
          </label>
        )}
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required />
        </label>
        {mode !== 'forgot' && (
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              required
            />
          </label>
        )}
        {state.error && <p className="auth-error">{state.error}</p>}
        {state.success && <p className="auth-success">{state.success}</p>}
        <button className="primary-btn auth-submit" disabled={pending} type="submit">
          {pending
            ? 'Please wait…'
            : mode === 'login'
              ? 'Sign in'
              : mode === 'register'
                ? 'Create my account'
                : 'Send reset instructions'}
        </button>
      </form>
      {mode === 'login' && (
        <button className="text-btn" type="button" onClick={() => setMode('forgot')}>
          Forgot password?
        </button>
      )}
      {mode === 'forgot' && (
        <button className="text-btn" type="button" onClick={() => setMode('login')}>
          Back to sign in
        </button>
      )}
      {mode === 'register' && registerState.showLogin && (
        <>
          <form action={verificationFormAction}>
            <label>
              Resend verification email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            {verificationState.error && <p className="auth-error">{verificationState.error}</p>}
            {verificationState.success && (
              <p className="auth-success">{verificationState.success}</p>
            )}
            <button className="text-btn" disabled={verificationPending} type="submit">
              {verificationPending ? 'Please wait…' : 'Resend email'}
            </button>
          </form>
          <button className="text-btn" type="button" onClick={() => setMode('login')}>
            Go to sign in
          </button>
        </>
      )}
      <small>By continuing, you agree to keep your account credentials private.</small>
    </div>
  )
}
