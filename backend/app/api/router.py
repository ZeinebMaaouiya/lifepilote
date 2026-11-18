"""Aggregate all v1 routers."""

from fastapi import APIRouter

from app.api import ai, finance, food, goals, notifications, schedule, users

api_router = APIRouter()
api_router.include_router(users.router)
api_router.include_router(finance.router)
api_router.include_router(food.router)
api_router.include_router(goals.router)
api_router.include_router(schedule.router)
api_router.include_router(notifications.router)
api_router.include_router(ai.router)
