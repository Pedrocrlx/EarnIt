from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

_REGISTER_URL = "/api/v1/auth/register"
_VERIFY_URL = "/api/v1/auth/verify"
_PIN_URL = "/api/v1/auth/pin"
_CHILDREN_URL = "/api/v1/profiles/children"
_FAMILY_URL = "/api/v1/profiles/family"

_VALID = {"email": "user@example.com", "password": "Password123!", "family_name": "Silva"}
_OTHER = {"email": "other@example.com", "password": "Password123!", "family_name": "Costa"}
_PIN = "1234"


def _cookie(response, name: str) -> str | None:
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


async def _register_and_verify(client: AsyncClient, mock_mail, payload=_VALID) -> str:
    """Register + verify an account, returning the access_token cookie value."""
    reg = await client.post(_REGISTER_URL, json=payload)
    token = _cookie(reg, "pending_verification_token")
    code = mock_mail[-1].template_body["code"]
    verify_res = await client.post(
        _VERIFY_URL,
        json={"code": code},
        cookies={"pending_verification_token": token},
    )
    return _cookie(verify_res, "access_token")


# ---------------------------------------------------------------------------
# POST /profiles/children
# ---------------------------------------------------------------------------


async def test_create_child_returns_201(client: AsyncClient, mock_mail):
    access_token = await _register_and_verify(client, mock_mail)

    res = await client.post(
        _CHILDREN_URL,
        json={"name": "Leo", "birth_date": "2017-04-12", "avatar_url": "https://example.com/a.png"},
        cookies={"access_token": access_token},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Leo"
    assert body["birth_date"] == "2017-04-12"
    assert body["avatar_url"] == "https://example.com/a.png"
    assert body["is_active"] is True
    assert "id" in body and "user_id" in body


async def test_create_child_missing_name_returns_422(client: AsyncClient, mock_mail):
    access_token = await _register_and_verify(client, mock_mail)

    res = await client.post(_CHILDREN_URL, json={}, cookies={"access_token": access_token})
    assert res.status_code == 422


async def test_create_child_without_access_token_returns_401(client: AsyncClient):
    res = await client.post(_CHILDREN_URL, json={"name": "Leo"})
    assert res.status_code == 401


async def test_children_cap_enforced(client: AsyncClient, mock_mail, monkeypatch):
    monkeypatch.setattr(settings, "MAX_CHILDREN_PER_USER", 2)
    access_token = await _register_and_verify(client, mock_mail)

    res1 = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    res2 = await client.post(
        _CHILDREN_URL, json={"name": "Mia"}, cookies={"access_token": access_token}
    )
    assert res1.status_code == 201
    assert res2.status_code == 201

    res3 = await client.post(
        _CHILDREN_URL, json={"name": "Tom"}, cookies={"access_token": access_token}
    )
    assert res3.status_code == 409
    assert res3.json() == {
        "error": "children_cap_reached",
        "message": "Maximum number of child profiles reached.",
    }


async def test_deactivated_children_still_count_toward_cap(
    client: AsyncClient, mock_mail, monkeypatch
):
    monkeypatch.setattr(settings, "MAX_CHILDREN_PER_USER", 2)
    access_token = await _register_and_verify(client, mock_mail)

    res1 = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    res2 = await client.post(
        _CHILDREN_URL, json={"name": "Mia"}, cookies={"access_token": access_token}
    )
    child_id = res1.json()["id"]

    deactivate_res = await client.patch(
        f"{_CHILDREN_URL}/{child_id}", cookies={"access_token": access_token}
    )
    assert deactivate_res.status_code == 200

    res3 = await client.post(
        _CHILDREN_URL, json={"name": "Tom"}, cookies={"access_token": access_token}
    )
    assert res3.status_code == 409
    assert res2.status_code == 201


async def test_onboarding_completes_when_child_created_after_pin(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    access_token = await _register_and_verify(client, mock_mail)

    # PIN set, but no children yet — onboarding not complete.
    await client.post(_PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token})
    onboarding = (
        await db_session.execute(
            text("SELECT onboarding_completed FROM users WHERE email = :email"),
            {"email": _VALID["email"]},
        )
    ).scalar_one()
    assert onboarding is False

    res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    assert res.status_code == 201

    onboarding = (
        await db_session.execute(
            text("SELECT onboarding_completed FROM users WHERE email = :email"),
            {"email": _VALID["email"]},
        )
    ).scalar_one()
    assert onboarding is True


# ---------------------------------------------------------------------------
# GET /profiles/family
# ---------------------------------------------------------------------------


async def test_get_family_returns_profile_and_children(client: AsyncClient, mock_mail):
    access_token = await _register_and_verify(client, mock_mail)

    create_res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    child_id = create_res.json()["id"]
    await client.patch(f"{_CHILDREN_URL}/{child_id}", cookies={"access_token": access_token})

    await client.post(_CHILDREN_URL, json={"name": "Mia"}, cookies={"access_token": access_token})

    res = await client.get(_FAMILY_URL, cookies={"access_token": access_token})
    assert res.status_code == 200
    body = res.json()
    assert body["family_name"] == _VALID["family_name"]
    assert "onboarding_completed" in body
    names = {c["name"]: c["is_active"] for c in body["children"]}
    assert names == {"Leo": False, "Mia": True}


async def test_get_family_without_access_token_returns_401(client: AsyncClient):
    res = await client.get(_FAMILY_URL)
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# PATCH /profiles/children/{child_id}
# ---------------------------------------------------------------------------


async def test_deactivate_active_child_returns_200(client: AsyncClient, mock_mail):
    access_token = await _register_and_verify(client, mock_mail)

    create_res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    child_id = create_res.json()["id"]

    res = await client.patch(f"{_CHILDREN_URL}/{child_id}", cookies={"access_token": access_token})
    assert res.status_code == 200
    assert res.json() == {
        "status": "success",
        "message": "Child profile deactivated.",
        "id": child_id,
        "is_active": False,
    }


async def test_deactivate_already_inactive_child_returns_409(client: AsyncClient, mock_mail):
    access_token = await _register_and_verify(client, mock_mail)

    create_res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    child_id = create_res.json()["id"]
    await client.patch(f"{_CHILDREN_URL}/{child_id}", cookies={"access_token": access_token})

    res = await client.patch(f"{_CHILDREN_URL}/{child_id}", cookies={"access_token": access_token})
    assert res.status_code == 409


async def test_deactivate_child_of_another_user_returns_404(client: AsyncClient, mock_mail):
    access_token = await _register_and_verify(client, mock_mail)
    other_access_token = await _register_and_verify(client, mock_mail, payload=_OTHER)

    create_res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    child_id = create_res.json()["id"]

    res = await client.patch(
        f"{_CHILDREN_URL}/{child_id}", cookies={"access_token": other_access_token}
    )
    assert res.status_code == 404


async def test_deactivate_child_without_access_token_returns_401(client: AsyncClient):
    res = await client.patch(f"{_CHILDREN_URL}/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 401
