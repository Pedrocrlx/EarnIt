# Task management — feature scope

## Context
EarnIt's core feature: parents create tasks for children, children complete and
submit them, parents approve. Both task types go through the same approval flow.
Approved `extra_task` submissions auto-credit the child's wallet; approved duty
submissions record completion but carry no reward. Duties are daily recurring
obligations; extra_tasks are one-off earning opportunities.

---

## Key design decisions

| Decision | Answer |
|---|---|
| ID type | UUIDs throughout (existing backend) |
| `family_name` vs `full_name` | Keep `family_name` as-is |
| Duty recurrence | System auto-generates a fresh submission slot each day via background job |
| Duty reward | Always zero — only `extra_task` pays out |
| Wallet credit | Auto-credited immediately on submission approval |
| Child auth | Open (no PIN); all API calls use parent `access_token` + `child_id` in URL |

---

## New database tables (3)

### `tasks`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | parent who created it |
| child_id | UUID FK → children | assigned child |
| title | varchar(150) | |
| description | text nullable | |
| task_type | varchar(20) | `duty` \| `extra_task` |
| reward_amount | numeric(10,2) | always 0 for duties |
| expires_at | timestamptz nullable | extra_tasks may expire |
| is_active | boolean default true | soft-disable |
| created_at / updated_at | timestamptz | |

### `task_submissions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| task_id | UUID FK → tasks | |
| child_id | UUID FK → children | denormalised for query ease |
| scheduled_date | date nullable | set for auto-generated duty slots |
| photo_url | text nullable | proof of completion |
| submitted_at | timestamptz nullable | null = not yet submitted (duty slots start null) |
| status | varchar(20) | `pending` \| `approved` \| `rejected` |
| reviewed_at | timestamptz nullable | |
| rejection_note | text nullable | |

Unique constraint on `(task_id, scheduled_date)` — one duty slot per task per day.

### `wallet_transactions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| child_id | UUID FK → children | |
| task_submission_id | UUID FK nullable → task_submissions | null for future manual transactions |
| amount | numeric(10,2) | always positive |
| transaction_type | varchar(20) | `credit` \| `debit` |
| description | text nullable | |
| created_at | timestamptz | |

---

## Daily duty slot generation

Mirrors the limbo-purge pattern in `src/services/accounts.py`. A startup hook
fires once and schedules a recurring midnight task that, for every active duty,
inserts a `task_submissions` row with `status='pending'`, `scheduled_date=today`,
and `submitted_at=NULL`. The child marks it done (no photo required); `submitted_at`
is stamped at that point. The parent then approves or rejects it like any other
submission.

Guard: skip insert if a slot for `(task_id, scheduled_date)` already exists —
idempotent on restart.

---

## Endpoints

### Parent — task management (`/api/v1/tasks`)
| Method | Path | Action |
|---|---|---|
| POST | `/tasks` | Create duty or extra_task for a child |
| GET | `/tasks` | List tasks (filter: `child_id`, `task_type`, `is_active`) |
| PATCH | `/tasks/{task_id}` | Edit title / description / expires_at / is_active |
| DELETE | `/tasks/{task_id}` | Soft-delete (`is_active = false`) |

### Parent — submission review (`/api/v1/tasks/submissions`)
| Method | Path | Action |
|---|---|---|
| GET | `/tasks/submissions` | List submissions (filter: `status=pending`, `child_id`) |
| POST | `/tasks/submissions/{id}/approve` | Approve → auto-create `wallet_transaction` |
| POST | `/tasks/submissions/{id}/reject` | Reject with optional `rejection_note` |
| POST | `/tasks/submissions/approve-all` | Batch approve all pending (optional filter: `child_id`) |

### Child — task & wallet view (`/api/v1/children/{child_id}/...`)
All require `access_token` (parent session); backend validates `child_id` belongs
to the authenticated parent.

| Method | Path | Action |
|---|---|---|
| GET | `/children/{child_id}/tasks` | List today's duties + active extra_tasks |
| POST | `/children/{child_id}/tasks/{task_id}/submit` | Submit task (body: `photo_url?`) |
| PATCH | `/children/{child_id}/submissions/{submission_id}` | Resubmit after rejection (same row, status → pending) |
| GET | `/children/{child_id}/wallet` | Balance + transaction history |

---

## Business rules

- `duty` tasks: `reward_amount` forced to `0`; no `expires_at`.
- `extra_task` tasks: `reward_amount` must be > 0.
- Submitting a duty: only allowed if today's slot exists and `submitted_at IS NULL`.
- Submitting an extra_task: only allowed if no `pending` or `approved` submission
  exists for that task.
- Approving: inserts a `wallet_transaction (credit, amount=reward_amount)` in the
  same DB transaction as the status update. Duties credit 0 — no insert needed.
- Rejecting: sets `rejection_note`; child resubmits via `PATCH` on the same row
  (updates `photo_url`, resets `status → pending`, stamps `submitted_at`).
  One submission row per task/slot — status history visible via `reviewed_at` +
  `rejection_note`.
- Batch approve: processes each pending submission in the same atomic block;
  skips any that are not `pending`.
- A parent can only manage tasks/submissions for their own children
  (`child.user_id == current_user.id`).

---

## Balance / points display

All monetary amounts are stored as `numeric(10,2)` euros in the database.
The frontend displays them as points at a fixed conversion: **1 point = €0.01**
(multiply balance by 100 to get points). The API always returns euro values.

---

## Out of scope (this branch)

- **Goals** — MVP but implemented in the next branch after this one.
- **Streaks** — out of MVP scope; may be added post-launch.
- **Balance Toggle** — frontend-only display; backend returns numeric euros.
- **Puzzle Reveal** — frontend-only; computed from wallet balance ÷ goal target.
- **Child PIN / child session token** — children are open profiles.
- **Photo/file uploads of any kind** — neither `avatar_url` (children profiles)
  nor `photo_url` (task submissions) accept file uploads. Both fields are plain
  URL strings only. File storage (S3/etc.) is out of scope for this MVP.
- **Manual wallet debits** — wallet exposes balance/history only; debits are future.
- **Push notifications** — out of scope.

---

## Infrastructure constraint

Do **not** touch environment files, Docker configs, CI/CD pipelines, or container
definitions unless strictly necessary. If a change to any of those is unavoidable,
ask before doing anything — do not assume, do not guess, follow senior-dev practice.

---

## Migration

One Alembic migration adding `tasks`, `task_submissions`, `wallet_transactions`.
No changes to existing `users` or `children` tables.

---

## Implementation checklist

### Models & migration
- [ ] 1. Create SQLModel models: `Task`, `TaskSubmission`, `WalletTransaction` in `src/models/tasks.py`
- [ ] 2. Register new models in `src/models/__init__.py` (so Alembic picks them up)
- [ ] 3. Generate Alembic migration for `tasks`, `task_submissions`, `wallet_transactions` (with unique constraint on `task_id + scheduled_date`)

### Schemas
- [ ] 4. Task schemas in `src/schemas/tasks.py`: `TaskCreateRequest`, `TaskUpdateRequest`, `TaskResponse`
- [ ] 5. Submission schemas: `SubmitTaskRequest`, `RejectRequest`, `SubmissionResponse`
- [ ] 6. Wallet schemas: `WalletBalanceResponse`, `WalletTransactionResponse`

### Services
- [ ] 7. `src/services/tasks.py`: `create_task`, `get_task_or_404`, `list_tasks`
- [ ] 8. Add: `update_task`, `soft_delete_task`
- [ ] 9. Add: `submit_task` (duty guard: slot exists + not yet submitted; extra_task guard: no pending/approved)
- [ ] 10. Add: `approve_submission` (status → approved + `wallet_transaction` insert in one transaction)
- [ ] 11. Add: `reject_submission` (status → rejected + `rejection_note`)
- [ ] 12. Add: `resubmit_task` (PATCH same row: reset `status → pending`, stamp `submitted_at`)
- [ ] 13. Add: `batch_approve` (approve all pending atomically, skip non-pending)
- [ ] 14. Add: `get_balance` (sum credits − debits), `get_transaction_history`

### Background job
- [ ] 15. `generate_daily_duty_slots` in `src/services/tasks.py` — idempotent insert, skip if slot exists
- [ ] 16. Wire job into app startup (mirrors limbo-purge pattern in `src/services/accounts.py`)

### Endpoints — parent tasks (`/api/v1/tasks`)
- [ ] 17. `POST /tasks`
- [ ] 18. `GET /tasks` (filters: `child_id`, `task_type`, `is_active`)
- [ ] 19. `PATCH /tasks/{task_id}`
- [ ] 20. `DELETE /tasks/{task_id}` (soft-delete)

### Endpoints — parent submissions (`/api/v1/tasks/submissions`)
- [ ] 21. `GET /tasks/submissions` (filters: `status`, `child_id`)
- [ ] 22. `POST /tasks/submissions/approve-all` — register **before** `/{id}` routes
- [ ] 23. `POST /tasks/submissions/{id}/approve`
- [ ] 24. `POST /tasks/submissions/{id}/reject`

### Endpoints — child (`/api/v1/children/{child_id}/...`)
- [ ] 25. `GET /children/{child_id}/tasks` (today's duties + active extra_tasks)
- [ ] 26. `POST /children/{child_id}/tasks/{task_id}/submit`
- [ ] 27. `PATCH /children/{child_id}/submissions/{submission_id}` (resubmit)
- [ ] 28. `GET /children/{child_id}/wallet` (balance + history)

### Router wiring
- [ ] 29. Register `tasks` and `children` routers in app (`src/api/__init__.py` or `main.py`)

### Tests
- [ ] 30. Task CRUD — create (duty + extra_task), list, update, soft-delete, 404, cross-user 404
- [ ] 31. Submit endpoint: duty happy path, extra_task happy path, double-submit guard, already-approved guard
- [ ] 32. Approve single: `wallet_transaction` created, balance updated, duty credits 0
- [ ] 33. Reject + resubmit: reject sets note, resubmit resets status to `pending`
- [ ] 34. Batch approve: all pending flip, non-pending skipped, `child_id` filter works
- [ ] 35. Wallet: balance reflects approved credits, history returns correct rows
- [ ] 36. Duty slot job: slots created for today, idempotent on re-run
- [ ] 37. Run full test suite and fix any failures

---

## Verification

1. `uv run pytest -q` — all existing tests pass.
2. `POST /tasks` (duty) → `reward_amount` forced 0; (extra_task) → requires > 0.
3. Background job creates duty slots at startup for today; idempotent on restart.
4. `POST .../submit` → `pending`; `POST .../approve` → `approved` +
   `wallet_transactions` row; `GET .../wallet` reflects updated balance.
5. `POST /tasks/submissions/approve-all` → all pending flip to approved in one call.
6. Cross-user access attempt → 404.
