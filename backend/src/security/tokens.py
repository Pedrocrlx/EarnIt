"""JWT minting and decoding — the two session token flavours.

Tokens are signed HS256 with ``SECRET_KEY`` and carry a ``scope`` claim: a
``full`` access token for authenticated sessions and a short-lived ``verify``
token for the email-verification step. Dependencies in
``src.dependencies.auth`` decode these and enforce the expected scope.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt

from src.core.config import settings

_ALGORITHM = "HS256"


def create_access_token(user_id: UUID) -> str:
    """Mint a full-session token for an authenticated user."""
    return _make_token(user_id, "full", settings.ACCESS_TOKEN_EXPIRE_MINUTES)


def create_pending_verification_token(user_id: UUID) -> str:
    """Mint a short-lived token that only authorises the verify/resend step."""
    return _make_token(
        user_id, "verify", settings.PENDING_VERIFICATION_TOKEN_EXPIRE_MINUTES
    )


def decode_token(token: str) -> dict:
    """Decode and verify a JWT.

    Raises jwt.PyJWTError on any failure (invalid or expired).
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[_ALGORITHM])


def _make_token(user_id: UUID, scope: str, expire_minutes: int) -> str:
    """Build and sign a JWT carrying the user id, scope, and expiry."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "scope": scope,
        "exp": now + timedelta(minutes=expire_minutes),
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=_ALGORITHM)
