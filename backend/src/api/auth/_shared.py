"""Cookie helpers shared across the /api/v1/auth/* endpoints.

Verification emails are owned by the per-purpose verification service
(app/services/verification/), not here.
"""

from fastapi import Response

from src.security.tokens import (
    create_access_token,
    create_password_reset_token,
    create_pending_verification_token,
)


def set_pending_cookie(response: Response, user_id) -> None:
    response.set_cookie(
        key="pending_verification_token",
        value=create_pending_verification_token(user_id),
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api/v1/auth/verify",
    )


def set_access_cookie(response: Response, user_id) -> None:
    response.set_cookie(
        key="access_token",
        value=create_access_token(user_id),
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def clear_pending_cookie(response: Response) -> None:
    response.delete_cookie(key="pending_verification_token", path="/api/v1/auth/verify")


def set_password_reset_cookie(response: Response, user_id) -> None:
    response.set_cookie(
        key="password_reset_token",
        value=create_password_reset_token(user_id),
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api/v1/auth/reset-password",
    )


def clear_password_reset_cookie(response: Response) -> None:
    response.delete_cookie(key="password_reset_token", path="/api/v1/auth/reset-password")
