"""
End-to-end smoke test for the LifePilot AI API.

Run inside the backend container (it already has httpx + python-jose):

    docker compose exec -T backend python scripts/smoke_test.py

Environment:
    API_BASE_URL   default http://127.0.0.1:8000/api/v1
    PAYLOAD_SECRET must match the running backend's secret
    SMOKE_USER_ID  default "smoke-user-1"

The script is safe to re-run: it removes leftover fixtures for the same
budget month before creating new ones.
"""

from __future__ import annotations

import os
import sys
import time
import traceback
from datetime import date

import httpx
from jose import jwt

BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000/api/v1")
SECRET = os.environ["PAYLOAD_SECRET"]
USER_ID = os.environ.get("SMOKE_USER_ID", "smoke-user-1")
EMAIL = os.environ.get("SMOKE_USER_EMAIL", "smoke@example.com")

YEAR = int(os.environ.get("SMOKE_YEAR", "2027"))
MONTH = int(os.environ.get("SMOKE_MONTH", "3"))

failures: list[tuple[str, str, int, str]] = []


def token() -> str:
    return jwt.encode(
        {
            "id": USER_ID,
            "email": EMAIL,
            "collection": "users",
            "firstName": "Smoke",
            "exp": int(time.time()) + 3600,
        },
        SECRET,
        algorithm="HS256",
    )


client = httpx.Client(
    base_url=BASE_URL,
    headers={"Authorization": f"Bearer {token()}"},
    timeout=120,
)


def call(method: str, path: str, expect: int = 200, **kwargs):
    response = client.request(method, path, **kwargs)
    ok = response.status_code == expect
    label = "PASS" if ok else "FAIL"
    print(f"{label} {method:6} {path:58} -> {response.status_code}")
    if not ok:
        body = response.text[:600]
        print(f"     {body}")
        failures.append((method, path, response.status_code, body))
    return response


def json_of(response) -> dict:
    try:
        return response.json()
    except Exception:  # pragma: no cover - defensive
        return {}


def _items(payload) -> list[dict]:
    """Accept either a bare list or a paginated ``{"items": [...]}`` payload."""
    if isinstance(payload, list):
        return payload
    return payload.get("items", []) if isinstance(payload, dict) else []


def cleanup_user_fixtures() -> None:
    """
    Reset the dedicated smoke user's fixtures so runs are repeatable.

    Only run this against the throwaway account named by SMOKE_USER_ID.
    """
    response = client.get("/finance/budgets", params={"year": YEAR, "month": MONTH})
    if response.status_code == 200:
        for budget in _items(response.json()):
            client.delete(f"/finance/budgets/{budget['id']}")

    for path in ("/schedule/activities", "/goals", "/ai/conversations"):
        response = client.get(path)
        if response.status_code == 200:
            for item in _items(response.json()):
                client.delete(f"{path}/{item['id']}")

    response = client.get("/food/grocery")
    if response.status_code == 200:
        for item in _items(response.json()):
            client.delete(f"/food/grocery/{item['id']}")

    response = client.get("/food/recipes")
    if response.status_code == 200:
        for recipe in _items(response.json()):
            if recipe["name"].startswith("Smoke "):
                client.delete(f"/food/recipes/{recipe['id']}")


def main() -> int:
    cleanup_user_fixtures()

    # ── Users ────────────────────────────────────────────────────────────────
    me = json_of(call("GET", "/users/me"))
    uid = me.get("payload_user_id", USER_ID)
    call(
        "PATCH",
        "/users/me",
        json={"timezone": "Africa/Casablanca", "currency": "MAD"},
    )
    call(
        "PATCH",
        "/users/me",
        expect=422,
        json={"timezone": "Not/A_Timezone"},
    )
    exported = json_of(call("GET", "/users/me/export"))
    if exported.get("format") != "lifepilot-data-export-v1":
        failures.append(("GET", "/users/me/export", 200, "Unexpected export format"))
    if "push_subscriptions" in exported.get("data", {}):
        failures.append(("GET", "/users/me/export", 200, "Push credentials must not be exported"))
    report = call("GET", "/finance/reports/monthly?months=6")
    if report.status_code == 200 and len(report.json()) != 6:
        failures.append(("GET", "/finance/reports/monthly", 200, "Expected six report months"))
    call(
        "POST",
        "/users/sync",
        json={
            "payload_user_id": uid,
            "email": EMAIL,
            "first_name": "Smoke",
            "language": "fr",
            "theme": "dark",
        },
    )
    call("POST", "/users/sync", expect=403,
         json={"payload_user_id": "someone-else", "email": EMAIL,
               "first_name": "Nope", "language": "en", "theme": "dark"})
    call("GET", "/users/me/notification-preferences")
    call(
        "PATCH",
        "/users/me/notification-preferences",
        json={"reminder_minutes": [15, 5, 0], "push_enabled": False},
    )

    # ── Finance ──────────────────────────────────────────────────────────────
    budget_id = json_of(
        call(
            "POST",
            "/finance/budgets",
            expect=201,
            json={
                "year": YEAR,
                "month": MONTH,
                "total_income": "12000.00",
                "notes": "smoke",
            },
        )
    ).get("id")
    call(
        "POST",
        "/finance/budgets",
        expect=409,
        json={"year": YEAR, "month": MONTH, "total_income": "1.00"},
    )

    category_id = json_of(
        call(
            "POST",
            f"/finance/budgets/{budget_id}/categories",
            expect=201,
            json={
                "name": "Food",
                "allocated_amount": "3000.00",
                "color": "green",
                "icon": "food",
            },
        )
    ).get("id")

    expense_id = json_of(
        call(
            "POST",
            "/finance/expenses",
            expect=201,
            json={
                "amount": "250.50",
                "description": "Groceries",
                "date": f"{YEAR}-{MONTH:02d}-02",
                "category_id": category_id,
                "payment_method": "card",
            },
        )
    ).get("id")

    call("GET", "/finance/expenses", params={"page": 1, "page_size": 10})
    summary = json_of(call("GET", f"/finance/budgets/{budget_id}/summary"))
    print(f"     summary: {summary}")
    call("GET", f"/finance/budgets/{budget_id}")
    call(
        "PATCH",
        f"/finance/budgets/{budget_id}",
        json={"total_income": "13000.00"},
    )
    call("PATCH", f"/finance/expenses/{expense_id}", json={"amount": "300.00"})

    payment_id = json_of(
        call(
            "POST",
            "/finance/recurring-payments",
            expect=201,
            json={
                "name": "Internet",
                "amount": "300.00",
                "frequency": "monthly",
                "next_due_date": f"{YEAR}-{MONTH:02d}-10",
            },
        )
    ).get("id")
    call("POST", f"/finance/recurring-payments/{payment_id}/pay")
    call("GET", "/finance/recurring-payments")

    # ── Goals ────────────────────────────────────────────────────────────────
    goal_id = json_of(
        call(
            "POST",
            "/goals",
            expect=201,
            json={
                "title": "Save 6000 MAD",
                "target_value": "6000.00",
                "period": "yearly",
                "financial_target_amount": "6000.00",
            },
        )
    ).get("id")
    call("PATCH", f"/goals/{goal_id}/progress", json={"current_value": "1500.00"})
    call("PATCH", f"/goals/{goal_id}/financial", json={"saved_amount": "1500.00"})
    call("GET", "/goals")

    # ── Schedule ─────────────────────────────────────────────────────────────
    day = (date(YEAR, MONTH, 3)).isoformat()
    start = f"{day}T10:00:00+00:00"
    end = f"{day}T11:00:00+00:00"
    activity_id = json_of(
        call(
            "POST",
            "/schedule/activities",
            expect=201,
            json={
                "title": "Deep work",
                "start_time": start,
                "end_time": end,
                "is_fixed": True,
            },
        )
    ).get("activity", {}).get("id")

    call(
        "POST",
        "/schedule/activities",
        expect=409,
        json={
            "title": "Overlap",
            "start_time": f"{day}T10:30:00+00:00",
            "end_time": f"{day}T11:30:00+00:00",
            "is_fixed": True,
        },
    )
    overlap_activity_id = json_of(
        call(
            "POST",
            "/schedule/activities",
            expect=201,
            json={
                "title": "Overlap ok",
                "start_time": f"{day}T10:30:00+00:00",
                "end_time": f"{day}T11:30:00+00:00",
                "is_fixed": True,
                "override_conflict": True,
            },
        )
    ).get("activity", {}).get("id")
    call("GET", "/schedule/activities")

    # Moving an activity must re-arm its reminders in place: the
    # (user, activity, type) triple is unique, so duplicates would fail.
    call(
        "PATCH",
        f"/schedule/activities/{activity_id}",
        json={
            "start_time": f"{day}T12:00:00+00:00",
            "end_time": f"{day}T13:00:00+00:00",
        },
    )
    reminders = [
        item
        for item in json_of(
            call("GET", "/notifications", params={"page": 1, "page_size": 100})
        ).get("items", [])
        if item.get("activity_id") == activity_id
    ]
    if len(reminders) != 3 or any(item["status"] != "pending" for item in reminders):
        print(f"FAIL reschedule reminders -> {reminders}")
        failures.append(
            ("GET", "/notifications (reschedule)", 200, str(reminders))
        )
    else:
        print("PASS reschedule reminders (3 rows re-armed, no duplicates)")

    call(
        "GET",
        "/schedule/free-slots",
        params={"week_start": f"{day}T00:00:00+00:00", "duration_minutes": 60},
    )
    call("GET", "/schedule/working-hours")
    call(
        "PUT",
        "/schedule/working-hours",
        json={"work_start": "08:00", "work_end": "17:00", "work_days": [0, 1, 2, 3, 4]},
    )

    # ── Food ─────────────────────────────────────────────────────────────────
    call("GET", "/food/preferences")
    call(
        "PATCH",
        "/food/preferences",
        json={
            "allergies": ["peanuts"],
            "max_prep_minutes": 30,
            "weekly_food_budget": "800.00",
        },
    )
    recipe_id = json_of(
        call(
            "POST",
            "/food/recipes",
            expect=201,
            json={
                "name": "Smoke Omelette",
                "category": "breakfast",
                "prep_duration_min": 10,
                "ingredients": [
                    {
                        "name": "Eggs",
                        "quantity": "3",
                        "unit": "pcs",
                        "estimated_price": "1.50",
                    }
                ],
            },
        )
    ).get("id")
    call("GET", "/food/recipes", params={"search": "omel"})
    call("PATCH", f"/food/recipes/{recipe_id}", json={"notes": "quick"})
    call("GET", "/food/grocery")
    grocery_id = json_of(
        call(
            "POST",
            "/food/grocery",
            expect=201,
            json={
                "ingredient_name": "Milk",
                "quantity": "1",
                "unit": "L",
                "estimated_price": "8.00",
            },
        )
    ).get("id")
    call("PATCH", f"/food/grocery/{grocery_id}", json={"is_purchased": True})
    call("GET", "/food/grocery")
    # No AI key configured locally -> the endpoint must fail cleanly, not 500.
    call(
        "POST",
        "/food/meal-plans/generate",
        expect=503,
        json={"week_start_date": f"{YEAR}-{MONTH:02d}-02"},
    )

    # ── Notifications ────────────────────────────────────────────────────────
    call("GET", "/notifications")
    call("GET", "/notifications/vapid-public-key")
    subscription_id = json_of(
        call(
            "POST",
            "/notifications/push-subscriptions",
            expect=201,
            json={
                "endpoint": "https://example.com/push/smoke",
                "p256dh": "abc",
                "auth": "def",
            },
        )
    ).get("id")
    call("POST", "/notifications/read-all")
    call(
        "DELETE",
        f"/notifications/push-subscriptions/{subscription_id}",
        expect=204,
    )

    # ── AI ───────────────────────────────────────────────────────────────────
    conversation_id = json_of(
        call("POST", "/ai/conversations", expect=201, json={"title": "Smoke chat"})
    ).get("id")
    call("GET", "/ai/conversations")
    call("GET", f"/ai/conversations/{conversation_id}")
    call(
        "POST",
        f"/ai/conversations/{conversation_id}/messages",
        expect=503,
        json={"content": "Hello"},
    )
    call("GET", "/ai/recommendations")
    call(
        "POST",
        "/schedule/proposals",
        expect=503,
        json={"text": "Plan two hours of study", "target_week_start": day},
    )

    # ── Cleanup ──────────────────────────────────────────────────────────────
    call("DELETE", f"/food/grocery/{grocery_id}", expect=204)
    call("DELETE", f"/food/recipes/{recipe_id}", expect=204)
    call("DELETE", f"/schedule/activities/{activity_id}", expect=204)
    call("DELETE", f"/schedule/activities/{overlap_activity_id}", expect=204)
    call("DELETE", f"/goals/{goal_id}", expect=204)
    call("DELETE", f"/finance/expenses/{expense_id}", expect=204)
    call("DELETE", f"/finance/recurring-payments/{payment_id}", expect=204)
    call("DELETE", f"/finance/budgets/{budget_id}", expect=204)
    call("DELETE", f"/ai/conversations/{conversation_id}", expect=204)

    print(f"\n{len(failures)} failure(s)")
    for method, path, status, body in failures:
        print(f"  {method} {path} -> {status}: {body}")
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        sys.exit(2)
