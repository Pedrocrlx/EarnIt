"""Global verification-code engine — shared by every purpose.

A code is an HMAC over ``user_id + purpose + anchor`` (the anchor being the
user's ``updated_at``), folded onto the human-friendly charset. Nothing is
persisted: the code is recomputed and compared at verify-time. The math here is
identical for account verification, password reset, and PIN reset — only the
``purpose`` discriminator changes, which is what keeps a code minted for one flow
from validating against another.

This module is purpose-agnostic. Per-purpose orchestration (which email template,
what to pre-check, what to stamp on success) lives in sibling modules such as
``account.py``.
"""

import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.config import settings

PURPOSE_ACCOUNT = "account_verification"
PURPOSE_PASSWORD_RESET = "password_reset"
PURPOSE_PIN_RESET = "pin_reset"


def now() -> datetime:
    """Single UTC clock source, so callers and the engine agree on the instant."""
    return datetime.now(UTC)


def generate_code(user_id: UUID, purpose: str, anchor: datetime) -> str:
    """Derive the deterministic code for ``(user_id, purpose, anchor)``.

    The same three inputs always yield the same code, which is what lets a verify
    endpoint recompute and compare without any stored state. Keyed by SECRET_KEY,
    so a code can't be forged without the server secret.
    """
    message = f"{user_id}:{purpose}:{anchor.isoformat()}".encode()
    digest = hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).digest()
    charset = settings.VERIFICATION_CODE_CHARSET
    return "".join(charset[b % len(charset)] for b in digest[: settings.VERIFICATION_CODE_LENGTH])


def expires_at(anchor: datetime) -> datetime:
    """The instant the code minted at ``anchor`` stops being valid."""
    return anchor + timedelta(minutes=settings.VERIFICATION_CODE_EXPIRY_MINUTES)


def is_expired(anchor: datetime, at: datetime | None = None) -> bool:
    return (at or now()) >= expires_at(anchor)


def seconds_until_resend(anchor: datetime, at: datetime | None = None) -> int:
    """Seconds left on the cooldown before a resend is allowed (0 once expired)."""
    remaining = (expires_at(anchor) - (at or now())).total_seconds()
    return max(0, int(remaining))


def verify_code(user_id: UUID, purpose: str, anchor: datetime, submitted: str) -> bool:
    """Constant-time check of a submitted code against the derived one.

    Input is upper-cased/trimmed first so the (all-upper-case) charset matches
    however the user typed it. Does NOT check expiry — callers run ``is_expired``
    separately so they can return a distinct 410.
    """
    expected = generate_code(user_id, purpose, anchor)
    return hmac.compare_digest(expected, submitted.strip().upper())
