from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock
from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.dependencies.auth import (
    get_current_user,
    get_pending_verification_user,
)
from src.models.auth import User
from src.schemas.auth import PinRequest, RegisterRequest
from src.security.hashing import hash_secret, verify_secret
from src.security.tokens import (
    create_access_token,
    create_pending_verification_token,
    decode_token,
)
from src.services.verification import core


def _req() -> MagicMock:
    """Minimal mock Request with empty cookies (tests use Bearer credentials instead)."""
    r = MagicMock()
    r.cookies = {}
    return r


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def _persist_user(db_session: AsyncSession, **kwargs) -> User:
    """Insert and commit a minimal User row, returning it for token/dependency tests."""
    user = User(id=uuid4(), email=f"dep-{uuid4()}@example.com", password_hash="hash", **kwargs)
    db_session.add(user)
    await db_session.commit()
    return user


# ---------------------------------------------------------------------------
# Stateless verification codes — global engine (app/services/verification/core.py)
# ---------------------------------------------------------------------------


def test_code_has_correct_length():
    code = core.generate_code(uuid4(), core.PURPOSE_ACCOUNT, _utcnow())
    assert len(code) == settings.VERIFICATION_CODE_LENGTH


def test_code_uses_only_charset_chars():
    charset = set(settings.VERIFICATION_CODE_CHARSET)
    code = core.generate_code(uuid4(), core.PURPOSE_ACCOUNT, _utcnow())
    assert all(c in charset for c in code)


def test_code_is_deterministic_for_same_inputs():
    uid, anchor = uuid4(), _utcnow()
    a = core.generate_code(uid, core.PURPOSE_ACCOUNT, anchor)
    b = core.generate_code(uid, core.PURPOSE_ACCOUNT, anchor)
    assert a == b  # recomputable at verify-time — that's what removes the table


def test_code_changes_when_anchor_changes():
    uid, anchor = uuid4(), _utcnow()
    rotated = anchor + timedelta(seconds=1)
    assert core.generate_code(uid, core.PURPOSE_ACCOUNT, anchor) != core.generate_code(
        uid, core.PURPOSE_ACCOUNT, rotated
    )


def test_verify_code_roundtrip_and_purpose_isolation():
    uid, anchor = uuid4(), _utcnow()
    code = core.generate_code(uid, core.PURPOSE_ACCOUNT, anchor)
    assert core.verify_code(uid, core.PURPOSE_ACCOUNT, anchor, code)
    # A code minted for one purpose must not validate against another.
    assert not core.verify_code(uid, core.PURPOSE_PASSWORD_RESET, anchor, code)


def test_is_expired_respects_window():
    anchor = _utcnow()
    within = anchor + timedelta(minutes=settings.VERIFICATION_CODE_EXPIRY_MINUTES - 1)
    past = anchor + timedelta(minutes=settings.VERIFICATION_CODE_EXPIRY_MINUTES + 1)
    assert not core.is_expired(anchor, within)
    assert core.is_expired(anchor, past)


# ---------------------------------------------------------------------------
# Hashing
# ---------------------------------------------------------------------------


async def test_hash_verify_roundtrip():
    hashed = await hash_secret("Password1!")
    assert await verify_secret("Password1!", hashed)


async def test_wrong_secret_does_not_verify():
    hashed = await hash_secret("Password1!")
    assert not await verify_secret("WrongSecret", hashed)


async def test_two_hashes_of_same_secret_differ():
    h1 = await hash_secret("same")
    h2 = await hash_secret("same")
    assert h1 != h2  # bcrypt embeds a unique salt per call


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------


def test_access_token_has_full_scope():
    uid = uuid4()
    payload = decode_token(create_access_token(uid))
    assert payload["scope"] == "full"
    assert payload["sub"] == str(uid)


def test_pending_verification_token_has_verify_scope():
    uid = uuid4()
    payload = decode_token(create_pending_verification_token(uid))
    assert payload["scope"] == "verify"
    assert payload["sub"] == str(uid)


def test_expired_token_raises():
    expired = jwt.encode(
        {"sub": str(uuid4()), "scope": "full", "exp": 1},
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(expired)


def test_tampered_token_raises():
    token = create_access_token(uuid4()) + "x"
    with pytest.raises(jwt.PyJWTError):
        decode_token(token)


# ---------------------------------------------------------------------------
# RegisterRequest — password validation
# ---------------------------------------------------------------------------


def test_register_valid_minimal():
    req = RegisterRequest(email="user@example.com", password="Password123!")
    assert req.family_name is None


def test_register_valid_with_family_name():
    req = RegisterRequest(email="user@example.com", password="Password123!", family_name="Silva")
    assert req.family_name == "Silva"


def test_password_too_short_raises():
    with pytest.raises(ValidationError, match="characters"):
        RegisterRequest(email="u@e.com", password="Ab1!")


def test_password_no_uppercase_raises():
    with pytest.raises(ValidationError, match="uppercase"):
        RegisterRequest(email="u@e.com", password="password123!")


def test_password_no_lowercase_raises():
    with pytest.raises(ValidationError, match="lowercase"):
        RegisterRequest(email="u@e.com", password="PASSWORD123!")


def test_password_no_digit_raises():
    with pytest.raises(ValidationError, match="digit"):
        RegisterRequest(email="u@e.com", password="PasswordNoDigit!")


def test_password_no_special_char_raises():
    with pytest.raises(ValidationError, match="special character"):
        RegisterRequest(email="u@e.com", password="Password1234")


def test_invalid_email_raises():
    with pytest.raises(ValidationError):
        RegisterRequest(email="not-an-email", password="Password1")


# ---------------------------------------------------------------------------
# PinRequest — PIN validation
# ---------------------------------------------------------------------------


def test_pin_valid():
    assert PinRequest(pin="1234").pin == "1234"


def test_pin_too_short_raises():
    with pytest.raises(ValidationError, match="digits"):
        PinRequest(pin="123")


def test_pin_too_long_raises():
    with pytest.raises(ValidationError, match="digits"):
        PinRequest(pin="12345")


def test_pin_non_digit_raises():
    with pytest.raises(ValidationError, match="digits"):
        PinRequest(pin="12a4")


# ---------------------------------------------------------------------------
# Auth dependency — get_current_user
# ---------------------------------------------------------------------------


class _FakeRequest:
    """Minimal stand-in for starlette.requests.Request used by get_current_user."""

    def __init__(self, token: str | None = None):
        self.cookies: dict[str, str] = {"access_token": token} if token else {}


async def test_get_current_user_valid(db_session: AsyncSession):
    user = await _persist_user(db_session, email_verified_at=datetime.now(UTC))

    result = await get_current_user(
        request=_FakeRequest(create_access_token(user.id)), credentials=None, session=db_session
    )
    assert result.id == user.id


async def test_get_current_user_no_cookie_raises():
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request=_FakeRequest(), credentials=None, session=None)  # type: ignore[arg-type]
    assert exc_info.value.status_code == 401


async def test_get_current_user_purged_account_raises(db_session: AsyncSession):
    token = create_access_token(uuid4())  # user does not exist in DB
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request=_FakeRequest(token), credentials=None, session=db_session)
    assert exc_info.value.status_code == 401


async def test_get_current_user_disabled_account_raises(db_session: AsyncSession):
    user = await _persist_user(db_session, is_active=False, email_verified_at=datetime.now(UTC))

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(
            request=_FakeRequest(create_access_token(user.id)), credentials=None, session=db_session
        )
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["error"] == "account_disabled"


async def test_get_current_user_wrong_scope_raises(db_session: AsyncSession):
    # A pending_verification_token (scope=verify) must NOT pass the full-session guard
    token = create_pending_verification_token(uuid4())
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request=_FakeRequest(token), credentials=None, session=db_session)
    assert exc_info.value.status_code == 401


async def test_get_current_user_invalid_token_raises(db_session: AsyncSession):
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(
            request=_FakeRequest("not-a-jwt"), credentials=None, session=db_session
        )
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or expired token"


def _token_without_sub(scope: str) -> str:
    return jwt.encode({"scope": scope}, settings.SECRET_KEY, algorithm="HS256")


def _token_with_invalid_sub(scope: str) -> str:
    return jwt.encode({"sub": "not-a-uuid", "scope": scope}, settings.SECRET_KEY, algorithm="HS256")


async def test_get_current_user_missing_sub_raises(db_session: AsyncSession):
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(
            request=_FakeRequest(_token_without_sub("full")), credentials=None, session=db_session
        )
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid token"


async def test_get_current_user_non_uuid_sub_raises(db_session: AsyncSession):
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(
            request=_FakeRequest(_token_with_invalid_sub("full")),
            credentials=None,
            session=db_session,
        )
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid token"


# ---------------------------------------------------------------------------
# Auth dependency — get_pending_verification_user
# ---------------------------------------------------------------------------


async def test_get_pending_verification_user_valid(db_session: AsyncSession):
    user = await _persist_user(db_session)

    result = await get_pending_verification_user(
        request=_req(),
        credentials=_creds(create_pending_verification_token(user.id)),
        session=db_session,
    )
    assert result.id == user.id


async def test_get_pending_verification_user_no_cookie_raises():
    with pytest.raises(HTTPException) as exc_info:
        await get_pending_verification_user(request=_req(), credentials=None, session=None)  # type: ignore[arg-type]
    assert exc_info.value.status_code == 401


async def test_get_pending_verification_user_invalid_token_raises(db_session: AsyncSession):
    with pytest.raises(HTTPException) as exc_info:
        await get_pending_verification_user(
            request=_req(), credentials=_creds("not-a-jwt"), session=db_session
        )
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or expired token"


async def test_get_pending_verification_user_wrong_scope_raises(db_session: AsyncSession):
    # A full access_token (scope=full) must NOT pass the pending-verification guard
    token = create_access_token(uuid4())
    with pytest.raises(HTTPException) as exc_info:
        await get_pending_verification_user(request=_req(), credentials=_creds(token), session=db_session)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid token scope"


async def test_get_pending_verification_user_purged_account_raises(db_session: AsyncSession):
    token = create_pending_verification_token(uuid4())  # user does not exist in DB
    with pytest.raises(HTTPException) as exc_info:
        await get_pending_verification_user(request=_req(), credentials=_creds(token), session=db_session)
    assert exc_info.value.status_code == 401

