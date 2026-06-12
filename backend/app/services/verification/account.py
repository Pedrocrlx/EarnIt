"""Account-verification orchestration (purpose = ``account_verification``).

Owns everything specific to the registration verification flow: composing and
sending its email, the resend cooldown, and anchor rotation. The cryptographic
work is delegated to :mod:`app.services.verification.core`. Password-reset and
PIN-reset will land as sibling modules with their own templates and pre/post
rules, all leaning on the same core.
"""

from datetime import datetime

from fastapi_mail import MessageSchema, MessageType
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.mail import mail
from app.models.models import User
from app.services.verification import core

PURPOSE = core.PURPOSE_ACCOUNT


async def _send_code_email(recipient: str, code: str) -> None:
    message = MessageSchema(
        subject="Verify your EarnIt account",
        recipients=[recipient],
        template_body={"code": code, "expiry_minutes": settings.VERIFICATION_CODE_EXPIRY_MINUTES},
        subtype=MessageType.html,
    )
    await mail.send_message(message, template_name="verification_code.html")


def expires_at(user: User) -> datetime:
    """When the user's current account-verification code stops being valid."""
    return core.expires_at(user.updated_at)


def is_window_open(user: User, at: datetime | None = None) -> bool:
    """True while the current code is still live (resend not yet allowed)."""
    return not core.is_expired(user.updated_at, at)


def seconds_until_resend(user: User, at: datetime | None = None) -> int:
    return core.seconds_until_resend(user.updated_at, at)


def verify(user: User, submitted: str) -> bool:
    """Check a submitted code against the user's current anchor (code only).

    Expiry is the caller's concern — check ``is_window_open`` first so an expired
    window returns 410 rather than a generic 400.
    """
    return core.verify_code(user.id, PURPOSE, user.updated_at, submitted)


async def send_current_code(user: User) -> None:
    """Email the code for the user's *current* anchor (no rotation).

    Used right after registration, where the anchor is already fresh from row
    creation.
    """
    code = core.generate_code(user.id, PURPOSE, user.updated_at)
    await _send_code_email(user.email, code)


async def rotate(user: User, session: AsyncSession) -> datetime:
    """Open a new code window: bump the anchor to now, persist, return the new
    expiry. The caller emails the code (see ``send_current_code``) — kept separate
    so routers can dispatch the email off the request's critical path.
    """
    user.updated_at = core.now()
    await session.commit()
    return expires_at(user)


async def ensure_active(user: User, session: AsyncSession) -> datetime:
    """Return the current code's expiry, rotating + resending if it has expired.

    Used by the login flow when an unverified ("limbo") account signs in: a live
    code is left untouched (no email spam); an expired one is rotated and resent.
    The email is sent inline here — login is the cold path, not worth backgrounding.
    """
    if is_window_open(user):
        return expires_at(user)
    new_expiry = await rotate(user, session)
    await send_current_code(user)
    return new_expiry
