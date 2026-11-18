"""Shared router helpers: consistent errors and ownership lookups."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserProfile


def api_error(
    status_code: int,
    code: str,
    message: str,
    **extra: Any,
) -> HTTPException:
    """Build an HTTPException with the API's structured error shape."""
    detail: dict[str, Any] = {"code": code, "message": message}
    detail.update(extra)
    return HTTPException(status_code=status_code, detail=detail)


def not_found(resource: str = "Resource") -> HTTPException:
    return api_error(status.HTTP_404_NOT_FOUND, "not_found", f"{resource} not found.")


async def get_owned[T](
    db: AsyncSession,
    model: type[T],
    obj_id: str,
    user: UserProfile,
    resource: str = "Resource",
) -> T:
    """
    Fetch a row by id, scoped to the current user's ``payload_user_id``.

    Every user-owned model carries ``payload_user_id``, so this also prevents
    cross-user access without a separate access layer.
    """
    result = await db.execute(
        select(model).where(
            model.id == obj_id,  # type: ignore[attr-defined]
            model.payload_user_id == user.payload_user_id,  # type: ignore[attr-defined]
        )
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise not_found(resource)
    return obj
