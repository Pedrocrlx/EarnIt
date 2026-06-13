from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_REGISTER_URL = "/api/v1/auth/register"
_VERIFY_URL = "/api/v1/auth/verify"
_LOGIN_URL = "/api/v1/auth/login"
_FORGOT_URL = "/api/v1/auth/forgot-password"
_FORGOT_VERIFY_URL = "/api/v1/auth/forgot-password/verify"
_RESET_URL = "/api/v1/auth/reset-password"

_VALID = {"email": "user@example.com", "password": "Password123!", "family_name": "Silva"}
_NEW_PASSWORD = "NewPassword456!"


def _cookie(response, name: str) -> str:
    return response.cookies.get(name) or (
        next(
            (
                part.split("=", 1)[1].split(";")[0]
                for part in response.headers.get("set-cookie", "").split(",")
                if f"{name}=" in part
            ),
            None,
        )
    )


async def _register_and_verify(client: AsyncClient, mock_mail) -> None:
    reg = await client.post(_REGISTER_URL, json=_VALID)
    token = _cookie(reg, "pending_verification_token")
    code = mock_mail[0].template_body["code"]
    await client.post(
        _VERIFY_URL,
        json={"code": code},
        cookies={"pending_verification_token": token},
    )


# ---------------------------------------------------------------------------
# /forgot-password
# ---------------------------------------------------------------------------


async def test_forgot_password_known_verified_account_returns_200_and_sends_email(
    client: AsyncClient, mock_mail
):
    await _register_and_verify(client, mock_mail)

    res = await client.post(_FORGOT_URL, json={"email": _VALID["email"]})
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
    await _register_and_verify(client, mock_mail)
    await db_session.execute(text("UPDATE users SET is_active = false"))
    await db_session.commit()

    res = await client.post(_FORGOT_URL, json={"email": _VALID["email"]})
    assert res.status_code == 200
    body = res.json()
    assert body == {
        "status": "success",
        "message": "If that email is registered, a password reset code has been sent.",
    }
    # Only the registration email was sent — no reset email for a disabled account.
    assert len(mock_mail) == 1


# ---------------------------------------------------------------------------
# /forgot-password/verify
# ---------------------------------------------------------------------------


async def test_forgot_password_verify_correct_code_sets_cookie(client: AsyncClient, mock_mail):
    await _register_and_verify(client, mock_mail)
    await client.post(_FORGOT_URL, json={"email": _VALID["email"]})
    code = mock_mail[1].template_body["code"]

    res = await client.post(_FORGOT_VERIFY_URL, json={"email": _VALID["email"], "code": code})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert _cookie(res, "password_reset_token") is not None


async def test_forgot_password_verify_wrong_code_returns_400(client: AsyncClient, mock_mail):
    await _register_and_verify(client, mock_mail)
    await client.post(_FORGOT_URL, json={"email": _VALID["email"]})

    res = await client.post(_FORGOT_VERIFY_URL, json={"email": _VALID["email"], "code": "WRONGCOD"})
    assert res.status_code == 400
    assert res.json() == {"detail": "Invalid or expired code."}


async def test_forgot_password_verify_expired_code_returns_400(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    await _register_and_verify(client, mock_mail)
    await client.post(_FORGOT_URL, json={"email": _VALID["email"]})
    code = mock_mail[1].template_body["code"]

    await db_session.execute(text("UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'"))
    await db_session.commit()

    res = await client.post(_FORGOT_VERIFY_URL, json={"email": _VALID["email"], "code": code})
    assert res.status_code == 400
    assert res.json() == {"detail": "Invalid or expired code."}


async def test_forgot_password_verify_unknown_email_returns_400(client: AsyncClient, mock_mail):
    res = await client.post(
        _FORGOT_VERIFY_URL, json={"email": "nobody@example.com", "code": "WRONGCOD"}
    )
    assert res.status_code == 400
    assert res.json() == {"detail": "Invalid or expired code."}


# ---------------------------------------------------------------------------
# /reset-password
# ---------------------------------------------------------------------------


async def test_reset_password_with_valid_cookie_allows_new_login(client: AsyncClient, mock_mail):
    await _register_and_verify(client, mock_mail)
    await client.post(_FORGOT_URL, json={"email": _VALID["email"]})
    code = mock_mail[1].template_body["code"]

    verify_res = await client.post(
        _FORGOT_VERIFY_URL, json={"email": _VALID["email"], "code": code}
    )
    reset_token = _cookie(verify_res, "password_reset_token")

    res = await client.post(
        _RESET_URL,
        json={"new_password": _NEW_PASSWORD},
        cookies={"password_reset_token": reset_token},
    )
    assert res.status_code == 200
    assert res.json() == {"status": "success", "message": "Password has been reset."}

    # Old password no longer works; new password does.
    old_login = await client.post(
        _LOGIN_URL, json={"email": _VALID["email"], "password": _VALID["password"]}
    )
    assert old_login.status_code == 401

    new_login = await client.post(
        _LOGIN_URL, json={"email": _VALID["email"], "password": _NEW_PASSWORD}
    )
    assert new_login.status_code == 200


async def test_reset_password_without_cookie_returns_401(client: AsyncClient):
    res = await client.post(_RESET_URL, json={"new_password": _NEW_PASSWORD})
    assert res.status_code == 401


async def test_reset_password_weak_password_returns_422(client: AsyncClient, mock_mail):
    await _register_and_verify(client, mock_mail)
    await client.post(_FORGOT_URL, json={"email": _VALID["email"]})
    code = mock_mail[1].template_body["code"]

    verify_res = await client.post(
        _FORGOT_VERIFY_URL, json={"email": _VALID["email"], "code": code}
    )
    reset_token = _cookie(verify_res, "password_reset_token")

    res = await client.post(
        _RESET_URL,
        json={"new_password": "weak"},
        cookies={"password_reset_token": reset_token},
    )
    assert res.status_code == 422
