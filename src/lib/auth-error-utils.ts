const PAYLOAD_DUPLICATE_EMAIL_MESSAGE = 'A user with the given email is already registered.'

export function isDuplicateEmailError(error: unknown): boolean {
  if (
    !error ||
    typeof error !== 'object' ||
    !('name' in error) ||
    error.name !== 'ValidationError'
  ) {
    return false
  }

  if (
    !('data' in error) ||
    !error.data ||
    typeof error.data !== 'object' ||
    !('errors' in error.data)
  ) {
    return false
  }

  const errors = error.data.errors
  return (
    Array.isArray(errors) &&
    errors.some(
      (fieldError) =>
        fieldError &&
        typeof fieldError === 'object' &&
        'path' in fieldError &&
        fieldError.path === 'email' &&
        'message' in fieldError &&
        fieldError.message === PAYLOAD_DUPLICATE_EMAIL_MESSAGE,
    )
  )
}

export type SignupAttemptResult =
  | { status: 'created' }
  | { status: 'duplicate-email' }
  | { status: 'login-failed' }
  | { status: 'registration-failed'; message: string }

export async function attemptSignup(
  createAccount: () => Promise<unknown>,
  login: () => Promise<unknown>,
): Promise<SignupAttemptResult> {
  try {
    await createAccount()
  } catch (error) {
    if (isDuplicateEmailError(error)) return { status: 'duplicate-email' }

    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'ValidationError' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return { status: 'registration-failed', message: error.message }
    }

    return {
      status: 'registration-failed',
      message: "We couldn't create your account right now. Please try again.",
    }
  }

  try {
    await login()
  } catch {
    return { status: 'login-failed' }
  }

  return { status: 'created' }
}
