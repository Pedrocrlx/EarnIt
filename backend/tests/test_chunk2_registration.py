import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_REGISTER_URL = "/api/v1/auth/register"
_VERIFY_URL = "/api/v1/auth/verify"
_RESEND_URL = "/api/v1/auth/verify/resend"

_VALID = {"email": "user@example.com", "password": "Password1", "family_name": "Silva"}


def _pending_cookie(response) -> str:
    """Extract pending_verification_token value from a register response."""
    return response.cookies.get("pending_verification_token") or (
        # fallback: parse Set-Cookie header directly
        next(
            (
                part.split("=", 1)[1].split(";")[0]
                for part in response.headers.get("set-cookie", "").split(",")
                if "pending_verification_token=" in part
            ),
            None,
        )
    )


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


async def test_register_valid_returns_201_and_sets_cookie(client: AsyncClient, mock_mail):
    res = await client.post(_REGISTER_URL, json=_VALID)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending_verification"
    assert body["user"]["email"] == _VALID["email"]
    assert body["user"]["email_verified_at"] is None
    assert body["verification"]["expires_at"] is not None
    # Cookie must be present
    assert _pending_cookie(res) is not None
    # Exactly one email was dispatched
    assert len(mock_mail) == 1
    assert mock_mail[0].template_body["code"]


async def test_register_duplicate_email_active_returns_409(client: AsyncClient, mock_mail):
    # First registration + verification → active account
    res = await client.post(_REGISTER_URL, json=_VALID)
    token = _pending_cookie(res)
    code = mock_mail[0].template_body["code"]
    await client.post(
        _VERIFY_URL,
        json={"code": code},
        cookies={"pending_verification_token": token},
    )
    # Second registration with same email
    res2 = await client.post(_REGISTER_URL, json=_VALID)
    assert res2.status_code == 409


async def test_register_duplicate_email_limbo_returns_409(client: AsyncClient, mock_mail):
    # First registration left unverified
    await client.post(_REGISTER_URL, json=_VALID)
    # Attempt to register same email again
    res = await client.post(_REGISTER_URL, json=_VALID)
    assert res.status_code == 409


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------


async def test_verify_correct_code_returns_200_and_swaps_cookies(client: AsyncClient, mock_mail):
    reg = await client.post(_REGISTER_URL, json=_VALID)
    token = _pending_cookie(reg)
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
    assert "access_token" in res.cookies or "access_token" in res.headers.get("set-cookie", "")


async def test_verify_wrong_code_returns_400(client: AsyncClient, mock_mail):
    reg = await client.post(_REGISTER_URL, json=_VALID)
    token = _pending_cookie(reg)

    res = await client.post(
        _VERIFY_URL,
        json={"code": "WRONGCOD"},
        cookies={"pending_verification_token": token},
    )
    assert res.status_code == 400


async def test_verify_expired_code_returns_410(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    reg = await client.post(_REGISTER_URL, json=_VALID)
    token = _pending_cookie(reg)
    code = mock_mail[0].template_body["code"]

    # Push expires_at into the past
    await db_session.execute(
        text("UPDATE email_verifications SET expires_at = NOW() - INTERVAL '1 minute'")
    )
    await db_session.commit()

    res = await client.post(
        _VERIFY_URL,
        json={"code": code},
        cookies={"pending_verification_token": token},
    )
    assert res.status_code == 410


async def test_verify_already_verified_returns_409(client: AsyncClient, mock_mail):
    reg = await client.post(_REGISTER_URL, json=_VALID)
    token = _pending_cookie(reg)
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


async def test_verify_consumed_code_replay_returns_400(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    reg = await client.post(_REGISTER_URL, json=_VALID)
    token = _pending_cookie(reg)
    code = mock_mail[0].template_body["code"]

    # Mark the code as consumed without stamping email_verified_at (artificial state)
    await db_session.execute(
        text("UPDATE email_verifications SET consumed_at = NOW() WHERE consumed_at IS NULL")
    )
    await db_session.commit()

    res = await client.post(
        _VERIFY_URL,
        json={"code": code},
        cookies={"pending_verification_token": token},
    )
    # No active code found → 400
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Resend
# ---------------------------------------------------------------------------


async def test_resend_before_expiry_returns_429_with_retry_after(client: AsyncClient, mock_mail):
    await client.post(_REGISTER_URL, json=_VALID)
    # Code is still active — grab the pending token from the registration response
    reg = await client.post(_REGISTER_URL, json={**_VALID, "email": "other@example.com"})
    token = _pending_cookie(reg)

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
    reg = await client.post(_REGISTER_URL, json=_VALID)
    token = _pending_cookie(reg)

    # Expire the existing code
    await db_session.execute(
        text("UPDATE email_verifications SET expires_at = NOW() - INTERVAL '1 minute'")
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
        ({"email": "bad-email", "password": "Password1"}, "email"),
        ({"email": "u@e.com", "password": "short"}, "password"),
        ({"email": "u@e.com", "password": "nouppercase1"}, "password"),
        ({"email": "u@e.com", "password": "NODIGIT"}, "password"),
    ],
)
async def test_register_invalid_input_returns_422(client: AsyncClient, payload: dict, field: str):
    res = await client.post(_REGISTER_URL, json=payload)
    assert res.status_code == 422
