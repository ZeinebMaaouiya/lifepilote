"""
Celery application configuration.
"""

from celery import Celery

from app.config import settings

celery_app = Celery(
    "lifepilot",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.notification_tasks",
        "app.workers.email_tasks",
        "app.workers.recurring_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Routing
    task_queues={
        "notifications": {"exchange": "notifications"},
        "emails": {"exchange": "emails"},
        "default": {"exchange": "default"},
    },
    task_default_queue="default",
    task_routes={
        "app.workers.notification_tasks.*": {"queue": "notifications"},
        "app.workers.email_tasks.*": {"queue": "emails"},
    },
    # Beat schedule — flag overdue recurring payments every hour
    beat_schedule={
        "update-overdue-payments-hourly": {
            "task": "app.workers.recurring_tasks.update_overdue_payments",
            "schedule": 3600.0,
        },
    },
)
