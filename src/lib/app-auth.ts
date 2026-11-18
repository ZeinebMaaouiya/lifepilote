import 'server-only'

import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'

export const appAuth = {
  async currentUser() {
    const session = await getAuth().api.getSession({ headers: await headers() })
    return session?.user ?? null
  },

  async login(email: string, password: string) {
    return getAuth().api.signInEmail({
      headers: await headers(),
      body: { email, password },
    })
  },

  async logout() {
    return getAuth().api.signOut({ headers: await headers() })
  },

  async backendToken() {
    const session = await getAuth().api.getSession({ headers: await headers() })
    if (!session) throw new Error('An authenticated session is required.')

    const result = await getAuth().api.signJWT({
      body: {
        payload: {
          sub: session.user.id,
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          language: session.user.language,
          theme: session.user.theme,
        },
      },
    })
    return result.token
  },
}
