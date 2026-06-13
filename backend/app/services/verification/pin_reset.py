"""PIN-reset orchestration (purpose = ``pin_reset``).

Mirrors :mod:`app.services.verification.account` — composing and sending its
email and rotating the shared ``updated_at`` anchor. The cryptographic work is
delegated to :mod:`app.services.verification.core`.
"""

from datetime import datetime

from fastapi_mail import MessageSchema, MessageType
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.mail import mail
from app.models.models import User
from app.services.verification import core

PURPOSE = core.PURPOSE_PIN_RESET


async def _send_code_email(recipient: str, code: str) -> None:
    message = MessageSchema(
        subject="Reset your EarnIt parental PIN",
        recipients=[recipient],
        template_body={"code": code, "expiry_minutes": settings.VERIFICATION_CODE_EXPIRY_MINUTES},
        subtype=MessageType.html,
    )
    await mail.send_message(message, template_name="pin_reset_code.html")


def expires_at(user: User) -> datetime:
    """When the user's current PIN-reset code stops being valid."""
    return core.expires_at(user.updated_at)


def is_window_open(user: User, at: datetime | None = None) -> bool:
    """True while the current code is still live (resend not yet allowed)."""
    return not core.is_expired(user.updated_at, at)


def seconds_until_resend(user: User, at: datetime | None = None) -> int:
    return core.seconds_until_resend(user.updated_at, at)


def verify(user: User, submitted: str) -> bool:
    """Check a submitted code against the user's current anchor (code only)."""
    return core.verify_code(user.id, PURPOSE, user.updated_at, submitted)


async def send_current_code(user: User) -> None:
    """Email the code for the user's *current* anchor (no rotation)."""
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
