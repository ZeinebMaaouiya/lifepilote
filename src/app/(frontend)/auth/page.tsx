import { redirect } from 'next/navigation'
import { appAuth } from '@/lib/app-auth'
import { AuthForm } from './AuthForm'

export default async function AuthPage() {
  if (await appAuth.currentUser()) redirect('/')
  return (
    <main className="auth-page">
      <div className="auth-visual">
        <div className="auth-quote">
          <span>TAKE CONTROL</span>
          <h2>Money, time and goals.<br />Finally in one place.</h2>
          <p>Make clearer decisions with an assistant that understands the complete picture.</p>
        </div>
      </div>
      <AuthForm />
    </main>
  )
}
