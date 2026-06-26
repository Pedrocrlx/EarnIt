from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import VALID_USER, register_and_verify

_PIN_URL = "/api/v1/auth/pin"
_VERIFY_PIN_URL = "/api/v1/auth/verify-pin"
_FORGOT_PIN_URL = "/api/v1/auth/forgot-pin"
_RESET_PIN_URL = "/api/v1/auth/reset-pin"
_RESET_PIN_VERIFY_URL = "/api/v1/auth/reset-pin/verify"

_PIN = "1234"
_NEW_PIN = "5678"

# pin


async def test_set_pin_with_no_prior_pin_returns_200(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    access_token = await register_and_verify(client, mock_mail)

    res = await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )
    assert res.status_code == 200
    assert res.json() == {
        "status": "success",
        "message": "Parental security PIN established.",
    }

    result = await db_session.execute(
        text("SELECT parent_pin_hash FROM users WHERE email = :email"),
        {"email": VALID_USER["email"]},
    )
    assert result.scalar_one() is not None


async def test_set_pin_update_existing_changes_hash(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    access_token = await register_and_verify(client, mock_mail)

    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )
    first_hash = (
        await db_session.execute(
            text("SELECT parent_pin_hash FROM users WHERE email = :email"),
            {"email": VALID_USER["email"]},
        )
    ).scalar_one()

    res = await client.post(
        _PIN_URL, json={"pin": _NEW_PIN}, cookies={"access_token": access_token}
    )
    assert res.status_code == 200
    second_hash = (
        await db_session.execute(
            text("SELECT parent_pin_hash FROM users WHERE email = :email"),
            {"email": VALID_USER["email"]},
        )
    ).scalar_one()
    assert first_hash != second_hash


async def test_set_pin_invalid_format_returns_422(client: AsyncClient, mock_mail):
    access_token = await register_and_verify(client, mock_mail)

    res = await client.post(
        _PIN_URL, json={"pin": "12"}, cookies={"access_token": access_token}
    )
    assert res.status_code == 422


async def test_onboarding_completes_only_with_pin_and_child(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    access_token = await register_and_verify(client, mock_mail)

    # PIN set, but no children yet — onboarding not complete.
    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )
    onboarding = (
        await db_session.execute(
            text("SELECT onboarding_completed FROM users WHERE email = :email"),
            {"email": VALID_USER["email"]},
        )
    ).scalar_one()
    assert onboarding is False

    # Insert a child directly — keeps these PIN tests independent of the
    # profile endpoints (see test_profiles.py).
    user_id = (
        await db_session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": VALID_USER["email"]},
        )
    ).scalar_one()
    await db_session.execute(
        text(
            "INSERT INTO children "
            "(id, user_id, name, is_active, created_at, updated_at) "
            "VALUES (gen_random_uuid(), :user_id, 'Leo', true, NOW(), NOW())"
        ),
        {"user_id": user_id},
    )
    await db_session.commit()

    # Re-setting the PIN now satisfies both conditions.
    res = await client.post(
        _PIN_URL, json={"pin": _NEW_PIN}, cookies={"access_token": access_token}
    )
    assert res.status_code == 200
    onboarding = (
        await db_session.execute(
            text("SELECT onboarding_completed FROM users WHERE email = :email"),
            {"email": VALID_USER["email"]},
        )
    ).scalar_one()
    assert onboarding is True


async def test_pin_without_access_token_returns_401(client: AsyncClient):
    res = await client.post(_PIN_URL, json={"pin": _PIN})
    assert res.status_code == 401


# verify-pin


async def test_verify_pin_before_set_returns_428(client: AsyncClient, mock_mail):
    access_token = await register_and_verify(client, mock_mail)

    res = await client.post(
        _VERIFY_PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )
    assert res.status_code == 428


async def test_verify_pin_correct_returns_200(client: AsyncClient, mock_mail):
    access_token = await register_and_verify(client, mock_mail)
    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )

    res = await client.post(
        _VERIFY_PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )
    assert res.status_code == 200
    assert res.json() == {"status": "success", "authenticated": True}


async def test_verify_pin_wrong_returns_401(client: AsyncClient, mock_mail):
    access_token = await register_and_verify(client, mock_mail)
    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )

    res = await client.post(
        _VERIFY_PIN_URL, json={"pin": "0000"}, cookies={"access_token": access_token}
    )
    assert res.status_code == 401


async def test_verify_pin_without_access_token_returns_401(client: AsyncClient):
    res = await client.post(_VERIFY_PIN_URL, json={"pin": _PIN})
    assert res.status_code == 401


# forgot-pin


async def test_forgot_pin_before_expiry_returns_429_with_retry_after(
    client: AsyncClient, mock_mail
):
    access_token = await register_and_verify(client, mock_mail)
    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )

    res = await client.post(_FORGOT_PIN_URL, cookies={"access_token": access_token})
    assert res.status_code == 429
    body = res.json()
    assert "retry_after_seconds" in body
    assert body["retry_after_seconds"] > 0


async def test_forgot_pin_after_expiry_returns_200_with_new_expires_at(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    access_token = await register_and_verify(client, mock_mail)
    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )

    await db_session.execute(
        text("UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'")
    )
    await db_session.commit()

    res = await client.post(_FORGOT_PIN_URL, cookies={"access_token": access_token})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["expires_at"] is not None
    assert len(mock_mail) == 2  # registration code + pin reset code
    assert mock_mail[1].template_body["code"]


async def test_forgot_pin_without_access_token_returns_401(client: AsyncClient):
    res = await client.post(_FORGOT_PIN_URL)
    assert res.status_code == 401


# /reset-pin


async def test_reset_pin_correct_code_allows_new_pin_verify(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    access_token = await register_and_verify(client, mock_mail)
    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )

    await db_session.execute(
        text("UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'")
    )
    await db_session.commit()

    forgot_res = await client.post(
        _FORGOT_PIN_URL, cookies={"access_token": access_token}
    )
    code = mock_mail[1].template_body["code"]

    res = await client.post(
        _RESET_PIN_URL,
        json={"code": code, "new_pin": _NEW_PIN},
        cookies={"access_token": access_token},
    )
    assert res.status_code == 200
    assert res.json() == {"status": "success", "message": "PIN has been reset."}
    assert forgot_res.status_code == 200

    # New PIN works, old PIN doesn't.
    new_verify = await client.post(
        _VERIFY_PIN_URL, json={"pin": _NEW_PIN}, cookies={"access_token": access_token}
    )
    assert new_verify.status_code == 200

    old_verify = await client.post(
        _VERIFY_PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )
    assert old_verify.status_code == 401


async def test_reset_pin_wrong_code_returns_400(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    access_token = await register_and_verify(client, mock_mail)
    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )

    await db_session.execute(
        text("UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'")
    )
    await db_session.commit()
    await client.post(_FORGOT_PIN_URL, cookies={"access_token": access_token})

    res = await client.post(
        _RESET_PIN_URL,
        json={"code": "WRONGCOD", "new_pin": _NEW_PIN},
        cookies={"access_token": access_token},
    )
    assert res.status_code == 400


async def test_reset_pin_expired_code_returns_410(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    access_token = await register_and_verify(client, mock_mail)
    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )

    await db_session.execute(
        text("UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'")
    )
    await db_session.commit()
    await client.post(_FORGOT_PIN_URL, cookies={"access_token": access_token})
    code = mock_mail[1].template_body["code"]

    # Push the anchor (now the pin_reset anchor too) past its window again.
    await db_session.execute(
        text("UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'")
    )
    await db_session.commit()

    res = await client.post(
        _RESET_PIN_URL,
        json={"code": code, "new_pin": _NEW_PIN},
        cookies={"access_token": access_token},
    )
    assert res.status_code == 410


async def test_reset_pin_without_access_token_returns_401(client: AsyncClient):
    res = await client.post(
        _RESET_PIN_URL, json={"code": "ABCDEFGH", "new_pin": _NEW_PIN}
    )
    assert res.status_code == 401


# /reset-pin/verify


async def test_verify_pin_reset_code_correct_leaves_code_usable(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    access_token = await register_and_verify(client, mock_mail)
    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )
    await db_session.execute(
        text("UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'")
    )
    await db_session.commit()
    await client.post(_FORGOT_PIN_URL, cookies={"access_token": access_token})
    code = mock_mail[1].template_body["code"]

    res = await client.post(
        _RESET_PIN_VERIFY_URL,
        json={"code": code},
        cookies={"access_token": access_token},
    )
    assert res.status_code == 200
    assert res.json()["valid"] is True

    # Verifying must not consume the code — reset-pin still works with the same one.
    reset = await client.post(
        _RESET_PIN_URL,
        json={"code": code, "new_pin": _NEW_PIN},
        cookies={"access_token": access_token},
    )
    assert reset.status_code == 200


async def test_verify_pin_reset_code_wrong_returns_400(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    access_token = await register_and_verify(client, mock_mail)
    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )
    await db_session.execute(
        text("UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'")
    )
    await db_session.commit()
    await client.post(_FORGOT_PIN_URL, cookies={"access_token": access_token})

    res = await client.post(
        _RESET_PIN_VERIFY_URL,
        json={"code": "WRONGCOD"},
        cookies={"access_token": access_token},
    )
    assert res.status_code == 400


async def test_verify_pin_reset_code_without_access_token_returns_401(
    client: AsyncClient,
):
    res = await client.post(_RESET_PIN_VERIFY_URL, json={"code": "ABCDEFGH"})
    assert res.status_code == 401
