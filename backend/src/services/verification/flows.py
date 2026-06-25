"""Per-purpose verification orchestration — one helper set, parameterised by purpose.

The cryptographic work lives in :mod:`src.services.verification.core`; this module
adds the user-facing layer (anchor = ``user.updated_at``) and the email per flow.
Account verification, password reset, and PIN reset differ only by the ``purpose``
discriminator and the email subject/template in ``_EMAILS`` — so they share code.
"""

from datetime import datetime

from fastapi_mail import MessageSchema, MessageType
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.mail import mail
from src.models.auth import User
from src.services.verification import core

# purpose -> (email subject, template filename in src/email/)
_EMAILS = {
    core.PURPOSE_ACCOUNT: ("Verifique a sua conta EarnIt", "verification_code.html"),
    core.PURPOSE_PASSWORD_RESET: (
        "Redefinir a sua palavra-passe EarnIt",
        "password_reset_code.html",
    ),
    core.PURPOSE_PIN_RESET: (
        "Redefinir o seu PIN parental EarnIt",
        "pin_reset_code.html",
    ),
}


def expires_at(user: User) -> datetime:
    """When the user's current code stops being valid."""
    return core.expires_at(user.updated_at)


def is_window_open(user: User, at: datetime | None = None) -> bool:
    """True while the current code is still live (resend not yet allowed)."""
    return not core.is_expired(user.updated_at, at)


def seconds_until_resend(user: User, at: datetime | None = None) -> int:
    return core.seconds_until_resend(user.updated_at, at)


def verify(user: User, purpose: str, submitted: str) -> bool:
    """Check a submitted code against the user's current anchor (code only).

    Expiry is the caller's concern — check ``is_window_open`` first so an expired
    window returns 410 rather than a generic 400.
    """
    return core.verify_code(user.id, purpose, user.updated_at, submitted)


async def send_code(user: User, purpose: str) -> None:
    """Email the code for the user's *current* anchor (no rotation)."""
    subject, template = _EMAILS[purpose]
    code = core.generate_code(user.id, purpose, user.updated_at)
    message = MessageSchema(
        subject=subject,
        recipients=[user.email],
        template_body={
            "code": code,
            "expiry_minutes": settings.VERIFICATION_CODE_EXPIRY_MINUTES,
        },
        subtype=MessageType.html,
    )
    await mail.send_message(message, template_name=template)


async def rotate(user: User, session: AsyncSession) -> datetime:
    """Open a new code window: bump the anchor to now, persist, return the new
    expiry. The caller emails the code (see ``send_code``) — kept separate so
    routers can dispatch the email off the request's critical path.
    """
    user.updated_at = core.now()
    await session.commit()
    return expires_at(user)


async def ensure_active(user: User, session: AsyncSession, purpose: str) -> datetime:
    """Return the current code's expiry, rotating + resending if it has expired.

    Used by the login flow when an unverified ("limbo") account signs in: a live
    code is left untouched (no email spam); an expired one is rotated and resent.
    The email is sent inline here — login is the cold path, not worth backgrounding.
    """
    if is_window_open(user):
        return expires_at(user)
    new_expiry = await rotate(user, session)
    await send_code(user, purpose)
    return new_expiry
