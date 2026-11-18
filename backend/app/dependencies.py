"""
FastAPI dependencies — auth, database, pagination.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Query, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.better_auth_jwt import BetterAuthJWTError, extract_user_identity
from app.database import get_db
from app.models.user import UserProfile

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserProfile:
    """
    FastAPI dependency: validates a Better Auth JWT, looks up the backend
    UserProfile and returns it. Raises 401 if the token is invalid or missing.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "missing_token", "message": "Authentication required."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        identity = await extract_user_identity(credentials.credentials)
    except BetterAuthJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_token", "message": "Authentication required."},
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    auth_user_id = identity["id"]

    result = await db.execute(
        select(UserProfile).where(UserProfile.better_auth_user_id == auth_user_id)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        # New users start with their Better Auth ID as the stable app principal.
        # A migration can attach an existing profile by setting better_auth_user_id.
        result = await db.execute(
            select(UserProfile).where(UserProfile.payload_user_id == auth_user_id)
        )
        profile = result.scalar_one_or_none()

    if profile is None:
        profile = UserProfile(
            payload_user_id=auth_user_id,
            better_auth_user_id=auth_user_id,
            email=identity.get("email", ""),
            first_name=identity.get("name", ""),
            language=identity.get("language", "en"),
            theme=identity.get("theme", "dark"),
        )
        db.add(profile)
    elif profile.better_auth_user_id is None:
        profile.better_auth_user_id = auth_user_id

    if db.new or db.dirty:
        await db.commit()
        await db.refresh(profile)

    return profile


# Convenience type alias for routers
CurrentUser = Annotated[UserProfile, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-indexed)"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    ):
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size


Pagination = Annotated[PaginationParams, Depends(PaginationParams)]
