from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_REGISTER_URL = "/api/v1/auth/register"
_VERIFY_URL = "/api/v1/auth/verify"
_LOGIN_URL = "/api/v1/auth/login"
_LOGOUT_URL = "/api/v1/auth/logout"

_VALID = {"email": "user@example.com", "password": "Password123!", "family_name": "Silva"}


def _cookie(response, name: str) -> str | None:
    """Extract a cookie value from a response, falling back to parsing Set-Cookie."""
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


async def _register_and_verify(
    client: AsyncClient, mock_mail, email: str = _VALID["email"]
) -> dict:
    payload = {**_VALID, "email": email}
    reg = await client.post(_REGISTER_URL, json=payload)
    token = _cookie(reg, "pending_verification_token")
    code = mock_mail[-1].template_body["code"]
    await client.post(
        _VERIFY_URL, json={"code": code}, cookies={"pending_verification_token": token}
    )
    return payload


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


async def test_login_wrong_password_returns_401(client: AsyncClient, mock_mail):
    # Account exists and is verified, but the password doesn't match the stored hash.
    await _register_and_verify(client, mock_mail)

    res = await client.post(_LOGIN_URL, json={"email": _VALID["email"], "password": "WrongPass1"})
    assert res.status_code == 401


async def test_login_disabled_account_returns_403_account_disabled(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    # Credentials are correct, but is_active=false. This must short-circuit before
    # the email_verified_at check (see check-ordering note in auth.py login()).
    await _register_and_verify(client, mock_mail)
    await db_session.execute(text("UPDATE users SET is_active = false"))
    await db_session.commit()

    res = await client.post(
        _LOGIN_URL, json={"email": _VALID["email"], "password": _VALID["password"]}
    )
    assert res.status_code == 403
    body = res.json()
    assert body["error"] == "account_disabled"


async def test_login_unverified_account_returns_403_with_fresh_pending_cookie(
    client: AsyncClient, mock_mail
):
    # Register but skip /verify — account stays in "limbo" (email_verified_at IS NULL).
    # Login with correct credentials should reject the full session and instead
    # re-issue a pending_verification_token cookie + verification.expires_at.
    await client.post(_REGISTER_URL, json=_VALID)

    res = await client.post(
        _LOGIN_URL, json={"email": _VALID["email"], "password": _VALID["password"]}
    )
    assert res.status_code == 403
    body = res.json()
    assert body["error"] == "account_unverified"
    assert body["verification"]["expires_at"] is not None
    assert _cookie(res, "pending_verification_token") is not None


async def test_login_verified_account_returns_200_and_access_token(client: AsyncClient, mock_mail):
    # The "happy path": correct credentials + verified account → full session cookie.
    await _register_and_verify(client, mock_mail)

    res = await client.post(
        _LOGIN_URL, json={"email": _VALID["email"], "password": _VALID["password"]}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert _cookie(res, "access_token") is not None


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


async def test_logout_with_valid_session_returns_200_and_clears_cookie(
    client: AsyncClient, mock_mail
):
    # Standard logout: a valid access_token cookie should be accepted, then
    # cleared via Set-Cookie ...; Max-Age=0 (delete_cookie's signature).
    await _register_and_verify(client, mock_mail)
    login_res = await client.post(
        _LOGIN_URL, json={"email": _VALID["email"], "password": _VALID["password"]}
    )
    access_token = _cookie(login_res, "access_token")

    res = await client.post(_LOGOUT_URL, cookies={"access_token": access_token})
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert "access_token=;" in res.headers.get("set-cookie", "") or "Max-Age=0" in res.headers.get(
        "set-cookie", ""
    )


async def test_logout_without_session_returns_401(client: AsyncClient):
    # No access_token cookie at all — get_current_user rejects before the
    # logout handler body ever runs.
    res = await client.post(_LOGOUT_URL)
    assert res.status_code == 401


async def test_logout_with_purged_user_returns_401(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    # Token is structurally valid (correct signature, scope=full, not expired),
    # but the user row it points to no longer exists — e.g. purged from limbo.
    # get_current_user does session.get(User, user_id) -> None -> 401.
    await _register_and_verify(client, mock_mail)
    login_res = await client.post(
        _LOGIN_URL, json={"email": _VALID["email"], "password": _VALID["password"]}
    )
    access_token = _cookie(login_res, "access_token")

    await db_session.execute(text("DELETE FROM users"))
    await db_session.commit()

    res = await client.post(_LOGOUT_URL, cookies={"access_token": access_token})
    assert res.status_code == 401


async def test_logout_with_disabled_account_returns_403_account_disabled(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    # Token is valid and the user still exists, but is_active was flipped to
    # false after the session was issued — get_current_user must catch this
    # on every authenticated request, not just at login time.
    await _register_and_verify(client, mock_mail)
    login_res = await client.post(
        _LOGIN_URL, json={"email": _VALID["email"], "password": _VALID["password"]}
    )
    access_token = _cookie(login_res, "access_token")

    await db_session.execute(text("UPDATE users SET is_active = false"))
    await db_session.commit()

    res = await client.post(_LOGOUT_URL, cookies={"access_token": access_token})
    assert res.status_code == 403
    assert res.json()["error"] == "account_disabled"
