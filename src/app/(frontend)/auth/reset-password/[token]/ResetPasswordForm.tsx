'use client'

import { useActionState } from 'react'
import { resetPasswordAction, type AuthState } from '../../actions'

const initialState: AuthState = {}

export function ResetPasswordForm({ token }: { token: string }) {
  const action = resetPasswordAction.bind(null, token)
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction}>
      <label>
        New password
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label>
        Confirm password
        <input
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      {state.error && <p className="auth-error">{state.error}</p>}
      {state.success && <p className="auth-success">{state.success}</p>}
      <a className="primary-btn auth-submit auth-link" href="/auth">
        Back to sign in
      </a>
      {!state.success && (
        <button className="primary-btn auth-submit" disabled={pending} type="submit">
          {pending ? 'Please wait…' : 'Save new password'}
        </button>
      )}
    </form>
  )
}
