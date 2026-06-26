from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.tasks import TaskSubmission
from src.services.tasks import fail_overdue_duty_slots, generate_daily_duty_slots
from tests.conftest import _OTHER, _child, register_and_verify

_TASKS_URL = "/api/v1/tasks"
_SUBS_URL = "/api/v1/tasks/submissions"
_PROOF_BYTES = b"\x89PNG\r\n\x1a\nproof-image"
_PROOF_FILE = {"proof": ("proof.png", _PROOF_BYTES, "image/png")}

# Shared helpers


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
    client: AsyncClient, token: str, child_id: str, reward: int = 5
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
        files=_PROOF_FILE,
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
    assert body["reward_amount"] == 0

    child_tasks = await client.get(
        f"/api/v1/children/{child_id}/tasks", cookies={"access_token": token}
    )
    duty = child_tasks.json()[0]
    assert duty["submission"] is not None
    assert duty["submission"]["status"] == "open"
    assert duty["submission"]["scheduled_date"] == datetime.now(UTC).date().isoformat()


async def test_create_extra_task_returns_201(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Clean room",
            "task_type": "extra_task",
            "reward_amount": 35,
        },
        cookies={"access_token": token},
    )
    assert res.status_code == 201
    assert res.json()["reward_amount"] == 35


async def test_duty_reward_must_be_zero_returns_422(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Brush teeth",
            "task_type": "duty",
            "reward_amount": 1,
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
            "reward_amount": 0,
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


async def test_delete_task_hard_removes_it(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)

    res = await client.delete(
        f"{_TASKS_URL}/{task['id']}", cookies={"access_token": token}
    )
    assert res.status_code == 204

    # The task is gone from the list and a second delete 404s.
    listing = await client.get(_TASKS_URL, cookies={"access_token": token})
    assert all(t["id"] != task["id"] for t in listing.json())
    again = await client.delete(
        f"{_TASKS_URL}/{task['id']}", cookies={"access_token": token}
    )
    assert again.status_code == 404


async def test_delete_task_keeps_submissions_with_title_snapshot(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)
    sub = (await _submit(client, token, child_id, task["id"])).json()

    res = await client.delete(
        f"{_TASKS_URL}/{task['id']}", cookies={"access_token": token}
    )
    assert res.status_code == 204

    # The submission survives the task deletion, with task_id nulled and the
    # task's title snapshotted so it still reads as a now-removed task.
    subs = await client.get(_SUBS_URL, cookies={"access_token": token})
    orphan = next(s for s in subs.json() if s["id"] == sub["id"])
    assert orphan["task_id"] is None
    assert orphan["task_title"] == task["title"]


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


async def test_update_extra_reward(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id, reward=5)

    res = await client.patch(
        f"{_TASKS_URL}/{task['id']}",
        json={"reward_amount": 50},
        cookies={"access_token": token},
    )
    assert res.status_code == 200
    assert res.json()["reward_amount"] == 50


async def test_update_clears_expires_at_with_null(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)

    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    await client.patch(
        f"{_TASKS_URL}/{task['id']}",
        json={"expires_at": future},
        cookies={"access_token": token},
    )
    res = await client.patch(
        f"{_TASKS_URL}/{task['id']}",
        json={"expires_at": None},
        cookies={"access_token": token},
    )
    assert res.status_code == 200
    assert res.json()["expires_at"] is None


async def test_update_duty_with_nonzero_reward_returns_422(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)

    res = await client.patch(
        f"{_TASKS_URL}/{task['id']}",
        json={"reward_amount": 5},
        cookies={"access_token": token},
    )
    assert res.status_code == 422


async def test_update_extra_with_zero_reward_returns_422(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)

    res = await client.patch(
        f"{_TASKS_URL}/{task['id']}",
        json={"reward_amount": 0},
        cookies={"access_token": token},
    )
    assert res.status_code == 422


async def test_editing_reward_does_not_change_approved_credit(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id, reward=5)

    sub = (await _submit(client, token, child_id, task["id"])).json()
    await client.post(
        f"{_SUBS_URL}/{sub['id']}/approve", cookies={"access_token": token}
    )

    # Bump the reward after the credit was already written.
    res = await client.patch(
        f"{_TASKS_URL}/{task['id']}",
        json={"reward_amount": 50},
        cookies={"access_token": token},
    )
    assert res.status_code == 200

    # The already-credited wallet entry is an immutable snapshot — unchanged.
    wallet = await client.get(
        f"/api/v1/children/{child_id}/wallet", cookies={"access_token": token}
    )
    assert wallet.json()["balance_points"] == 5


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
    assert res.json()["proof_url"].endswith("/proof")


async def test_submit_without_proof_returns_422(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)

    res = await client.post(
        f"/api/v1/children/{child_id}/tasks/{task['id']}/submit",
        cookies={"access_token": token},
    )

    assert res.status_code == 422


async def test_submit_rejects_unsupported_proof(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)

    res = await client.post(
        f"/api/v1/children/{child_id}/tasks/{task['id']}/submit",
        files={"proof": ("proof.svg", b"<svg></svg>", "image/svg+xml")},
        cookies={"access_token": token},
    )

    assert res.status_code == 415


async def test_parent_can_read_submission_proof(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)
    submission = (await _submit(client, token, child_id, task["id"])).json()

    res = await client.get(
        submission["proof_url"],
        cookies={"access_token": token},
    )

    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert res.content == _PROOF_BYTES


async def test_approval_deletes_submission_proof(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id)
    submission = (await _submit(client, token, child_id, task["id"])).json()

    approved = await client.post(
        f"{_SUBS_URL}/{submission['id']}/approve",
        cookies={"access_token": token},
    )
    proof = await client.get(
        submission["proof_url"],
        cookies={"access_token": token},
    )

    assert approved.status_code == 200
    assert approved.json()["proof_url"] is None
    assert proof.status_code == 404


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


async def test_duty_submit_without_slot_returns_404(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)
    await db_session.execute(
        delete(TaskSubmission).where(TaskSubmission.task_id == UUID(task["id"]))
    )
    await db_session.commit()

    res = await _submit(client, token, child_id, task["id"])
    assert res.status_code == 404


# approve single


async def test_approve_extra_task_creates_wallet_transaction(
    client: AsyncClient, mock_mail
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id, reward=5)
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
    assert body["balance_points"] == 5
    assert len(body["transactions"]) == 1
    assert body["transactions"][0]["transaction_type"] == "credit"
    assert body["transactions"][0]["amount_points"] == 5


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
    assert wallet.json()["balance_points"] == 0
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
        files=_PROOF_FILE,
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
        files=_PROOF_FILE,
        cookies={"access_token": token},
    )
    assert res.status_code == 409


# batch approve


async def test_batch_approve_flips_all_pending(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    t1 = await _extra(client, token, child_id, reward=1)
    t2 = await _extra(client, token, child_id, reward=2)
    # Give t2 a different title to avoid unique constraint issue
    t2_res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Tidy room",
            "task_type": "extra_task",
            "reward_amount": 2,
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
            "reward_amount": 1,
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
    t1 = await _extra(client, token, child_id, reward=2)
    t2_res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Tidy room",
            "task_type": "extra_task",
            "reward_amount": 3,
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
    assert wallet.json()["balance_points"] == 5


async def test_wallet_history_ordered_newest_first(client: AsyncClient, mock_mail):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    t1 = await _extra(client, token, child_id, reward=1)
    t2_res = await client.post(
        _TASKS_URL,
        json={
            "child_id": child_id,
            "title": "Tidy room",
            "task_type": "extra_task",
            "reward_amount": 2,
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
    # Ordered newest-first: t2 (approved last, 2 pts) must precede t1 (1 pt).
    assert transactions[0]["amount_points"] == 2
    assert transactions[1]["amount_points"] == 1
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


async def test_create_duty_opens_slot_for_today(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _duty(client, token, child_id)

    count = await generate_daily_duty_slots(db_session)
    assert count == 0

    child_tasks = await client.get(
        f"/api/v1/children/{child_id}/tasks", cookies={"access_token": token}
    )
    assert child_tasks.status_code == 200
    duties = [t for t in child_tasks.json() if t["task_type"] == "duty"]
    assert len(duties) == 1
    assert duties[0]["submission"] is not None
    assert duties[0]["submission"]["status"] == "open"  # awaiting the child
    assert duties[0]["submission"]["submitted_at"] is None


async def test_generate_duty_slots_skips_existing_today_slot(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _duty(client, token, child_id)

    first = await generate_daily_duty_slots(db_session)
    second = await generate_daily_duty_slots(db_session)
    assert first == 0
    assert second == 0  # slot already exists — nothing inserted


async def test_deleted_duty_gets_no_slot(
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
        files=_PROOF_FILE,
        cookies={"access_token": token},
    )
    assert res.status_code == 410


async def test_parent_can_approve_pending_after_task_expired(
    client: AsyncClient, mock_mail
):
    # Expiry blocks the child, not the parent: a pending submission stays reviewable.
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id, reward=3)
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
    # The slot exists as `open` before the child does it; the parent must not be
    # able to approve work that was never submitted.
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


# day-rollover: overdue duty slots auto-fail


async def _past_slot(
    db_session: AsyncSession,
    task_id: str,
    child_id: str,
    *,
    status: str,
    days_ago: int = 1,
) -> UUID:
    """Insert a duty slot dated in the past (for sweep / day-rollover tests)."""
    sub = TaskSubmission(
        task_id=UUID(task_id),
        child_id=UUID(child_id),
        scheduled_date=datetime.now(UTC).date() - timedelta(days=days_ago),
        status=status,
        submitted_at=None if status == "open" else datetime.now(UTC),
    )
    db_session.add(sub)
    await db_session.commit()
    return sub.id


async def test_fail_overdue_marks_open_past_slot_failed(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)
    sub_id = await _past_slot(db_session, task["id"], child_id, status="open")

    assert await fail_overdue_duty_slots(db_session) == 1
    db_session.expunge_all()  # bulk UPDATE bypasses the identity map
    assert (await db_session.get(TaskSubmission, sub_id)).status == "failed"


async def test_fail_overdue_leaves_submitted_past_slot_pending(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    # The child submitted (pending) but the parent never reviewed — not failed; the
    # parent can still approve/reject it after the day.
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)
    sub_id = await _past_slot(db_session, task["id"], child_id, status="pending")

    assert await fail_overdue_duty_slots(db_session) == 0
    db_session.expunge_all()
    assert (await db_session.get(TaskSubmission, sub_id)).status == "pending"


async def test_fail_overdue_leaves_today_open_slot(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    await _duty(client, token, child_id)
    await generate_daily_duty_slots(db_session)  # today's slot, still open

    assert await fail_overdue_duty_slots(db_session) == 0


async def test_resubmit_past_day_duty_returns_410(
    client: AsyncClient, mock_mail, db_session: AsyncSession
):
    # A rejected duty slot from a past day can't be resubmitted — the day is closed.
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _duty(client, token, child_id)
    sub_id = await _past_slot(db_session, task["id"], child_id, status="rejected")

    res = await client.patch(
        f"/api/v1/children/{child_id}/submissions/{sub_id}",
        files=_PROOF_FILE,
        cookies={"access_token": token},
    )
    assert res.status_code == 410


# points→€ rate: balances are points; the rate is just reported for the frontend


async def test_wallet_reports_rate_and_revalues_on_rate_change(
    client: AsyncClient, mock_mail
):
    # Earn 5 points; the wallet stays 5 points but reports the current rate, so a
    # later rate change re-values everything at read time (frontend multiplies).
    token = await register_and_verify(client, mock_mail)
    child_id = await _child(client, token)
    task = await _extra(client, token, child_id, reward=5)
    sub = (await _submit(client, token, child_id, task["id"])).json()
    await client.post(
        f"{_SUBS_URL}/{sub['id']}/approve", cookies={"access_token": token}
    )

    wallet = (
        await client.get(
            f"/api/v1/children/{child_id}/wallet", cookies={"access_token": token}
        )
    ).json()
    assert wallet["balance_points"] == 5
    assert float(wallet["point_value_eur"]) == 0.01  # default → frontend shows €0.05

    # Parent raises the rate; points are unchanged, the reported rate is not.
    await client.patch(
        "/api/v1/profiles/point-value",
        json={"point_value_eur": "0.02"},
        cookies={"access_token": token},
    )
    wallet = (
        await client.get(
            f"/api/v1/children/{child_id}/wallet", cookies={"access_token": token}
        )
    ).json()
    assert wallet["balance_points"] == 5  # same points
    assert float(wallet["point_value_eur"]) == 0.02  # re-valued → frontend shows €0.10
