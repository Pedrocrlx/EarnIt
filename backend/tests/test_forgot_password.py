from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import VALID_USER, register_and_verify

_LOGIN_URL = "/api/v1/auth/login"
_FORGOT_URL = "/api/v1/auth/forgot-password"
_RESET_URL = "/api/v1/auth/reset-password"

_NEW_PASSWORD = "NewPassword456!"

_WARP = "UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'"


async def _open_reset_window(
    client: AsyncClient, mock_mail, db_session: AsyncSession
) -> str:
    """Register, verify, expire the account-verification window, request a reset code.

    Returns the reset code from the email so callers don't have to index mock_mail
    themselves.
    """
    await register_and_verify(client, mock_mail)
    await db_session.execute(text(_WARP))
    await db_session.commit()
    await client.post(_FORGOT_URL, json={"email": VALID_USER["email"]})
    return mock_mail[-1].template_body["code"]


# ---------------------------------------------------------------------------
# /forgot-password
# ---------------------------------------------------------------------------


async def test_forgot_password_known_verified_account_returns_200_and_sends_email(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    await register_and_verify(client, mock_mail)
    await db_session.execute(text(_WARP))
    await db_session.commit()

    res = await client.post(_FORGOT_URL, json={"email": VALID_USER["email"]})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"

    assert len(mock_mail) == 2  # registration code + reset code
    assert mock_mail[1].template_body["code"]


async def test_forgot_password_unknown_email_returns_same_response(client: AsyncClient, mock_mail):
    res = await client.post(_FORGOT_URL, json={"email": "nobody@example.com"})
    assert res.status_code == 200
    body = res.json()
    assert body == {
        "status": "success",
        "message": "If that email is registered, a password reset code has been sent.",
    }
    assert len(mock_mail) == 0


async def test_forgot_password_disabled_account_returns_same_response(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    await register_and_verify(client, mock_mail)
    await db_session.execute(text("UPDATE users SET is_active = false"))
    await db_session.commit()

    res = await client.post(_FORGOT_URL, json={"email": VALID_USER["email"]})
    assert res.status_code == 200
    body = res.json()
    assert body == {
        "status": "success",
        "message": "If that email is registered, a password reset code has been sent.",
    }
    # Only the registration email was sent — no reset email for a disabled account.
    assert len(mock_mail) == 1


async def test_forgot_password_rate_limits_within_active_window(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    await register_and_verify(client, mock_mail)
    await db_session.execute(text(_WARP))
    await db_session.commit()

    res1 = await client.post(_FORGOT_URL, json={"email": VALID_USER["email"]})
    assert res1.status_code == 200

    # Window is now open — second request must be rate-limited.
    res2 = await client.post(_FORGOT_URL, json={"email": VALID_USER["email"]})
    assert res2.status_code == 429
    body = res2.json()
    assert "retry_after_seconds" in body
    assert body["retry_after_seconds"] > 0
    assert len(mock_mail) == 2  # registration code + one reset code (not two)


async def test_forgot_password_allows_new_request_after_expiry(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    await _open_reset_window(client, mock_mail, db_session)

    # Expire the reset window, then request another code.
    await db_session.execute(text(_WARP))
    await db_session.commit()

    res = await client.post(_FORGOT_URL, json={"email": VALID_USER["email"]})
    assert res.status_code == 200
    assert len(mock_mail) == 3  # registration + first reset + second reset


# ---------------------------------------------------------------------------
# /reset-password
# ---------------------------------------------------------------------------


async def test_reset_password_correct_code_allows_new_login(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    code = await _open_reset_window(client, mock_mail, db_session)

    res = await client.post(
        _RESET_URL,
        json={"email": VALID_USER["email"], "code": code, "new_password": _NEW_PASSWORD},
    )
    assert res.status_code == 200
    assert res.json() == {"status": "success", "message": "Password has been reset."}

    # Old password no longer works; new password does.
    old_login = await client.post(
        _LOGIN_URL, json={"email": VALID_USER["email"], "password": VALID_USER["password"]}
    )
    assert old_login.status_code == 401

    new_login = await client.post(
        _LOGIN_URL, json={"email": VALID_USER["email"], "password": _NEW_PASSWORD}
    )
    assert new_login.status_code == 200


async def test_reset_password_wrong_code_returns_400(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    await _open_reset_window(client, mock_mail, db_session)

    res = await client.post(
        _RESET_URL,
        json={"email": VALID_USER["email"], "code": "WRONGCOD", "new_password": _NEW_PASSWORD},
    )
    assert res.status_code == 400
    assert res.json() == {"detail": "Invalid or expired code."}


async def test_reset_password_expired_code_returns_400(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    code = await _open_reset_window(client, mock_mail, db_session)

    # Push the anchor past its window.
    await db_session.execute(text(_WARP))
    await db_session.commit()

    res = await client.post(
        _RESET_URL,
        json={"email": VALID_USER["email"], "code": code, "new_password": _NEW_PASSWORD},
    )
    assert res.status_code == 400
    assert res.json() == {"detail": "Invalid or expired code."}


async def test_reset_password_unknown_email_returns_400(client: AsyncClient):
    res = await client.post(
        _RESET_URL,
        json={"email": "nobody@example.com", "code": "WRONGCOD", "new_password": _NEW_PASSWORD},
    )
    assert res.status_code == 400
    assert res.json() == {"detail": "Invalid or expired code."}


async def test_reset_password_code_cannot_be_replayed(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    code = await _open_reset_window(client, mock_mail, db_session)

    payload = {"email": VALID_USER["email"], "code": code, "new_password": _NEW_PASSWORD}

    first = await client.post(_RESET_URL, json=payload)
    assert first.status_code == 200

    # Same code replayed — the anchor was bumped on success, so it must fail.
    second = await client.post(_RESET_URL, json=payload)
    assert second.status_code == 400


async def test_reset_password_weak_password_returns_422(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    code = await _open_reset_window(client, mock_mail, db_session)

    res = await client.post(
        _RESET_URL,
        json={"email": VALID_USER["email"], "code": code, "new_password": "weak"},
    )
    assert res.status_code == 422
