from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from fastapi_mail import MessageSchema, MessageType
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.dependencies.auth import get_current_user, get_pending_verification_user
from app.mail import mail
from app.models.models import EmailVerification, User
from app.schemas.auth import LoginRequest, RegisterRequest, VerifyCodeRequest
from app.security.codes import generate_verification_code
from app.security.hashing import hash_secret, verify_secret
from app.security.tokens import create_access_token, create_pending_verification_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Cookie helpers
# ---------------------------------------------------------------------------


def _set_pending_cookie(response: Response, user_id) -> None:
    response.set_cookie(
        key="pending_verification_token",
        value=create_pending_verification_token(user_id),
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api/v1/auth/verify",
    )


def _set_access_cookie(response: Response, user_id) -> None:
    response.set_cookie(
        key="access_token",
        value=create_access_token(user_id),
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def _clear_pending_cookie(response: Response) -> None:
    response.delete_cookie(key="pending_verification_token", path="/api/v1/auth/verify")


# ---------------------------------------------------------------------------
# Mail helper
# ---------------------------------------------------------------------------


async def _send_verification_email(recipient: str, plaintext_code: str) -> None:
    message = MessageSchema(
        subject="Verify your EarnIt account",
        recipients=[recipient],
        template_body={
            "code": plaintext_code,
            "expiry_minutes": settings.VERIFICATION_CODE_EXPIRY_ACCOUNT_MINUTES,
        },
        subtype=MessageType.html,
    )
    await mail.send_message(message, template_name="verification_code.html")


# ---------------------------------------------------------------------------
# POST /api/v1/auth/register
# ---------------------------------------------------------------------------


@router.post("/register", status_code=201)
async def register(
    body: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    password_hash = await hash_secret(body.password)
    user = User(
        email=str(body.email),
        password_hash=password_hash,
        family_name=body.family_name,
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Email already registered.")

    plaintext_code = generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.VERIFICATION_CODE_EXPIRY_ACCOUNT_MINUTES
    )
    verification = EmailVerification(
        user_id=user.id,
        purpose="account_verification",
        code_hash=await hash_secret(plaintext_code),
        expires_at=expires_at,
    )
    session.add(verification)
    await session.commit()

    await _send_verification_email(user.email, plaintext_code)
    _set_pending_cookie(response, user.id)

    return {
        "status": "pending_verification",
        "message": "Account created. Check your email for a verification code.",
        "user": {
            "id": user.id,
            "email": user.email,
            "family_name": user.family_name,
            "email_verified_at": user.email_verified_at,
            "onboarding_completed": user.onboarding_completed,
        },
        "verification": {"expires_at": expires_at},
    }


# ---------------------------------------------------------------------------
# POST /api/v1/auth/verify
# ---------------------------------------------------------------------------


@router.post("/verify")
async def verify_account(
    body: VerifyCodeRequest,
    response: Response,
    current_user: User = Depends(get_pending_verification_user),
    session: AsyncSession = Depends(get_session),
):
    # Already-verified check comes first so the client gets a clear signal.
    if current_user.email_verified_at is not None:
        raise HTTPException(status_code=409, detail="Account already verified.")

    result = await session.execute(
        select(EmailVerification)
        .where(EmailVerification.user_id == current_user.id)
        .where(EmailVerification.purpose == "account_verification")
        .where(EmailVerification.consumed_at.is_(None))
        .order_by(EmailVerification.created_at.desc())
        .limit(1)
    )
    verification = result.scalar_one_or_none()

    if verification is None:
        raise HTTPException(status_code=400, detail="No active verification code found.")

    now = datetime.now(timezone.utc)
    if verification.expires_at < now:
        raise HTTPException(status_code=410, detail="Verification code has expired.")

    if not await verify_secret(body.code, verification.code_hash):
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    verification.consumed_at = now
    current_user.email_verified_at = now
    current_user.updated_at = now
    await session.commit()

    _clear_pending_cookie(response)
    _set_access_cookie(response, current_user.id)

    return {
        "status": "success",
        "message": "Account verified successfully.",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "family_name": current_user.family_name,
            "email_verified_at": now,
            "onboarding_completed": current_user.onboarding_completed,
        },
    }


# ---------------------------------------------------------------------------
# POST /api/v1/auth/verify/resend
# ---------------------------------------------------------------------------


@router.post("/verify/resend")
async def resend_verification(
    current_user: User = Depends(get_pending_verification_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(EmailVerification)
        .where(EmailVerification.user_id == current_user.id)
        .where(EmailVerification.purpose == "account_verification")
        .where(EmailVerification.consumed_at.is_(None))
        .order_by(EmailVerification.created_at.desc())
        .limit(1)
    )
    existing = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if existing is not None and existing.expires_at > now:
        retry_after = int((existing.expires_at - now).total_seconds())
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "message": (
                    "A verification code is still active. Please wait before requesting another."
                ),
                "retry_after_seconds": retry_after,
            },
        )

    plaintext_code = generate_verification_code()
    expires_at = now + timedelta(minutes=settings.VERIFICATION_CODE_EXPIRY_ACCOUNT_MINUTES)
    session.add(
        EmailVerification(
            user_id=current_user.id,
            purpose="account_verification",
            code_hash=await hash_secret(plaintext_code),
            expires_at=expires_at,
        )
    )
    await session.commit()

    await _send_verification_email(current_user.email, plaintext_code)

    return {
        "status": "success",
        "message": "A new verification code has been sent.",
        "expires_at": expires_at,
    }


# ---------------------------------------------------------------------------
# POST /api/v1/auth/login
# ---------------------------------------------------------------------------


async def _ensure_active_verification_code(user: User, session: AsyncSession) -> datetime:
    """Return the expiry of an active account_verification code, issuing a fresh one if needed."""
    result = await session.execute(
        select(EmailVerification)
        .where(EmailVerification.user_id == user.id)
        .where(EmailVerification.purpose == "account_verification")
        .where(EmailVerification.consumed_at.is_(None))
        .order_by(EmailVerification.created_at.desc())
        .limit(1)
    )
    existing = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if existing is not None and existing.expires_at > now:
        return existing.expires_at

    plaintext_code = generate_verification_code()
    expires_at = now + timedelta(minutes=settings.VERIFICATION_CODE_EXPIRY_ACCOUNT_MINUTES)
    session.add(
        EmailVerification(
            user_id=user.id,
            purpose="account_verification",
            code_hash=await hash_secret(plaintext_code),
            expires_at=expires_at,
        )
    )
    await session.commit()
    await _send_verification_email(user.email, plaintext_code)
    return expires_at


@router.post("/login")
async def login(
    body: LoginRequest, response: Response, session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(User).where(User.email == str(body.email)))
    user = result.scalar_one_or_none()

    if user is None or not await verify_secret(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid login credentials.")

    # is_active is checked before email_verified_at — a disabled-and-unverified
    # account always reports account_disabled, never account_unverified.
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail={"error": "account_disabled", "message": "This account has been disabled."},
        )

    if user.email_verified_at is None:
        expires_at = await _ensure_active_verification_code(user, session)
        unverified_response = JSONResponse(
            status_code=403,
            content={
                "error": "account_unverified",
                "message": "Please verify your account before continuing.",
                "verification": {"expires_at": expires_at.isoformat()},
            },
        )
        _set_pending_cookie(unverified_response, user.id)
        return unverified_response

    _set_access_cookie(response, user.id)
    return {"status": "success", "message": "Authentication successful."}


# ---------------------------------------------------------------------------
# POST /api/v1/auth/logout
# ---------------------------------------------------------------------------


@router.post("/logout")
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    response.delete_cookie(key="access_token", path="/")
    return {"status": "success", "message": "Logged out successfully."}
