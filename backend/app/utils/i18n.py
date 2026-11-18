"""
Localized reminder copy.

Reminder titles/bodies are rendered once at schedule time and stored on the
Notification row, so delivery never needs a translation lookup.
"""

from __future__ import annotations

_TEMPLATES: dict[str, dict[int, tuple[str, str]]] = {
    "en": {
        0: ("Starting now", "Your activity \u201c{title}\u201d starts now."),
        5: ("In 5 minutes", "\u201c{title}\u201d starts in 5 minutes."),
        15: ("In 15 minutes", "\u201c{title}\u201d starts in 15 minutes."),
        30: ("In 30 minutes", "\u201c{title}\u201d starts in 30 minutes."),
        60: ("In 1 hour", "\u201c{title}\u201d starts in 1 hour."),
    },
    "fr": {
        0: (
            "C'est maintenant",
            "Votre activit\u00e9 \u00ab\u00a0{title}\u00a0\u00bb commence maintenant.",
        ),
        5: ("Dans 5 minutes", "\u00ab\u00a0{title}\u00a0\u00bb commence dans 5 minutes."),
        15: ("Dans 15 minutes", "\u00ab\u00a0{title}\u00a0\u00bb commence dans 15 minutes."),
        30: ("Dans 30 minutes", "\u00ab\u00a0{title}\u00a0\u00bb commence dans 30 minutes."),
        60: ("Dans 1 heure", "\u00ab\u00a0{title}\u00a0\u00bb commence dans 1 heure."),
    },
}

_FALLBACK: dict[str, tuple[str, str]] = {
    "en": ("Upcoming activity", "\u201c{title}\u201d starts in {minutes} minutes."),
    "fr": (
        "Activit\u00e9 \u00e0 venir",
        "\u00ab\u00a0{title}\u00a0\u00bb commence dans {minutes} minutes.",
    ),
}


def get_reminder_message(
    activity_title: str,
    minutes_before: int,
    language: str = "en",
) -> tuple[str, str]:
    """Return a ``(title, body)`` tuple for a reminder lead time."""
    lang = "fr" if str(language).lower().startswith("fr") else "en"
    template = _TEMPLATES[lang].get(minutes_before)
    if template is None:
        title, body = _FALLBACK[lang]
        return title, body.format(title=activity_title, minutes=minutes_before)
    title, body = template
    return title, body.format(title=activity_title)
