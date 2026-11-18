"""
Web Push delivery via pywebpush.

pywebpush is synchronous (requests under the hood), so it is executed in a
worker thread to avoid blocking the event loop.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class PushConfigurationError(RuntimeError):
    """Raised when VAPID keys are not configured."""


async def send_push_notification(
    *,
    endpoint: str,
    p256dh: str,
    auth: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    ttl: int = 3600,
) -> None:
    """
    Deliver a single Web Push message.

    Raises ``PushConfigurationError`` when VAPID keys are missing and lets
    ``pywebpush`` exceptions propagate so the caller can invalidate the
    subscription.
    """
    if not settings.vapid_private_key:
        raise PushConfigurationError("VAPID private key is not configured.")

    from pywebpush import webpush

    subscription_info = {
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
    }
    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "data": data or {},
        }
    )

    await asyncio.to_thread(
        webpush,
        subscription_info=subscription_info,
        data=payload,
        vapid_private_key=settings.vapid_private_key,
        vapid_claims={"sub": settings.vapid_claims_email},
        ttl=ttl,
        timeout=10,
    )
    logger.debug("Push delivered to %s", endpoint[:60])
