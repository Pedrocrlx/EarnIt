# EarnIt Backend

---

## Quick Reference

### Start in 3 commands

```bash
make up-ba                                           # Start API + DB + Mailpit
docker compose exec api uv run alembic upgrade head  # Migrations (first run only)
# → API docs: http://localhost:8000/docs  |  Email UI: http://localhost:8025
```

### All endpoints

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | — | Register; emails a verification code |
| `POST` | `/api/v1/auth/verify` | pending cookie | Confirm email; swap to full session |
| `POST` | `/api/v1/auth/verify/resend` | pending cookie | Resend code (rate-limited, 429 while active) |
| `POST` | `/api/v1/auth/login` | — | Login; set session cookie |
| `POST` | `/api/v1/auth/logout` | session | Clear session cookie |
| `POST` | `/api/v1/auth/forgot-password` | — | Email a reset code (rate-limited, 429 while active) |
| `POST` | `/api/v1/auth/reset-password` | — | `{ email, code, new_password }` → reset password |
| `POST` | `/api/v1/auth/pin` | session | Set / update parental PIN |
| `POST` | `/api/v1/auth/verify-pin` | session | Check PIN; gates parent dashboard |
| `POST` | `/api/v1/auth/forgot-pin` | session | Email a PIN-reset code (rate-limited, 429 while active) |
| `POST` | `/api/v1/auth/reset-pin` | session | `{ code, new_pin }` → reset PIN |
| `PATCH` | `/api/v1/profiles/family-name` | session | Update family display name |
| `POST` | `/api/v1/profiles/children` | session | Add a child profile |
| `PATCH` | `/api/v1/profiles/children/{id}` | session | Deactivate a child profile |
| `GET` | `/api/v1/profiles/family` | session | Parent profile + all children |
| `POST` | `/api/v1/tasks` | session | Create a task (`duty` or `extra_task`) |
| `GET` | `/api/v1/tasks` | session | List tasks (filter: `child_id`, `task_type`, `is_active`) |
| `PATCH` | `/api/v1/tasks/{id}` | session | Partial update task fields |
| `DELETE` | `/api/v1/tasks/{id}` | session | Soft-delete task |
| `GET` | `/api/v1/tasks/submissions` | session | List submissions (filter: `child_id`, `status`) |
| `POST` | `/api/v1/tasks/submissions/approve-all` | session | Batch-approve all pending (`child_id?`) |
| `POST` | `/api/v1/tasks/submissions/{id}/approve` | session | Approve + credit wallet |
| `POST` | `/api/v1/tasks/submissions/{id}/reject` | session | Reject with optional note |
| `GET` | `/api/v1/children/{child_id}/tasks` | session | Child's tasks + submission state |
| `POST` | `/api/v1/children/{child_id}/tasks/{task_id}/submit` | session | Submit a task completion |
| `PATCH` | `/api/v1/children/{child_id}/submissions/{id}` | session | Resubmit after rejection |
| `GET` | `/api/v1/children/{child_id}/wallet` | session | Balance + transaction history |

### Auth flows at a glance

| Flow | Steps |
|---|---|
| Register | `POST /register` → email code → `POST /verify` |
| Forgot password | `POST /forgot-password` → email code → `POST /reset-password` `{ email, code, new_password }` |
| Forgot PIN | `POST /forgot-pin` → email code → `POST /reset-pin` `{ code, new_pin }` |

All verification codes expire in **10 minutes**. Resend/request endpoints return `429 { retry_after_seconds }` while a code is still live — a new code can only be issued once the previous window closes.

### Dev shortcut — bypass auth

Set `DISABLE_AUTH=true` in `.env`. Every request is served as `dev@earnit.local` (seeded automatically on startup, with one child at `child_id = 00000000-0000-0000-0000-000000000001`). Never enable in production.

```bash
# Seed the dev user manually without starting the server:
uv run python -m src.dev.seed
```

### Run tests

```bash
uv run pytest -q     # requires the db + mailpit containers to be running
```

---

## Full Documentation

### Tech Stack
- **Language:** Python 3.14+
- **Framework:** FastAPI
- **Database:** PostgreSQL 17
- **ORM:** SQLModel
- **Migrations:** Alembic
- **Mail:** fastapi-mail (SMTP, dev via Mailpit)
- **Background work:** one daily maintenance loop (duty-slot generation + limbo-account purge sweep)
- **Package Manager:** [uv](https://github.com/astral-sh/uv)

### Getting Started

#### Prerequisites
- [Docker & Docker Compose](https://docs.docker.com/get-docker/)
- [uv](https://github.com/astral-sh/uv)

#### First-Time Setup
```bash
cp .env.example .env   # then fill in SECRET_KEY (openssl rand -hex 32)
```

#### Running the Backend Stack

**Using Docker:**
```bash
make up-ba      # Start API, DB, and Mailpit
make down       # Stop the stack
```

Run `make help` to list every target. Two cleanup targets are available:
```bash
make clean      # Remove Python and tool caches (__pycache__, .ruff_cache, .pytest_cache); keeps the virtualenv
make full-clean    # Full cleanup — everything in clean plus the local .venv (reinstall with uv sync)
```

The `api` container talks to `db` over the compose network (`POSTGRES_HOST=db`,
set in `compose.yaml`) regardless of the `POSTGRES_HOST` in `.env` — `.env` itself
targets local/pytest (`POSTGRES_HOST=localhost`). On a fresh database, apply
migrations once the stack is up:
```bash
docker compose exec api uv run alembic upgrade head
```

Mailpit's service definition lives in its own [`mail/compose.yaml`](mail/README.md),
included automatically by `compose.yaml` — see that file for working with it
in isolation (`make mail-up` / `make mail-down` / `make mail-logs`).

**Local Development (without Docker):**
```bash
uv sync
uv run uvicorn main:app --reload
```

When running, services are available at:
- API: `http://localhost:8000` (interactive docs at `/docs`)
- Mailpit (captured outgoing emails): `http://localhost:8025`

### Development Conventions
- **Linting:** We use `ruff` for linting and formatting (`uv run ruff check .`, `uv run ruff format .`). The lint rule set (`pyproject.toml`) covers pycodestyle, Pyflakes, import sorting, pyupgrade, bugbear, simplify, comprehensions, async, and ruff-specific checks — with `B008` (FastAPI `Depends(...)` in argument defaults) and `RUF001-003` (ambiguous dashes in user-facing strings) intentionally ignored.
- **Testing:** `uv run pytest tests/ -q` (requires the `db` and `mailpit` containers running — `mailpit` is defined in [`mail/compose.yaml`](mail/README.md) and included automatically by `docker compose up`). Coverage: `uv run pytest --cov=app --cov-report=term-missing`.
- **API Docs:** When running, access the interactive docs at `/docs`.
- **Dev auth bypass:** `DISABLE_AUTH=true` in `.env` skips JWT checks and returns a seeded `dev@earnit.local` parent on every request. Seed is created on startup; run `uv run python -m src.dev.seed` to seed without starting the server. See `src/dev/seed.py`.

### Project Structure

```
backend/
├── main.py                   # FastAPI app, middleware, exception handlers, lifespan
├── src/
│   ├── api/                  # API entry point and routes
│   │   ├── auth/             # /api/v1/auth/* endpoints
│   │   ├── children.py       # /api/v1/children/* endpoints (child task/wallet view)
│   │   ├── profiles.py       # /api/v1/profiles/* endpoints
│   │   ├── tasks.py          # /api/v1/tasks/* endpoints (parent task management)
│   │   └── routes.py         # Centralized API router inclusion
│   ├── core/
│   │   └── config.py         # Settings (env-driven), token lifetimes, password/PIN rules
│   ├── db/
│   │   └── database.py       # Async SQLAlchemy engine + get_session dependency
│   ├── dependencies/         # Dependency injection guards (e.g., auth)
│   ├── dev/
│   │   └── seed.py           # Dev fixture seeding (dev@earnit.local + child); importable + standalone
│   ├── email/                # HTML email templates (verification code, etc.)
│   ├── mail.py               # fastapi-mail config
│   ├── models/               # SQLModel tables: User, Child, Task, TaskSubmission, WalletTransaction
│   ├── schemas/              # Pydantic request/response schemas
│   ├── security/             # Hashing, JWT creation/decoding
│   └── services/             # Core business logic: accounts, verification, tasks (crud/submissions/wallet)
├── alembic/                  # DB migrations
├── mail/                     # Mailpit compose service
└── tests/                    # pytest suite
```

### Data Model

Two tables (`src/models/auth.py`). Verification codes are **not** a table — they are stateless, derived from `users.updated_at` (see [Auth Flows](#auth-flows-step-by-step)).

#### `users` — parent account

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | client-generated `uuid4`, non-enumerable |
| `email` | str(320), unique | login identifier |
| `password_hash` | str(255) | bcrypt |
| `parent_pin_hash` | str(255), nullable | bcrypt; `NULL` until the PIN is set during onboarding |
| `pin_set_at` | datetime (tz), nullable | when the PIN was last set/changed |
| `family_name` | str(150), nullable | display name, e.g. *Família Silva* |
| `is_active` | bool, default `true` | soft-disable without a destructive delete |
| `onboarding_completed` | bool, default `false` | server-flipped once `parent_pin_hash` is set **and** ≥1 child exists |
| `email_verified_at` | datetime (tz), nullable | `NULL` = limbo (unverified); stamped on successful verify |
| `created_at` | datetime (tz) | registration time; **anchor for the limbo purge** |
| `updated_at` | datetime (tz) | row last-modified; **anchor for the stateless verification code** |

#### `children` — child profile (N per parent)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK → `users.id`) | `ON DELETE CASCADE` |
| `name` | str(100) | |
| `birth_date` | date, nullable | |
| `avatar_url` | str, nullable | |
| `is_active` | bool, default `true` | counts against `MAX_CHILDREN_PER_USER` even when inactive |
| `created_at` / `updated_at` | datetime (tz) | |

> Two columns pull double duty: `created_at` anchors the limbo purge, and `updated_at` anchors the verification code — rotating `updated_at` mints a fresh code and invalidates the old one.

#### `tasks` — task definitions (N per child, `src/models/tasks.py`)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK → `users.id`) | parent who created it — `ON DELETE CASCADE` |
| `child_id` | UUID (FK → `children.id`) | assigned child — `ON DELETE CASCADE` |
| `title` | varchar(150) | |
| `description` | text, nullable | |
| `task_type` | varchar(20) | `duty` \| `extra_task` |
| `reward_amount` | numeric(10,2) | always `0.00` for duties; > 0 for extra_tasks |
| `expires_at` | timestamptz, nullable | optional deadline (both types); once past, the child can't submit/resubmit and duties stop generating slots |
| `is_active` | bool, default `true` | soft-delete; inactive tasks stop generating slots |
| `created_at` / `updated_at` | timestamptz | |

#### `task_submissions` — submission slots (`src/models/tasks.py`)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `task_id` | UUID (FK → `tasks.id`) | `ON DELETE CASCADE` |
| `child_id` | UUID (FK → `children.id`) | denormalised for query ease — `ON DELETE CASCADE` |
| `scheduled_date` | date, nullable | set for auto-generated duty slots; `NULL` for extra_tasks |
| `submitted_at` | timestamptz, nullable | `NULL` = not yet submitted (duty slots start `NULL`) |
| `status` | varchar(20) | `pending` \| `approved` \| `rejected` |
| `reviewed_at` | timestamptz, nullable | stamped when a parent approves or rejects |
| `rejection_note` | text, nullable | free-text from the parent on rejection |

Unique constraint: `(task_id, scheduled_date)` — one duty slot per task per day.

#### `wallet_transactions` — earnings ledger (`src/models/tasks.py`)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `child_id` | UUID (FK → `children.id`) | `ON DELETE CASCADE` |
| `task_submission_id` | UUID (FK → `task_submissions.id`), nullable | `ON DELETE SET NULL` — keeps ledger intact if submission deleted |
| `amount` | numeric(10,2) | always positive |
| `transaction_type` | varchar(20) | `credit` \| `debit` |
| `description` | text, nullable | |
| `created_at` | timestamptz | |

> **Points display:** all amounts are stored as euros (`numeric(10,2)`). The frontend converts to points at **1 pt = €0.01** (multiply by 100). The API always returns euro values — no backend involvement in the conversion.

### Auth Flows (step by step)

Every flow shares one **stateless verification code** primitive (`src/services/verification/core.py`):

> A code is `HMAC(SECRET_KEY, "user_id:purpose:updated_at")`, valid for `VERIFICATION_CODE_EXPIRY_MINUTES` (10 min) from the `updated_at` anchor. **Nothing is persisted** — the server recomputes and compares at verify-time. The `purpose` (`account_verification` / `password_reset` / `pin_reset`) is baked into the HMAC, so a code from one flow can't be used in another. Because all purposes share the `updated_at` anchor, at most one code is live per account at a time — rotating for any purpose supersedes the rest.

#### 1. Registration & email verification

1. **`POST /api/v1/auth/register`** `{ email, password, family_name? }`
   - Validates the password policy (≥`PASSWORD_MIN_LENGTH` chars, upper + lower + digit + special).
   - Inserts a `users` row in **limbo** (`email_verified_at = NULL`); a duplicate email → `409`.
   - Derives an `account_verification` code from `updated_at` and emails it (dispatched *after* the response, off the critical path).
   - Sets a scoped `pending_verification_token` cookie. The row stays in limbo until verified; the daily maintenance sweep deletes it after `ACCOUNT_LIMBO_PURGE_HOURS` if still unverified. → `201`
2. **`POST /api/v1/auth/verify`** `{ code }` *(pending cookie required)*
   - `409` if already verified · `410` if the 10-min window elapsed · `400` if the code doesn't match.
   - On success: stamps `email_verified_at`, bumps `updated_at` (so the used code can't be replayed), and swaps the pending cookie for a full `access_token` session. A verified row no longer matches the purge sweep — no explicit defuse needed. → `200`
3. **`POST /api/v1/auth/verify/resend`** *(pending cookie required)*
   - `429` (with `retry_after_seconds`) while the current code is still live; otherwise rotates the anchor → new code, emailed off the response path. → `200`
4. **Abandoned verification:** logging in with correct credentials on a limbo account returns `403 account_unverified` + a fresh pending cookie, re-entering this flow. Once the limbo window passes with no verification, the next maintenance sweep deletes the account and frees the email — *as if never registered*.

#### 2. Forgot password

> Reuses the code primitive with `purpose = password_reset`. Two steps: request a code by email → validate the code and set a new password in one call.

1. **`POST /api/v1/auth/forgot-password`** `{ email }`
   - `429` (with `retry_after_seconds`) while a code is still live — a new code can only be issued once the previous window closes.
   - If an active window is not found and the account exists and is active: rotates the anchor and emails a `password_reset` code (dispatched after the response).
   - **Always** returns the same `200` body regardless of whether the email is registered or active — no enumeration.
2. **`POST /api/v1/auth/reset-password`** `{ email, code, new_password }` *(no auth required)*
   - Looks up the user by `email`, validates the code against their anchor. Unknown email, inactive account, expired window, and wrong code all collapse to the same `400 {"detail": "Invalid or expired code."}` — distinct responses here would leak account existence.
   - On success: sets `password_hash`, bumps `updated_at` (invalidating the used code so it can't be replayed). → `200`

#### 3. Parental PIN & Forgot PIN

> The parental PIN gates the child→parent dashboard switch on a shared device. Forgot-PIN reuses the code primitive with `purpose = pin_reset` — since the caller already holds a full `access_token` session, there's no anti-enumeration concern and failures are reported directly.

1. **`POST /api/v1/auth/pin`** `{ pin }` *(`access_token` required)*
   - Upserts `parent_pin_hash` (bcrypt) and stamps `pin_set_at`. Evaluates the onboarding trigger (`parent_pin_hash IS NOT NULL AND children count >= 1`) and flips `onboarding_completed` if newly satisfied. → `200`
2. **`POST /api/v1/auth/verify-pin`** `{ pin }` *(`access_token` required)*
   - `428` if no PIN has been set yet · `401` if the PIN doesn't match. On success returns `{"authenticated": true}` — **no new cookie is issued**; this is purely a green light for the frontend to render the parent dashboard. → `200`
3. **`POST /api/v1/auth/forgot-pin`** *(`access_token` required)*
   - `429` (with `retry_after_seconds`) while the current `pin_reset` code is still live; otherwise rotates the anchor and emails a fresh code. → `200`
4. **`POST /api/v1/auth/reset-pin`** `{ code, new_pin }` *(`access_token` required)*
   - `410` if the 10-min window elapsed · `400` if the code doesn't match. On success: sets `parent_pin_hash` + `pin_set_at`, bumps `updated_at` (invalidating the code), and re-evaluates the onboarding trigger. → `200`

#### 4. Child profiles & family view

> All routes require a full `access_token` session. `MAX_CHILDREN_PER_USER` (default 10) caps `children` rows per parent, counting active and deactivated profiles alike.

1. **`POST /api/v1/profiles/children`** `{ name, birth_date?, avatar_url? }` *(`access_token` required)*
   - `409 children_cap_reached` if the parent already has `MAX_CHILDREN_PER_USER` children (active + inactive). Otherwise creates the `Child` row and re-evaluates the onboarding trigger. → `201`
2. **`PATCH /api/v1/profiles/children/{child_id}`** *(`access_token` required)*
   - `404` if the child doesn't exist or belongs to another user · `409` if already inactive. On success, sets `is_active = false` (soft-delete; still counts toward the cap). → `200`
3. **`GET /api/v1/profiles/family`** *(`access_token` required)*
   - Returns the parent's profile (`id`, `family_name`, `onboarding_completed`) plus all `children` rows, active and inactive. → `200`

### Tests

The suite is split into two parts:

- **Essential unit suite** — `tests/` (`test_security.py`, `test_purge.py`):
  unit/service-level tests for the critical modules (bcrypt hashing, JWT
  tokens, the stateless verification-code engine, the auth dependencies, and
  the limbo-purge sweep). This is what NFR-05 asks for.
- **API suite** — `tests/api/` (one file per feature, e.g.
  `test_registration.py`, `test_login_logout.py`, `test_tasks.py`): endpoint
  flow tests that drive the real API with an httpx `AsyncClient` against the DB
  — the "bonus" integration-level coverage (guide §5.3).

`tests/conftest.py` (shared by both) centralizes the fixtures plus the example
account (`VALID_USER`), cookie-extraction (`extract_cookie`), and register+verify
(`register_and_verify`) helpers.

```bash
make test              # essential unit suite only
make test-api          # endpoint flow tests
make test-all          # everything
```

Tests need the `db` container running (they auto-create a `*_test` database);
email is mocked, so Mailpit isn't required.

### Logging

Plain stdlib `logging`, configured once at import time in `main.py` (a single
`logging.basicConfig(...)` call, before the `FastAPI` app is constructed). Every
module gets its own logger via `logging.getLogger(__name__)` and inherits the
global config — no per-module setup needed.

- **Format:** `%(asctime)s %(levelname)s %(name)s: %(message)s` to stdout (container-friendly — Docker/Compose captures stdout as the log stream).
- **Level:** `LOG_LEVEL` env var (default `INFO`; see `.env.example`). Set to `DEBUG` locally for noisier output, `WARNING` in CI if the test logs get too busy.
- **What gets logged** — one line per security-relevant or lifecycle event, identified by `user_id` (a non-enumerable UUID) once a request resolves to an account:
  - **Auth lifecycle:** registration, account verification (success / expired / invalid code), verification resend (incl. `429` rate-limit), login (success / invalid credentials / disabled / unverified), logout.
  - **Password & PIN recovery:** forgot-password request + rate-limit (429), password reset completion, PIN set, PIN verification (success/failure), forgot/reset-PIN (incl. expired/invalid code and `429` rate-limit).
  - **Profiles:** child profile created (incl. `409 children_cap_reached`), child profile deactivated.
  - **Background lifecycle:** the daily maintenance sweep (limbo-account purge count, duty-slot generation), onboarding-completion trigger firing.
- **What never gets logged:** verification codes, passwords, PINs, password/PIN hashes, JWTs, or raw email addresses. On login failure specifically, nothing identifying is logged at all (logging `user_id` only for *known* accounts would create a log-volume signal that distinguishes registered from unregistered emails — the same anti-enumeration concern as the API response itself).

### Connecting the Frontend

The full request/response contract for the frontend is documented in **[`docs/api-contract.md`](../docs/api-contract.md)** at the repo root — keep it in sync as new chunks ship. Key points to know up front:

- **Cookie-based auth, not tokens in JS.** All session state lives in `HttpOnly` cookies set by the backend (`pending_verification_token` during the verification step, `access_token` for a full session). The frontend never reads or stores these directly.
- **Every request to the API must send `credentials: 'include'`** (fetch) or `withCredentials: true` (axios), or the cookie won't be sent and you'll get a `401` even when "logged in".
- **Two-stage session model:** after `POST /auth/register` (or a login against an unverified account) the client is in a *pending verification* state — only `/auth/verify` and `/auth/verify/resend` are reachable. Once `/auth/verify` succeeds, the cookie is swapped for a full `access_token` session.
- **Structured 403 errors** (`account_disabled`, `account_unverified`) are returned as top-level JSON (`{"error": "...", "message": "...", ...}`), not nested under `"detail"` — see `docs/api-contract.md` for the exact shapes per endpoint.
- **Password reset is stateless** — no session cookie is issued between `forgot-password` and `reset-password`. The caller submits `{ email, code, new_password }` in a single `POST /reset-password` call; the code validates identity directly.
- **Dev tooling:** verification codes are never returned by the API or logged — during local development, read them from the Mailpit UI at `http://localhost:8025`.

### Task Management Flows (step by step)

All task-management endpoints require a full `access_token` session (parent). `child_id` path parameters are validated against `current_user.id` — a parent can only read/write their own children's data; cross-user access returns `404`.

#### 1. Parent — task CRUD (`/api/v1/tasks`)

1. **`POST /api/v1/tasks`** `{ child_id, title, description?, task_type, reward_amount?, expires_at? }` *(`access_token` required)*
   - Validates `child_id` belongs to the authenticated parent.
   - Enforces reward rules: `duty` → `reward_amount` must be `0`; `extra_task` → `reward_amount` must be > 0.
   - Creates the `tasks` row. → `201 TaskResponse`
2. **`GET /api/v1/tasks`** *(`access_token` required)*
   - Query params: `child_id?`, `task_type?` (`duty` | `extra_task`), `is_active?` (bool).
   - Returns all matching tasks owned by the authenticated parent. → `200 list[TaskResponse]`
3. **`PATCH /api/v1/tasks/{task_id}`** `{ title?, description?, expires_at?, is_active? }` *(`access_token` required)*
   - `404` if the task doesn't exist or belongs to another user. Partial update — only provided fields are changed. → `200 TaskResponse`
4. **`DELETE /api/v1/tasks/{task_id}`** *(`access_token` required)*
   - Soft-delete: sets `is_active = false`. Inactive tasks stop generating daily slots but existing submissions are preserved. → `200 TaskResponse`

#### 2. Parent — submission review (`/api/v1/tasks/submissions`)

1. **`GET /api/v1/tasks/submissions`** *(`access_token` required)*
   - Query params: `child_id?`, `status?` (`pending` | `approved` | `rejected`).
   - Returns all submissions for the parent's children, newest first. → `200 list[SubmissionResponse]`
2. **`POST /api/v1/tasks/submissions/{submission_id}/approve`** *(`access_token` required)*
   - `404` if submission doesn't belong to the parent's child · `409` if already approved or not in `pending` state.
   - Stamps `reviewed_at`, sets `status = approved`. If `reward_amount > 0`, atomically inserts a `wallet_transactions (credit)` row in the same transaction. → `200 SubmissionResponse`
3. **`POST /api/v1/tasks/submissions/{submission_id}/reject`** `{ rejection_note? }` *(`access_token` required)*
   - `404` if submission doesn't belong to the parent's child · `409` if not in `pending` state.
   - Stamps `reviewed_at`, sets `status = rejected`, stores `rejection_note`. → `200 SubmissionResponse`
4. **`POST /api/v1/tasks/submissions/approve-all`** `{ child_id? }` *(`access_token` required)*
   - Batch-approves all `pending` submissions for the parent (optionally filtered to one child). Each approval atomically credits the wallet if `reward_amount > 0`. → `200 { approved: N }`

> **Router ordering note:** `approve-all` is registered *before* `/{submission_id}/approve` in FastAPI to prevent the literal string `"approve-all"` being matched as a UUID path parameter.

> **Task expiry:** expiry blocks the *child*, not the *parent*. Once a task is past its `expires_at`, the child can no longer `submit` or resubmit (both → `410`), but a submission still `pending` stays reviewable indefinitely — the parent may `approve` (success) or `reject` (failure) it any time. So a submission resolves only on approval, or when the task expires without one.

#### 3. Child — task & wallet view (`/api/v1/children/{child_id}/...`)

1. **`GET /api/v1/children/{child_id}/tasks`** *(`access_token` required)*
   - Returns the child's active tasks enriched with submission state:
     - **Duties:** today's slot (`scheduled_date = today`), or `null` if the background job hasn't run yet.
     - **Extra tasks:** the latest submission (any status), or `null` if never submitted.
   - → `200 list[ChildTaskResponse]`
2. **`POST /api/v1/children/{child_id}/tasks/{task_id}/submit`** *(`access_token` required)*
   - For `duty`: stamps `submitted_at = now()` on today's slot, sets `status = pending`. `409` if already submitted or no slot exists for today.
   - For `extra_task`: creates a new `task_submissions` row with `status = pending`. `409` if a `pending` or `approved` submission already exists.
   - `410` if the task has expired (`expires_at` in the past) — the child can no longer submit.
   - → `201 SubmissionResponse`
3. **`PATCH /api/v1/children/{child_id}/submissions/{submission_id}`** *(`access_token` required)*
   - Resubmit after a parent rejection. Resets `status → pending`, clears `rejection_note`, stamps `submitted_at = now()` on the **same** submission row (no new row created). A rejected submission can be resubmitted (and re-rejected) any number of times **while the task is live** — rejection is only terminal once the task expires.
   - `410` if the task has expired (the retry window is closed) · `404` if submission doesn't belong to the child · `409` if status is not `rejected`. → `200 SubmissionResponse`
4. **`GET /api/v1/children/{child_id}/wallet`** *(`access_token` required)*
   - Returns `{ child_id, balance, transactions[] }`. Balance is computed as `SUM(amount) WHERE type=credit` − `SUM(amount) WHERE type=debit` via a single DB query.
   - → `200 WalletBalanceResponse`

#### 4. Daily maintenance background loop

On every app startup (`lifespan` in `main.py`), `start_daily_maintenance()` runs:
1. Immediately runs one maintenance pass — `generate_daily_duty_slots()` creates today's `task_submissions` rows for all active, non-expired duties (idempotent: skips any `(task_id, scheduled_date)` that already exists), then `purge_expired_limbo_accounts()` deletes every account still unverified past `ACCOUNT_LIMBO_PURGE_HOURS` in one `DELETE` (CASCADE removes their children).
2. Spawns an `asyncio.Task` (`_maintenance_task`) that loops, sleeping until the next UTC midnight, and repeats the pass daily.

The task reference is stored at module level in `src/services/tasks/submissions.py` to prevent garbage collection. `stop_daily_maintenance()` cancels it cleanly on shutdown. Tests call `generate_daily_duty_slots(session)` and `purge_expired_limbo_accounts(session)` directly (bypassing the background loop).
