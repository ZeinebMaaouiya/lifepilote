"""Email notification Celery tasks."""

import asyncio
import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
        return loop.run_until_complete(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


@celery_app.task(
    name="app.workers.email_tasks.send_reminder_email",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
    queue="emails",
)
def send_reminder_email(self, user_id: str, title: str, body: str) -> dict:
    """Send an email reminder to a user."""
    return _run_async(_send_reminder_email_async(self, user_id, title, body))


async def _send_reminder_email_async(task, user_id: str, title: str, body: str) -> dict:
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    import aiosmtplib
    from sqlalchemy import select

    from app.config import settings
    from app.database import AsyncSessionLocal
    from app.models.user import UserProfile

    if not settings.smtp_host or not settings.smtp_username:
        logger.info("Email not configured — skipping.")
        return {"status": "skipped"}

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserProfile).where(UserProfile.payload_user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile or not profile.email:
            return {"status": "no_email"}

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"LifePilot AI: {title}"
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        msg["To"] = profile.email

        html_body = f"""
        <html><body style="font-family:sans-serif;background:#0f0f23;color:#fff;padding:32px">
          <div style="max-width:480px;margin:0 auto">
            <h2 style="color:#a78bfa">LifePilot AI</h2>
            <h3 style="color:#fff">{title}</h3>
            <p style="color:#d4d4f0">{body}</p>
            <hr style="border-color:#2a2a4a;margin:24px 0"/>
            <small style="color:#6b6b9b">
              You're receiving this because you enabled email reminders in LifePilot AI.
            </small>
          </div>
        </body></html>
        """
        msg.attach(MIMEText(html_body, "html"))

        try:
            await aiosmtplib.send(
                msg,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_username,
                password=settings.smtp_password,
                use_tls=settings.smtp_use_tls,
            )
            return {"status": "sent", "to": profile.email}
        except Exception as exc:
            logger.error(f"Email send failed: {exc}")
            raise task.retry(exc=exc) from exc
