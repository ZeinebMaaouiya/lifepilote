import assert from 'node:assert/strict'
import test from 'node:test'
import { attemptSignup, isDuplicateEmailError } from '../src/lib/auth-error-utils.ts'

test('recognizes Payload local strategy duplicate-email validation errors', () => {
  assert.equal(
    isDuplicateEmailError({
      name: 'ValidationError',
      data: {
        errors: [
          {
            path: 'email',
            message: 'A user with the given email is already registered.',
          },
        ],
      },
    }),
    true,
  )
})

test('does not classify unrelated registration or login errors as duplicate email', () => {
  assert.equal(isDuplicateEmailError(new Error('Unable to start an app session.')), false)
  assert.equal(
    isDuplicateEmailError({
      name: 'ValidationError',
      data: { errors: [{ path: 'email', message: 'Email is invalid.' }] },
    }),
    false,
  )
  assert.equal(
    isDuplicateEmailError({
      name: 'ValidationError',
      data: { errors: [{ path: 'firstName', message: 'This field is required.' }] },
    }),
    false,
  )
})

test('does not attempt login when account creation fails', async () => {
  let loginAttempted = false
  const result = await attemptSignup(
    async () => {
      throw new Error('database unavailable')
    },
    async () => {
      loginAttempted = true
    },
  )

  assert.deepEqual(result, {
    status: 'registration-failed',
    message: "We couldn't create your account right now. Please try again.",
  })
  assert.equal(loginAttempted, false)
})

test('returns duplicate-email only for Payload existing-email validation', async () => {
  let loginAttempted = false
  const result = await attemptSignup(
    async () => {
      throw {
        name: 'ValidationError',
        data: {
          errors: [
            {
              path: 'email',
              message: 'A user with the given email is already registered.',
            },
          ],
        },
      }
    },
    async () => {
      loginAttempted = true
    },
  )

  assert.deepEqual(result, { status: 'duplicate-email' })
  assert.equal(loginAttempted, false)
})

test('preserves successful account creation when automatic login fails', async () => {
  let accountCreated = false
  const result = await attemptSignup(
    async () => {
      accountCreated = true
    },
    async () => {
      throw new Error('session unavailable')
    },
  )

  assert.equal(accountCreated, true)
  assert.deepEqual(result, { status: 'login-failed' })
})

test('returns the Payload validation message for a nonduplicate create failure', async () => {
  const result = await attemptSignup(
    async () => {
      throw Object.assign(new Error('The following field is invalid: firstName'), {
        name: 'ValidationError',
        data: { errors: [{ path: 'firstName', message: 'Required.' }] },
      })
    },
    async () => {},
  )

  assert.deepEqual(result, {
    status: 'registration-failed',
    message: 'The following field is invalid: firstName',
  })
})
