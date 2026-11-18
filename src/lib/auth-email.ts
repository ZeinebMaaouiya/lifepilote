import 'server-only'

import nodemailer from 'nodemailer'

type Mail = { to: string; subject: string; text: string; html: string }

export async function sendAuthEmail(mail: Mail): Promise<void> {
  const host = process.env.AUTH_SMTP_HOST
  const port = Number(process.env.AUTH_SMTP_PORT || '587')
  const user = process.env.AUTH_SMTP_USERNAME
  const pass = process.env.AUTH_SMTP_PASSWORD
  const from = process.env.AUTH_SMTP_FROM_EMAIL

  if (!host || !user || !pass || !from || !Number.isInteger(port)) {
    throw new Error('Authentication email delivery is not configured.')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from: process.env.AUTH_SMTP_FROM_NAME
      ? { name: process.env.AUTH_SMTP_FROM_NAME, address: from }
      : from,
    ...mail,
  })
}
