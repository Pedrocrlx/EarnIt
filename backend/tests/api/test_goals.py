from uuid import uuid4

from httpx import AsyncClient

from tests.conftest import _OTHER, _child, register_and_verify

_TASKS_URL = "/api/v1/tasks"
_SUBS_URL = "/api/v1/tasks/submissions"
_PROOF_FILE = {"proof": ("proof.png", b"\x89PNG\r\n\x1a\nproof-image", "image/png")}


# Shared helpers


def _goals_url(child_id: str) -> str:
    return f"/api/v1/children/{child_id}/goals"


async def _request_goal(
    client: AsyncClient, token: str, child_id: str, name: str = "Go to the park"
) -> dict:
    res = await client.post(
        _goals_url(child_id), json={"name": name}, cookies={"access_token": token}
    )
    assert res.status_code == 201
    return res.json()


async def _approve_goal(
    client: AsyncClient, token: str, child_id: str, goal_id: str, target: int
) -> dict:
    return (
        await client.post(
            f"{_goals_url(child_id)}/{goal_id}/approve",
            json={"target_amount": target},
            cookies={"access_token": token},
        )
    ).json()


async def _earn(
    client: AsyncClient, token: str, child_id: str, points: int, title: str = "Chore"
) -> None:
    """Credit the child `points` via an extra task: create → submit → approve."""
    task = (
        await client.post(
            _TASKS_URL,
            json={
                "child_id": child_id,
                "title": title,
                "task_type": "extra_task",
                "reward_amount": points,
            },
            cookies={"access_token": token},
        )
    ).json()
    sub = (
        await client.post(
            f"/api/v1/children/{child_id}/tasks/{task['id']}/submit",
            files=_PROOF_FILE,
            cookies={"access_token": token},
        )
    ).json()
    res = await client.post(
        f"{_SUBS_URL}/{sub['id']}/approve", cookies={"access_token": token}
    )
    assert res.status_code == 200


# request


async def test_request_goal_returns_201_pending(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)

    body = await _request_goal(client, token, child_id, name="Go to the park")
    assert body["name"] == "Go to the park"
    assert body["status"] == "requested"
    assert body["target_amount"] is None
    assert body["child_id"] == child_id
    assert "id" in body and "created_at" in body


async def test_request_goal_missing_name_returns_422(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)

    res = await client.post(
        _goals_url(child_id), json={}, cookies={"access_token": token}
    )
    assert res.status_code == 422


async def test_request_goal_empty_name_returns_422(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)

    res = await client.post(
        _goals_url(child_id), json={"name": ""}, cookies={"access_token": token}
    )
    assert res.status_code == 422


async def test_request_goal_cross_user_child_returns_404(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    other_token = await register_and_verify(client, mock_mail, **_OTHER)
    child_id = await _child(client, token)

    res = await client.post(
        _goals_url(child_id),
        json={"name": "Sneaky"},
        cookies={"access_token": other_token},
    )
    assert res.status_code == 404


async def test_request_goal_without_token_returns_401(client: AsyncClient):
    res = await client.post(_goals_url(str(uuid4())), json={"name": "x"})
    assert res.status_code == 401


# list


async def test_list_goals_returns_goals_and_balance(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _earn(client, token, child_id, 7)
    await _request_goal(client, token, child_id)

    res = await client.get(_goals_url(child_id), cookies={"access_token": token})
    assert res.status_code == 200
    body = res.json()
    assert body["child_id"] == child_id
    assert body["balance_points"] == 7
    assert float(body["point_value_eur"]) == 0.01
    assert len(body["goals"]) == 1


async def test_list_goals_filter_by_status(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    g1 = await _request_goal(client, token, child_id, name="Park")
    await _request_goal(client, token, child_id, name="Toy")
    await _approve_goal(client, token, child_id, g1["id"], 100)

    approved = await client.get(
        _goals_url(child_id),
        params={"status": "approved"},
        cookies={"access_token": token},
    )
    requested = await client.get(
        _goals_url(child_id),
        params={"status": "requested"},
        cookies={"access_token": token},
    )
    assert [g["name"] for g in approved.json()["goals"]] == ["Park"]
    assert [g["name"] for g in requested.json()["goals"]] == ["Toy"]


async def test_multiple_goals_per_child_coexist(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _request_goal(client, token, child_id, name="Park")
    await _request_goal(client, token, child_id, name="Toy")
    await _request_goal(client, token, child_id, name="Game")

    res = await client.get(_goals_url(child_id), cookies={"access_token": token})
    assert len(res.json()["goals"]) == 3


# approve


async def test_approve_goal_sets_target_and_status(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    goal = await _request_goal(client, token, child_id)

    res = await client.post(
        f"{_goals_url(child_id)}/{goal['id']}/approve",
        json={"target_amount": 500},
        cookies={"access_token": token},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "approved"
    assert body["target_amount"] == 500


async def test_approve_goal_non_positive_target_returns_422(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    goal = await _request_goal(client, token, child_id)

    res = await client.post(
        f"{_goals_url(child_id)}/{goal['id']}/approve",
        json={"target_amount": 0},
        cookies={"access_token": token},
    )
    assert res.status_code == 422


async def test_approve_already_approved_returns_409(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    goal = await _request_goal(client, token, child_id)
    await _approve_goal(client, token, child_id, goal["id"], 100)

    res = await client.post(
        f"{_goals_url(child_id)}/{goal['id']}/approve",
        json={"target_amount": 200},
        cookies={"access_token": token},
    )
    assert res.status_code == 409


async def test_approve_goal_unknown_returns_404(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)

    res = await client.post(
        f"{_goals_url(child_id)}/{uuid4()}/approve",
        json={"target_amount": 100},
        cookies={"access_token": token},
    )
    assert res.status_code == 404


# reject


async def test_reject_goal_sets_status_rejected(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    goal = await _request_goal(client, token, child_id)

    res = await client.post(
        f"{_goals_url(child_id)}/{goal['id']}/reject", cookies={"access_token": token}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "rejected"


async def test_reject_non_requested_returns_409(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    goal = await _request_goal(client, token, child_id)
    await _approve_goal(client, token, child_id, goal["id"], 100)

    res = await client.post(
        f"{_goals_url(child_id)}/{goal['id']}/reject", cookies={"access_token": token}
    )
    assert res.status_code == 409


# redeem


async def test_redeem_insufficient_balance_returns_409(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _earn(client, token, child_id, 50)
    goal = await _request_goal(client, token, child_id)
    await _approve_goal(client, token, child_id, goal["id"], 100)

    res = await client.post(
        f"{_goals_url(child_id)}/{goal['id']}/redeem", cookies={"access_token": token}
    )
    assert res.status_code == 409


async def test_redeem_spends_points_and_marks_redeemed(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _earn(client, token, child_id, 120)
    goal = await _request_goal(client, token, child_id)
    await _approve_goal(client, token, child_id, goal["id"], 100)

    res = await client.post(
        f"{_goals_url(child_id)}/{goal['id']}/redeem", cookies={"access_token": token}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "redeemed"

    wallet = (
        await client.get(
            f"/api/v1/children/{child_id}/wallet", cookies={"access_token": token}
        )
    ).json()
    assert wallet["balance_points"] == 20  # 120 earned − 100 spent
    debit = wallet["transactions"][0]
    assert debit["transaction_type"] == "debit"
    assert debit["amount_points"] == 100
    assert debit["description"] == f"Goal: {goal['name']}"


async def test_redeem_non_approved_returns_409(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _earn(client, token, child_id, 100)
    goal = await _request_goal(client, token, child_id)  # still 'requested'

    res = await client.post(
        f"{_goals_url(child_id)}/{goal['id']}/redeem", cookies={"access_token": token}
    )
    assert res.status_code == 409


async def test_redeem_already_redeemed_returns_409(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _earn(client, token, child_id, 250)
    goal = await _request_goal(client, token, child_id)
    await _approve_goal(client, token, child_id, goal["id"], 100)

    first = await client.post(
        f"{_goals_url(child_id)}/{goal['id']}/redeem", cookies={"access_token": token}
    )
    assert first.status_code == 200
    second = await client.post(
        f"{_goals_url(child_id)}/{goal['id']}/redeem", cookies={"access_token": token}
    )
    assert second.status_code == 409
