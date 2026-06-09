from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt

from app.config import settings

_ALGORITHM = "HS256"


def create_access_token(user_id: UUID) -> str:
    return _make_token(user_id, "full", settings.ACCESS_TOKEN_EXPIRE_MINUTES)


def create_pending_verification_token(user_id: UUID) -> str:
    return _make_token(user_id, "verify", settings.PENDING_VERIFICATION_TOKEN_EXPIRE_MINUTES)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises jwt.PyJWTError on any failure (invalid or expired)."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[_ALGORITHM])


def _make_token(user_id: UUID, scope: str, expire_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "scope": scope,
        "exp": now + timedelta(minutes=expire_minutes),
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=_ALGORITHM)
