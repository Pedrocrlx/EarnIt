from datetime import UTC, datetime, timedelta
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.tasks import generate_daily_duty_slots
from tests.conftest import register_and_verify

_TASKS_URL = "/api/v1/tasks"
_SUBS_URL = "/api/v1/tasks/submissions"
_OTHER = {
    "email": "other@example.com",
    "password": "Password123!",
    "family_name": "Costa",
}

# Shared helpers


async def _child(client: AsyncClient, token: str, name: str = "Leo") -> str:
    res = await client.post(
        "/api/v1/profiles/children",
        json={"name": name},
        cookies={"access_token": token},
    )
    assert res.status_code == 201
    return res.json()["id"]


async def _duty(
    client: AsyncClient, token: str, child_id: str, title: str = "Brush teeth"
) -> dict:
    res = await client.post(
        _TASKS_URL,
        json={"child_id": child_id, "title": title, "task_type": "duty"},
        cookies={"access_token": token},
    )
    assert res.status_code == 201
    return res.json()


async def _extra(
    client: AsyncClient, token: str, child_id: str, reward: str = "5.00"
) -> dict:
    res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Clean room",
            "task_type": "extra_task",
            "reward_amount": reward,
        },
        cookies={"access_token": token},
    )
    assert res.status_code == 201
    return res.json()


async def _submit(client: AsyncClient, token: str, child_id: str, task_id: str) -> dict:
    res = await client.post(
        f"/api/v1/children/{child_id}/tasks/{task_id}/submit",
        cookies={"access_token": token},
    )
    return res


async def _expire(client: AsyncClient, token: str, task_id: str) -> None:
    """PATCH the task's expires_at into the past so it counts as expired."""
    past = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    res = await client.patch(
        f"{_TASKS_URL}/{task_id}",
        json={"expires_at": past},
        cookies={"access_token": token},
    )
    assert res.status_code == 200


# CRUD


async def test_create_duty_returns_201(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    res = await client.post(
        _TASKS_URL,
        json={"child_id": child_id, "title": "Brush teeth", "task_type": "duty"},
        cookies={"access_token": token},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["task_type"] == "duty"
    assert body["reward_amount"] == "0.00"
    assert body["is_active"] is True


async def test_create_extra_task_returns_201(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Clean room",
            "task_type": "extra_task",
            "reward_amount": "3.50",
        },
        cookies={"access_token": token},
    )
    assert res.status_code == 201
    assert res.json()["reward_amount"] == "3.50"


async def test_duty_reward_must_be_zero_returns_422(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Brush teeth",
            "task_type": "duty",
            "reward_amount": "1.00",
        },
        cookies={"access_token": token},
    )
    assert res.status_code == 422


async def test_extra_task_reward_must_be_positive_returns_422(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Clean room",
            "task_type": "extra_task",
            "reward_amount": "0.00",
        },
        cookies={"access_token": token},
    )
    assert res.status_code == 422


async def test_create_task_for_unknown_child_returns_404(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    res = await client.post(
        _TASKS_URL,
        json={"child_id": str(uuid4()), "title": "T", "task_type": "duty"},
        cookies={"access_token": token},
    )
    assert res.status_code == 404


async def test_list_tasks_returns_own_tasks_only(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    other_token = await register_and_verify(client, mock_mail, **_OTHER)
    child_id = await _child(client, token)
    other_child_id = await _child(client, other_token, name="Mia")
    await _duty(client, token, child_id)
    await _duty(client, other_token, other_child_id)

    res = await client.get(_TASKS_URL, cookies={"access_token": token})
    assert res.status_code == 200
    titles = [t["title"] for t in res.json()]
    assert len(titles) == 1


async def test_list_tasks_filter_by_task_type(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _duty(client, token, child_id)
    await _extra(client, token, child_id)

    res = await client.get(
        _TASKS_URL, params={"task_type": "duty"}, cookies={"access_token": token}
    )
    assert all(t["task_type"] == "duty" for t in res.json())


async def test_update_task_title(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)

    res = await client.patch(
        f"{_TASKS_URL}/{task['id']}",
        json={"title": "New title"},
        cookies={"access_token": token},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "New title"


async def test_soft_delete_sets_is_active_false(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)

    res = await client.delete(
        f"{_TASKS_URL}/{task['id']}", cookies={"access_token": token}
    )
    assert res.status_code == 200
    assert res.json()["is_active"] is False


async def test_task_of_other_user_returns_404(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    other_token = await register_and_verify(client, mock_mail, **_OTHER)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)

    res = await client.patch(
        f"{_TASKS_URL}/{task['id']}",
        json={"title": "Hack"},
        cookies={"access_token": other_token},
    )
    assert res.status_code == 404


async def test_create_task_without_token_returns_401(client: AsyncClient):
    res = await client.post(
        _TASKS_URL, json={"child_id": str(uuid4()), "title": "T", "task_type": "duty"}
    )
    assert res.status_code == 401


# submit


async def test_submit_duty_happy_path(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)
    await generate_daily_duty_slots(db_session)

    res = await _submit(client, token, child_id, task["id"])
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending"
    assert body["submitted_at"] is not None


async def test_submit_extra_task_happy_path(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)

    res = await _submit(client, token, child_id, task["id"])
    assert res.status_code == 201
    assert res.json()["status"] == "pending"


async def test_duty_double_submit_returns_409(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)
    await generate_daily_duty_slots(db_session)

    await _submit(client, token, child_id, task["id"])
    res = await _submit(client, token, child_id, task["id"])
    assert res.status_code == 409


async def test_extra_task_double_submit_returns_409(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)

    await _submit(client, token, child_id, task["id"])
    res = await _submit(client, token, child_id, task["id"])
    assert res.status_code == 409


async def test_duty_submit_without_slot_returns_404(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)
    # No slot generated

    res = await _submit(client, token, child_id, task["id"])
    assert res.status_code == 404


# approve single


async def test_approve_extra_task_creates_wallet_transaction(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id, reward="2.50")
    sub = (await _submit(client, token, child_id, task["id"])).json()

    res = await client.post(
        f"{_SUBS_URL}/{sub['id']}/approve", cookies={"access_token": token}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "approved"

    wallet = await client.get(
        f"/api/v1/children/{child_id}/wallet", cookies={"access_token": token}
    )
    assert wallet.status_code == 200
    body = wallet.json()
    assert body["balance"] == "2.50"
    assert len(body["transactions"]) == 1
    assert body["transactions"][0]["transaction_type"] == "credit"


async def test_approve_duty_does_not_create_wallet_transaction(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)
    await generate_daily_duty_slots(db_session)
    sub = (await _submit(client, token, child_id, task["id"])).json()

    await client.post(
        f"{_SUBS_URL}/{sub['id']}/approve", cookies={"access_token": token}
    )

    wallet = await client.get(
        f"/api/v1/children/{child_id}/wallet", cookies={"access_token": token}
    )
    assert wallet.json()["balance"] == "0.00"
    assert wallet.json()["transactions"] == []


async def test_approve_non_pending_returns_409(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)
    sub = (await _submit(client, token, child_id, task["id"])).json()

    await client.post(
        f"{_SUBS_URL}/{sub['id']}/approve", cookies={"access_token": token}
    )
    res = await client.post(
        f"{_SUBS_URL}/{sub['id']}/approve", cookies={"access_token": token}
    )
    assert res.status_code == 409


# reject + resubmit


async def test_reject_sets_rejection_note(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)
    sub = (await _submit(client, token, child_id, task["id"])).json()

    res = await client.post(
        f"{_SUBS_URL}/{sub['id']}/reject",
        json={"rejection_note": "Not good enough"},
        cookies={"access_token": token},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "rejected"
    assert body["rejection_note"] == "Not good enough"


async def test_resubmit_resets_status_to_pending(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)
    sub = (await _submit(client, token, child_id, task["id"])).json()

    await client.post(
        f"{_SUBS_URL}/{sub['id']}/reject",
        json={"rejection_note": "Try again"},
        cookies={"access_token": token},
    )

    res = await client.patch(
        f"/api/v1/children/{child_id}/submissions/{sub['id']}",
        cookies={"access_token": token},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "pending"
    assert body["rejection_note"] is None


async def test_resubmit_non_rejected_returns_409(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)
    sub = (await _submit(client, token, child_id, task["id"])).json()

    res = await client.patch(
        f"/api/v1/children/{child_id}/submissions/{sub['id']}",
        cookies={"access_token": token},
    )
    assert res.status_code == 409


# batch approve


async def test_batch_approve_flips_all_pending(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    t1 = await _extra(client, token, child_id, reward="1.00")
    t2 = await _extra(client, token, child_id, reward="2.00")
    # Give t2 a different title to avoid unique constraint issue
    t2_res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Tidy room",
            "task_type": "extra_task",
            "reward_amount": "2.00",
        },
        cookies={"access_token": token},
    )
    t2 = t2_res.json()

    await _submit(client, token, child_id, t1["id"])
    await _submit(client, token, child_id, t2["id"])

    res = await client.post(
        f"{_SUBS_URL}/approve-all", json={}, cookies={"access_token": token}
    )
    assert res.status_code == 200
    assert res.json()["approved"] == 2


async def test_batch_approve_skips_already_approved(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    t1 = await _extra(client, token, child_id)
    t2_res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Tidy room",
            "task_type": "extra_task",
            "reward_amount": "1.00",
        },
        cookies={"access_token": token},
    )
    t2 = t2_res.json()

    s1 = (await _submit(client, token, child_id, t1["id"])).json()
    await _submit(client, token, child_id, t2["id"])
    await client.post(
        f"{_SUBS_URL}/{s1['id']}/approve", cookies={"access_token": token}
    )

    res = await client.post(
        f"{_SUBS_URL}/approve-all", json={}, cookies={"access_token": token}
    )
    assert res.json()["approved"] == 1


async def test_batch_approve_filter_by_child_id(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child1_id = await _child(client, token, name="Leo")
    child2_id = await _child(client, token, name="Mia")
    t1 = await _extra(client, token, child1_id)
    t2 = await _extra(client, token, child2_id)
    await _submit(client, token, child1_id, t1["id"])
    await _submit(client, token, child2_id, t2["id"])

    res = await client.post(
        f"{_SUBS_URL}/approve-all",
        json={"child_id": child1_id},
        cookies={"access_token": token},
    )
    assert res.json()["approved"] == 1

    subs = await client.get(
        _SUBS_URL,
        params={"child_id": child2_id, "status": "pending"},
        cookies={"access_token": token},
    )
    assert len(subs.json()) == 1


# wallet


async def test_wallet_balance_sums_credits(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    t1 = await _extra(client, token, child_id, reward="1.50")
    t2_res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Tidy room",
            "task_type": "extra_task",
            "reward_amount": "2.50",
        },
        cookies={"access_token": token},
    )
    t2 = t2_res.json()
    s1 = (await _submit(client, token, child_id, t1["id"])).json()
    s2 = (await _submit(client, token, child_id, t2["id"])).json()
    await client.post(
        f"{_SUBS_URL}/{s1['id']}/approve", cookies={"access_token": token}
    )
    await client.post(
        f"{_SUBS_URL}/{s2['id']}/approve", cookies={"access_token": token}
    )

    wallet = await client.get(
        f"/api/v1/children/{child_id}/wallet", cookies={"access_token": token}
    )
    assert wallet.status_code == 200
    assert wallet.json()["balance"] == "4.00"


async def test_wallet_history_ordered_newest_first(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    t1 = await _extra(client, token, child_id, reward="1.00")
    t2_res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Tidy room",
            "task_type": "extra_task",
            "reward_amount": "2.00",
        },
        cookies={"access_token": token},
    )
    t2 = t2_res.json()
    s1 = (await _submit(client, token, child_id, t1["id"])).json()
    s2 = (await _submit(client, token, child_id, t2["id"])).json()
    await client.post(
        f"{_SUBS_URL}/{s1['id']}/approve", cookies={"access_token": token}
    )
    await client.post(
        f"{_SUBS_URL}/{s2['id']}/approve", cookies={"access_token": token}
    )

    transactions = (
        await client.get(
            f"/api/v1/children/{child_id}/wallet", cookies={"access_token": token}
        )
    ).json()["transactions"]
    assert len(transactions) == 2
    # Ordered newest-first: t2 (approved last, €2.00) must precede t1 (€1.00).
    assert float(transactions[0]["amount"]) == 2.00
    assert float(transactions[1]["amount"]) == 1.00
    assert all(t["transaction_type"] == "credit" for t in transactions)


async def test_wallet_cross_user_returns_404(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    other_token = await register_and_verify(client, mock_mail, **_OTHER)
    child_id = await _child(client, token)

    res = await client.get(
        f"/api/v1/children/{child_id}/wallet", cookies={"access_token": other_token}
    )
    assert res.status_code == 404


# duty slot background job


async def test_generate_duty_slots_creates_slot_for_today(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _duty(client, token, child_id)

    count = await generate_daily_duty_slots(db_session)
    assert count == 1

    child_tasks = await client.get(
        f"/api/v1/children/{child_id}/tasks", cookies={"access_token": token}
    )
    assert child_tasks.status_code == 200
    duties = [t for t in child_tasks.json() if t["task_type"] == "duty"]
    assert len(duties) == 1
    assert duties[0]["submission"] is not None
    assert duties[0]["submission"]["submitted_at"] is None


async def test_generate_duty_slots_is_idempotent(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _duty(client, token, child_id)

    first = await generate_daily_duty_slots(db_session)
    second = await generate_daily_duty_slots(db_session)
    assert first == 1
    assert second == 0  # slot already exists — nothing inserted


async def test_inactive_duty_gets_no_slot(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)
    await client.delete(f"{_TASKS_URL}/{task['id']}", cookies={"access_token": token})

    count = await generate_daily_duty_slots(db_session)
    assert count == 0


# expiry


async def test_submit_expired_task_returns_410(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)
    await _expire(client, token, task["id"])

    res = await _submit(client, token, child_id, task["id"])
    assert res.status_code == 410


async def test_resubmit_blocked_after_expiry_returns_410(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)
    sub = (await _submit(client, token, child_id, task["id"])).json()
    await client.post(
        f"{_SUBS_URL}/{sub['id']}/reject",
        json={"rejection_note": "no"},
        cookies={"access_token": token},
    )
    await _expire(client, token, task["id"])

    res = await client.patch(
        f"/api/v1/children/{child_id}/submissions/{sub['id']}",
        cookies={"access_token": token},
    )
    assert res.status_code == 410


async def test_parent_can_approve_pending_after_task_expired(
    client: AsyncClient, mock_mail
):
    # Expiry blocks the child, not the parent: a pending submission stays reviewable.
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id, reward="3.00")
    sub = (await _submit(client, token, child_id, task["id"])).json()
    await _expire(client, token, task["id"])

    res = await client.post(
        f"{_SUBS_URL}/{sub['id']}/approve", cookies={"access_token": token}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "approved"


async def test_parent_can_reject_pending_after_task_expired(
    client: AsyncClient, mock_mail
):
    # Like approve, reject isn't expiry-gated — the parent can still fail a
    # submission left pending at expiry. (Child lockout after that is covered by
    # test_resubmit_blocked_after_expiry_returns_410.)
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)
    sub = (await _submit(client, token, child_id, task["id"])).json()
    await _expire(client, token, task["id"])

    rej = await client.post(
        f"{_SUBS_URL}/{sub['id']}/reject",
        json={"rejection_note": "late"},
        cookies={"access_token": token},
    )
    assert rej.status_code == 200
    assert rej.json()["status"] == "rejected"


async def test_expired_duty_generates_no_slot(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)
    await _expire(client, token, task["id"])

    count = await generate_daily_duty_slots(db_session)
    assert count == 0


# review guards — a duty slot is only reviewable once the child has submitted it


async def test_approve_unsubmitted_duty_returns_409(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    # The slot exists (pending, submitted_at=NULL) before the child does it; the
    # parent must not be able to approve work that was never submitted.
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _duty(client, token, child_id)
    await generate_daily_duty_slots(db_session)

    sub_id = (await client.get(_SUBS_URL, cookies={"access_token": token})).json()[0][
        "id"
    ]
    res = await client.post(
        f"{_SUBS_URL}/{sub_id}/approve", cookies={"access_token": token}
    )
    assert res.status_code == 409


async def test_reject_unsubmitted_duty_returns_409(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _duty(client, token, child_id)
    await generate_daily_duty_slots(db_session)

    sub_id = (await client.get(_SUBS_URL, cookies={"access_token": token})).json()[0][
        "id"
    ]
    res = await client.post(
        f"{_SUBS_URL}/{sub_id}/reject", cookies={"access_token": token}
    )
    assert res.status_code == 409
