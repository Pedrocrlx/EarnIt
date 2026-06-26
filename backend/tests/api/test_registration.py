import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import VALID_USER, extract_cookie

_REGISTER_URL = "/api/v1/auth/register"
_VERIFY_URL = "/api/v1/auth/verify"
_RESEND_URL = "/api/v1/auth/verify/resend"

# Registration


async def test_register_valid_returns_201_and_sets_cookie(
    client: AsyncClient, mock_mail
):
    res = await client.post(_REGISTER_URL, json=VALID_USER)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending_verification"
    assert body["user"]["email"] == VALID_USER["email"]
    assert body["user"]["email_verified_at"] is None
    assert body["verification"]["expires_at"] is not None
    # Cookie must be present
    assert extract_cookie(res, "pending_verification_token") is not None
    # Exactly one email was dispatched
    assert len(mock_mail) == 1
    assert mock_mail[0].template_body["code"]


async def test_register_duplicate_email_active_returns_409(
    client: AsyncClient, mock_mail
):
    # First registration + verification → active account
    res = await client.post(_REGISTER_URL, json=VALID_USER)
    token = extract_cookie(res, "pending_verification_token")
    code = mock_mail[0].template_body["code"]
    await client.post(
        _VERIFY_URL,
        json={"code": code},
        cookies={"pending_verification_token": token},
    )
    # Second registration with same email
    res2 = await client.post(_REGISTER_URL, json=VALID_USER)
    assert res2.status_code == 409


async def test_register_duplicate_email_limbo_returns_409(
    client: AsyncClient, mock_mail
):
    # First registration left unverified
    await client.post(_REGISTER_URL, json=VALID_USER)
    # Attempt to register same email again
    res = await client.post(_REGISTER_URL, json=VALID_USER)
    assert res.status_code == 409


# Verification


async def test_verify_correct_code_returns_200_and_swaps_cookies(
    client: AsyncClient, mock_mail
):
    reg = await client.post(_REGISTER_URL, json=VALID_USER)
    token = extract_cookie(reg, "pending_verification_token")
    code = mock_mail[0].template_body["code"]

    res = await client.post(
        _VERIFY_URL,
        json={"code": code},
        cookies={"pending_verification_token": token},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["user"]["email_verified_at"] is not None
    # Full session cookie must be present; pending cookie must be cleared
    assert "access_token" in res.cookies or "access_token" in res.headers.get(
        "set-cookie", ""
    )


async def test_verify_wrong_code_returns_400(client: AsyncClient, mock_mail):
    reg = await client.post(_REGISTER_URL, json=VALID_USER)
    token = extract_cookie(reg, "pending_verification_token")

    res = await client.post(
        _VERIFY_URL,
        json={"code": "WRONGCOD"},
        cookies={"pending_verification_token": token},
    )
    assert res.status_code == 400


async def test_verify_expired_code_returns_410(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    reg = await client.post(_REGISTER_URL, json=VALID_USER)
    token = extract_cookie(reg, "pending_verification_token")
    code = mock_mail[0].template_body["code"]

    # The code's anchor is users.updated_at — pushing it past the 10-min window
    # makes the derived code expire (no email_verifications row to touch anymore).
    await db_session.execute(
        text("UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'")
    )
    await db_session.commit()

    res = await client.post(
        _VERIFY_URL,
        json={"code": code},
        cookies={"pending_verification_token": token},
    )
    assert res.status_code == 410


async def test_verify_already_verified_returns_409(client: AsyncClient, mock_mail):
    reg = await client.post(_REGISTER_URL, json=VALID_USER)
    token = extract_cookie(reg, "pending_verification_token")
    code = mock_mail[0].template_body["code"]

    # Successful verification
    await client.post(
        _VERIFY_URL,
        json={"code": code},
        cookies={"pending_verification_token": token},
    )

    # Attempt to verify again with the original pending token (still a valid JWT)
    res = await client.post(
        _VERIFY_URL,
        json={"code": code},
        cookies={"pending_verification_token": token},
    )
    assert res.status_code == 409


# Resend


async def test_resend_before_expiry_returns_429_with_retry_after(
    client: AsyncClient, mock_mail
):
    await client.post(_REGISTER_URL, json=VALID_USER)
    # Code is still active — grab the pending token from the registration response
    reg = await client.post(
        _REGISTER_URL, json={**VALID_USER, "email": "other@example.com"}
    )
    token = extract_cookie(reg, "pending_verification_token")

    res = await client.post(
        _RESEND_URL,
        cookies={"pending_verification_token": token},
    )
    assert res.status_code == 429
    body = res.json()
    assert "retry_after_seconds" in body
    assert body["retry_after_seconds"] > 0


async def test_resend_after_expiry_returns_200_with_new_expires_at(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    reg = await client.post(_REGISTER_URL, json=VALID_USER)
    token = extract_cookie(reg, "pending_verification_token")

    # Expire the active window by pushing the anchor (users.updated_at) into the past.
    await db_session.execute(
        text("UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'")
    )
    await db_session.commit()

    res = await client.post(
        _RESEND_URL,
        cookies={"pending_verification_token": token},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["expires_at"] is not None
    # A second email must have been sent
    assert len(mock_mail) == 2


@pytest.mark.parametrize(
    "payload,field",
    [
        ({"email": "bad-email", "password": "Password123!"}, "email"),
        ({"email": "u@e.com", "password": "short"}, "password"),
        ({"email": "u@e.com", "password": "nouppercase1"}, "password"),
        ({"email": "u@e.com", "password": "NODIGIT"}, "password"),
    ],
)
async def test_register_invalid_input_returns_422(
    client: AsyncClient, payload: dict, field: str
):
    res = await client.post(_REGISTER_URL, json=payload)
    assert res.status_code == 422
