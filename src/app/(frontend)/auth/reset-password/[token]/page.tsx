import { ResetPasswordForm } from './ResetPasswordForm'

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return (
    <main className="auth-page reset-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span>✦</span>
          <strong>
            LifePilot <b>AI</b>
          </strong>
        </div>
        <div className="auth-copy">
          <span>ACCOUNT RECOVERY</span>
          <h1>Choose a new password</h1>
          <p>Use at least 8 characters. This reset link expires after a limited time.</p>
        </div>
        <ResetPasswordForm token={token} />
      </section>
    </main>
  )
}
