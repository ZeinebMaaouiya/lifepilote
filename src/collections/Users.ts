import type { Access, CollectionConfig } from 'payload'

const isAppUser = (user: unknown): user is { id: string | number; collection: 'users' } =>
  Boolean(
    user &&
    typeof user === 'object' &&
    'collection' in user &&
    user.collection === 'users' &&
    'id' in user,
  )

const ownProfile: Access = ({ req }) => {
  if (!isAppUser(req.user)) return false
  return { id: { equals: req.user.id } }
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    forgotPassword: {
      generateEmailHTML: async (args) => {
        const token = args?.token
        if (!token) return '<p>Password reset link unavailable. Request another password reset.</p>'
        const origin =
          process.env.FIGMA_PUBLIC_URL ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          'http://localhost:3000'
        const resetURL = new URL(`/auth/reset-password/${encodeURIComponent(token)}`, origin)
        return `<p>We received a request to reset your LifePilot password.</p><p><a href="${resetURL.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`
      },
      generateEmailSubject: async () => 'Reset your LifePilot password',
    },
  },
  admin: {
    hidden: true,
    useAsTitle: 'email',
  },
  access: {
    // New public app accounts are created by Better Auth. Keep legacy auth
    // fields intact during migration so existing identities can be verified.
    create: () => false,
    delete: () => false,
    read: ownProfile,
    update: ownProfile,
  },
  fields: [
    {
      name: 'firstName',
      type: 'text',
      required: true,
      maxLength: 80,
    },
    {
      name: 'language',
      type: 'select',
      defaultValue: 'en',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Français', value: 'fr' },
      ],
      required: true,
    },
    {
      name: 'theme',
      type: 'select',
      defaultValue: 'dark',
      options: [
        { label: 'Dark', value: 'dark' },
        { label: 'Light', value: 'light' },
      ],
      required: true,
    },
    {
      name: 'reminders',
      type: 'group',
      fields: [
        { name: 'thirtyMinutes', type: 'checkbox', defaultValue: true },
        { name: 'fifteenMinutes', type: 'checkbox', defaultValue: true },
        { name: 'fiveMinutes', type: 'checkbox', defaultValue: true },
        { name: 'atStart', type: 'checkbox', defaultValue: true },
      ],
    },
  ],
}
