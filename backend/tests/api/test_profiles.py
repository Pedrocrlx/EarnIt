from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from tests.conftest import _OTHER, VALID_USER, register_and_verify

_PIN_URL = "/api/v1/auth/pin"
_CHILDREN_URL = "/api/v1/profiles/children"
_FAMILY_URL = "/api/v1/profiles/family"
_FAMILY_NAME_URL = "/api/v1/profiles/family-name"

_PIN = "1234"

# POST /profiles/children


async def test_create_child_returns_201(client: AsyncClient, mock_mail):
    access_token = await register_and_verify(client, mock_mail)

    res = await client.post(
        _CHILDREN_URL,
        json={
            "name": "Leo",
            "birth_date": "2017-04-12",
            "avatar_url": "https://example.com/a.png",
        },
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
    access_token = await register_and_verify(client, mock_mail)

    res = await client.post(
        _CHILDREN_URL, json={}, cookies={"access_token": access_token}
    )
    assert res.status_code == 422


async def test_create_child_without_access_token_returns_401(client: AsyncClient):
    res = await client.post(_CHILDREN_URL, json={"name": "Leo"})
    assert res.status_code == 401


async def test_children_cap_enforced(client: AsyncClient, mock_mail, monkeypatch):
    monkeypatch.setattr(settings, "MAX_CHILDREN_PER_USER", 2)
    access_token = await register_and_verify(client, mock_mail)

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
    access_token = await register_and_verify(client, mock_mail)

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

    res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    assert res.status_code == 201

    onboarding = (
        await db_session.execute(
            text("SELECT onboarding_completed FROM users WHERE email = :email"),
            {"email": VALID_USER["email"]},
        )
    ).scalar_one()
    assert onboarding is True


# GET /profiles/family


async def test_get_family_returns_profile_and_children(client: AsyncClient, mock_mail):
    access_token = await register_and_verify(client, mock_mail)

    create_res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    child_id = create_res.json()["id"]
    await client.patch(
        f"{_CHILDREN_URL}/{child_id}", cookies={"access_token": access_token}
    )

    await client.post(
        _CHILDREN_URL, json={"name": "Mia"}, cookies={"access_token": access_token}
    )

    res = await client.get(_FAMILY_URL, cookies={"access_token": access_token})
    assert res.status_code == 200
    body = res.json()
    assert body["family_name"] == VALID_USER["family_name"]
    assert "onboarding_completed" in body
    names = {c["name"]: c["is_active"] for c in body["children"]}
    assert names == {"Leo": False, "Mia": True}


async def test_get_family_without_access_token_returns_401(client: AsyncClient):
    res = await client.get(_FAMILY_URL)
    assert res.status_code == 401


# PATCH /profiles/children/{child_id}


async def test_update_child_birth_date_returns_200(client: AsyncClient, mock_mail):
    access_token = await register_and_verify(client, mock_mail)

    create_res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    child_id = create_res.json()["id"]

    res = await client.patch(
        f"{_CHILDREN_URL}/{child_id}",
        json={"birth_date": "2017-04-12"},
        cookies={"access_token": access_token},
    )

    assert res.status_code == 200
    assert res.json() == {
        "status": "success",
        "id": child_id,
        "birth_date": "2017-04-12",
    }

    family_res = await client.get(_FAMILY_URL, cookies={"access_token": access_token})
    assert family_res.json()["children"][0]["birth_date"] == "2017-04-12"


async def test_update_child_rejects_future_birth_date(client: AsyncClient, mock_mail):
    access_token = await register_and_verify(client, mock_mail)

    create_res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    child_id = create_res.json()["id"]

    res = await client.patch(
        f"{_CHILDREN_URL}/{child_id}",
        json={"birth_date": "2999-01-01"},
        cookies={"access_token": access_token},
    )

    assert res.status_code == 422


async def test_upload_child_avatar_associates_url(
    client: AsyncClient, mock_mail, monkeypatch, tmp_path
):
    monkeypatch.setattr(settings, "AVATAR_UPLOAD_DIR", str(tmp_path))
    access_token = await register_and_verify(client, mock_mail)
    create_res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    child_id = create_res.json()["id"]

    upload_res = await client.post(
        f"{_CHILDREN_URL}/{child_id}/avatar",
        files={
            "avatar": (
                "avatar.png",
                b"\x89PNG\r\n\x1a\nfake-png-content",
                "image/png",
            )
        },
        cookies={"access_token": access_token},
    )

    assert upload_res.status_code == 200
    avatar_url = f"{_CHILDREN_URL}/{child_id}/avatar"
    assert upload_res.json()["avatar_url"] == avatar_url

    family_res = await client.get(_FAMILY_URL, cookies={"access_token": access_token})
    assert family_res.json()["children"][0]["avatar_url"] == avatar_url

    avatar_res = await client.get(avatar_url, cookies={"access_token": access_token})
    assert avatar_res.status_code == 200
    assert avatar_res.headers["content-type"] == "image/png"
    assert avatar_res.content == b"\x89PNG\r\n\x1a\nfake-png-content"


async def test_upload_child_avatar_rejects_unsupported_type(
    client: AsyncClient, mock_mail, monkeypatch, tmp_path
):
    monkeypatch.setattr(settings, "AVATAR_UPLOAD_DIR", str(tmp_path))
    access_token = await register_and_verify(client, mock_mail)
    create_res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    child_id = create_res.json()["id"]

    res = await client.post(
        f"{_CHILDREN_URL}/{child_id}/avatar",
        files={"avatar": ("avatar.svg", b"<svg></svg>", "image/svg+xml")},
        cookies={"access_token": access_token},
    )

    assert res.status_code == 415


async def test_deactivate_active_child_returns_200(client: AsyncClient, mock_mail):
    access_token = await register_and_verify(client, mock_mail)

    create_res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    child_id = create_res.json()["id"]

    res = await client.patch(
        f"{_CHILDREN_URL}/{child_id}", cookies={"access_token": access_token}
    )
    assert res.status_code == 200
    assert res.json() == {
        "status": "success",
        "message": "Child profile deactivated.",
        "id": child_id,
        "is_active": False,
    }


async def test_deactivate_already_inactive_child_returns_409(
    client: AsyncClient, mock_mail
):
    access_token = await register_and_verify(client, mock_mail)

    create_res = await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )
    child_id = create_res.json()["id"]
    await client.patch(
        f"{_CHILDREN_URL}/{child_id}", cookies={"access_token": access_token}
    )

    res = await client.patch(
        f"{_CHILDREN_URL}/{child_id}", cookies={"access_token": access_token}
    )
    assert res.status_code == 409


async def test_deactivate_child_of_another_user_returns_404(
    client: AsyncClient, mock_mail
):
    access_token = await register_and_verify(client, mock_mail)
    other_access_token = await register_and_verify(client, mock_mail, **_OTHER)

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


# PATCH /profiles/family-name


async def test_update_family_name_returns_200_with_new_name(
    client: AsyncClient, mock_mail
):
    access_token = await register_and_verify(client, mock_mail)

    res = await client.patch(
        _FAMILY_NAME_URL,
        json={"family_name": "Santos"},
        cookies={"access_token": access_token},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["family_name"] == "Santos"


async def test_update_family_name_reflected_in_get_family(
    client: AsyncClient, mock_mail
):
    access_token = await register_and_verify(client, mock_mail)

    await client.patch(
        _FAMILY_NAME_URL,
        json={"family_name": "Ferreira"},
        cookies={"access_token": access_token},
    )

    res = await client.get(_FAMILY_URL, cookies={"access_token": access_token})
    assert res.status_code == 200
    assert res.json()["family_name"] == "Ferreira"


async def test_update_family_name_empty_string_returns_422(
    client: AsyncClient, mock_mail
):
    access_token = await register_and_verify(client, mock_mail)

    res = await client.patch(
        _FAMILY_NAME_URL,
        json={"family_name": ""},
        cookies={"access_token": access_token},
    )
    assert res.status_code == 422


async def test_update_family_name_without_access_token_returns_401(client: AsyncClient):
    res = await client.patch(_FAMILY_NAME_URL, json={"family_name": "Santos"})
    assert res.status_code == 401


async def test_onboarding_completes_when_family_name_set_last(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    # Register without a family_name so onboarding cannot complete yet.
    access_token = await register_and_verify(
        client, mock_mail, email="nofamily@example.com", family_name=None
    )

    # Set PIN and add a child — both conditions met except family_name.
    await client.post(
        _PIN_URL, json={"pin": _PIN}, cookies={"access_token": access_token}
    )
    await client.post(
        _CHILDREN_URL, json={"name": "Leo"}, cookies={"access_token": access_token}
    )

    onboarding = (
        await db_session.execute(
            text(
                "SELECT onboarding_completed FROM users "
                "WHERE email = 'nofamily@example.com'"
            )
        )
    ).scalar_one()
    assert onboarding is False

    # Setting the family name is the final step — onboarding should now flip.
    await client.patch(
        _FAMILY_NAME_URL,
        json={"family_name": "Rodrigues"},
        cookies={"access_token": access_token},
    )

    onboarding = (
        await db_session.execute(
            text(
                "SELECT onboarding_completed FROM users "
                "WHERE email = 'nofamily@example.com'"
            )
        )
    ).scalar_one()
    assert onboarding is True


# PATCH /profiles/point-value — the points→€ exchange rate

_POINT_VALUE_URL = "/api/v1/profiles/point-value"


async def test_set_point_value_returns_200(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    res = await client.patch(
        _POINT_VALUE_URL,
        json={"point_value_eur": "0.015"},
        cookies={"access_token": token},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert float(res.json()["point_value_eur"]) == 0.015


async def test_point_value_reflected_in_get_family(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    await client.patch(
        _POINT_VALUE_URL, json={"point_value_eur": "1"}, cookies={"access_token": token}
    )
    fam = await client.get(_FAMILY_URL, cookies={"access_token": token})
    assert float(fam.json()["point_value_eur"]) == 1.0


async def test_get_family_default_point_value_is_001(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    fam = await client.get(_FAMILY_URL, cookies={"access_token": token})
    assert float(fam.json()["point_value_eur"]) == 0.01


async def test_set_point_value_zero_returns_422(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    res = await client.patch(
        _POINT_VALUE_URL, json={"point_value_eur": "0"}, cookies={"access_token": token}
    )
    assert res.status_code == 422


async def test_set_point_value_too_many_decimals_returns_422(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    res = await client.patch(
        _POINT_VALUE_URL,
        json={"point_value_eur": "0.00001"},  # 5 decimals > 4
        cookies={"access_token": token},
    )
    assert res.status_code == 422


async def test_set_point_value_without_access_token_returns_401(client: AsyncClient):
    res = await client.patch(_POINT_VALUE_URL, json={"point_value_eur": "0.02"})
    assert res.status_code == 401


# GET /profiles/point-value — read the conversion rate


async def test_get_point_value_default_is_001(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    res = await client.get(_POINT_VALUE_URL, cookies={"access_token": token})
    assert res.status_code == 200
    assert float(res.json()["point_value_eur"]) == 0.01


async def test_get_point_value_reflects_patch(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    await client.patch(
        _POINT_VALUE_URL,
        json={"point_value_eur": "0.05"},
        cookies={"access_token": token},
    )
    res = await client.get(_POINT_VALUE_URL, cookies={"access_token": token})
    assert float(res.json()["point_value_eur"]) == 0.05


async def test_get_point_value_without_access_token_returns_401(client: AsyncClient):
    res = await client.get(_POINT_VALUE_URL)
    assert res.status_code == 401
