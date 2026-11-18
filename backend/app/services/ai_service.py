"""
AI provider abstraction.

Only the configured provider is imported lazily, so the app starts even when
an optional SDK or API key is absent. Callers receive a clear exception they
can translate into an HTTP response.
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.config import settings


class AIConfigurationError(RuntimeError):
    """The selected provider is not configured (missing key/SDK)."""


class AIProviderError(RuntimeError):
    """The provider call failed or returned unusable output."""


def is_ai_configured() -> bool:
    """Return True when the selected provider has the credentials it needs."""
    provider = settings.ai_provider
    if provider == "openai":
        return bool(settings.openai_api_key)
    if provider == "anthropic":
        return bool(settings.anthropic_api_key)
    if provider == "gemini":
        return bool(settings.google_api_key)
    return False


async def chat_completion(
    messages: list[dict[str, str]],
    *,
    system: str | None = None,
    max_tokens: int | None = None,
    temperature: float = 0.3,
) -> tuple[str, str]:
    """
    Send a chat completion and return ``(text, model_name)``.

    ``messages`` must contain ``{"role": "user"|"assistant", "content": str}``.
    """
    provider = settings.ai_provider
    limit = max_tokens or settings.ai_max_tokens

    if provider == "openai":
        return await _openai_chat(messages, system, limit, temperature)
    if provider == "anthropic":
        return await _anthropic_chat(messages, system, limit, temperature)
    if provider == "gemini":
        raise AIConfigurationError(
            "Gemini support is not installed. Use AI_PROVIDER=openai or anthropic."
        )
    raise AIConfigurationError(f"Unknown AI provider: {provider!r}")


async def _openai_chat(
    messages: list[dict[str, str]],
    system: str | None,
    max_tokens: int,
    temperature: float,
) -> tuple[str, str]:
    if not settings.openai_api_key:
        raise AIConfigurationError("OPENAI_API_KEY is not set.")

    try:
        from openai import AsyncOpenAI
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise AIConfigurationError("The openai package is not installed.") from exc

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    payload: list[dict[str, str]] = []
    if system:
        payload.append({"role": "system", "content": system})
    payload.extend(messages)

    try:
        response = await client.chat.completions.create(
            model=settings.ai_model_openai,
            messages=payload,  # type: ignore[arg-type]
            max_tokens=max_tokens,
            temperature=temperature,
        )
    except Exception as exc:
        raise AIProviderError(f"OpenAI request failed: {exc}") from exc

    text = response.choices[0].message.content or ""
    return text, settings.ai_model_openai


async def _anthropic_chat(
    messages: list[dict[str, str]],
    system: str | None,
    max_tokens: int,
    temperature: float,
) -> tuple[str, str]:
    if not settings.anthropic_api_key:
        raise AIConfigurationError("ANTHROPIC_API_KEY is not set.")

    try:
        from anthropic import AsyncAnthropic
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise AIConfigurationError("The anthropic package is not installed.") from exc

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    kwargs: dict[str, Any] = {
        "model": settings.ai_model_anthropic,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if system:
        kwargs["system"] = system

    try:
        response = await client.messages.create(**kwargs)
    except Exception as exc:
        raise AIProviderError(f"Anthropic request failed: {exc}") from exc

    text = "".join(
        block.text for block in response.content if getattr(block, "type", "") == "text"
    )
    return text, settings.ai_model_anthropic


_JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def extract_json(text: str) -> Any:
    """
    Parse a JSON object/array out of model output.

    Handles fenced code blocks and leading/trailing prose.
    """
    candidate = text.strip()
    fenced = _JSON_FENCE.search(candidate)
    if fenced:
        candidate = fenced.group(1).strip()

    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # Fall back to the first balanced object/array in the string.
    for opener, closer in (("{", "}"), ("[", "]")):
        start = candidate.find(opener)
        end = candidate.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(candidate[start : end + 1])
            except json.JSONDecodeError:
                continue

    raise AIProviderError("The AI response did not contain valid JSON.")
