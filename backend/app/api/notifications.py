"""Notification endpoints: inbox, read state and Web Push subscriptions."""

from __future__ import annotations

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select, update

from app.api.helpers import api_error, get_owned
from app.config import settings
from app.dependencies import DB, CurrentUser, Pagination
from app.models.notification import Notification, PushSubscription
from app.schemas.notification import (
    NotificationListOut,
    NotificationOut,
    PushSubscriptionIn,
    PushSubscriptionOut,
    VapidPublicKeyOut,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListOut)
async def list_notifications(
    user: CurrentUser,
    db: DB,
    pagination: Pagination,
    unread_only: bool = Query(False),
) -> NotificationListOut:
    conditions = [Notification.payload_user_id == user.payload_user_id]
    if unread_only:
        conditions.append(Notification.status == "delivered")

    total = await db.scalar(
        select(func.count()).select_from(Notification).where(*conditions)
    )
    unread_count = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.payload_user_id == user.payload_user_id,
            Notification.status == "delivered",
        )
    )

    result = await db.execute(
        select(Notification)
        .where(*conditions)
        .order_by(Notification.scheduled_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    items = [
        NotificationOut.model_validate(notification)
        for notification in result.scalars().all()
    ]

    return NotificationListOut(
        items=items,
        unread_count=int(unread_count or 0),
        total=int(total or 0),
    )


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: str,
    user: CurrentUser,
    db: DB,
) -> NotificationOut:
    notification = await get_owned(
        db, Notification, notification_id, user, "Notification"
    )
    notification.status = "read"
    await db.commit()
    await db.refresh(notification)
    return NotificationOut.model_validate(notification)


@router.post("/read-all")
async def mark_all_read(user: CurrentUser, db: DB) -> dict:
    result = await db.execute(
        update(Notification)
        .where(
            Notification.payload_user_id == user.payload_user_id,
            Notification.status == "delivered",
        )
        .values(status="read")
    )
    await db.commit()
    return {"updated": result.rowcount or 0}


@router.get("/vapid-public-key", response_model=VapidPublicKeyOut)
async def get_vapid_public_key() -> VapidPublicKeyOut:
    return VapidPublicKeyOut(public_key=settings.vapid_public_key)


@router.post(
    "/push-subscriptions",
    response_model=PushSubscriptionOut,
    status_code=status.HTTP_201_CREATED,
)
async def register_push_subscription(
    payload: PushSubscriptionIn,
    user: CurrentUser,
    db: DB,
) -> PushSubscriptionOut:
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.endpoint == payload.endpoint
        )
    )
    subscription = result.scalar_one_or_none()

    if subscription is not None:
        if subscription.payload_user_id != user.payload_user_id:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "subscription_owned",
                "This push subscription belongs to another account.",
            )
        subscription.p256dh = payload.p256dh
        subscription.auth = payload.auth
        subscription.user_agent = payload.user_agent
        subscription.is_active = True
    else:
        subscription = PushSubscription(
            payload_user_id=user.payload_user_id,
            endpoint=payload.endpoint,
            p256dh=payload.p256dh,
            auth=payload.auth,
            user_agent=payload.user_agent,
            is_active=True,
        )
        db.add(subscription)

    await db.commit()
    await db.refresh(subscription)
    return PushSubscriptionOut.model_validate(subscription)


@router.delete(
    "/push-subscriptions/{subscription_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_push_subscription(
    subscription_id: str,
    user: CurrentUser,
    db: DB,
) -> None:
    subscription = await get_owned(
        db, PushSubscription, subscription_id, user, "Push subscription"
    )
    await db.delete(subscription)
    await db.commit()
