import { redirect } from 'next/navigation'
import { appAuth } from '@/lib/app-auth'
import { loadAppSnapshot } from '@/lib/lifepilot-data'
import LifePilotApp from './LifePilotApp'

export default async function HomePage() {
  const user = await appAuth.currentUser()
  if (!user) redirect('/auth')

  const language = user.language === 'fr' ? 'fr' : 'en'
  const theme = user.theme === 'light' ? 'light' : 'dark'
  const firstName = user.name?.trim() || user.email.split('@')[0] || 'there'
  const initialData = await loadAppSnapshot({
    id: user.id,
    email: user.email,
    name: firstName,
    language,
    theme,
  })

  return (
    <LifePilotApp
      user={{
        email: user.email,
        firstName,
        language,
        theme,
      }}
      initialData={initialData}
    />
  )
}
