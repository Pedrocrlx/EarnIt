# EarnIt Backend

This directory contains the FastAPI backend for the EarnIt application.

## Tech Stack
- **Language:** Python 3.14+
- **Framework:** FastAPI
- **Database:** PostgreSQL 17
- **ORM:** SQLModel
- **Migrations:** Alembic
- **Mail:** fastapi-mail (SMTP, dev via Mailpit)
- **Background work:** asyncio tasks (durable limbo-purge, re-armed on startup)
- **Package Manager:** [uv](https://github.com/astral-sh/uv)

## Getting Started

### Prerequisites
- [Docker & Docker Compose](https://docs.docker.com/get-docker/)
- [uv](https://github.com/astral-sh/uv)

### Running the Backend Stack

**Using Docker:**
```bash
make up-ba      # Start API, DB, and Mailpit
make down       # Stop the stack
```

**Local Development (without Docker):**
```bash
uv sync
uv run uvicorn main:app --reload
```

When running, services are available at:
- API: `http://localhost:8000` (interactive docs at `/docs`)
- Mailpit (captured outgoing emails): `http://localhost:8025`

## Development Conventions
- **Linting:** We use `ruff` for linting and formatting (`uv run ruff check .`, `uv run ruff format .`).
- **Testing:** `uv run pytest tests/ -q` (requires the `db` and `mailpit` containers running).
- **API Docs:** When running, access the interactive docs at `/docs`.

## Project Structure

```
backend/
├── main.py                   # FastAPI app, middleware, exception handlers, lifespan
├── app/
│   ├── config.py             # Settings (env-driven), token lifetimes, password/PIN rules
│   ├── database.py           # Async SQLAlchemy engine + get_session dependency
│   ├── mail.py                # fastapi-mail config (SMTP + Jinja2 templates)
│   ├── models/models.py      # SQLModel tables: User, Child
│   ├── schemas/
│   │   ├── auth.py            # Pydantic request/response schemas + validators
│   │   └── profiles.py        # Child profile request schemas
│   ├── security/
│   │   ├── hashing.py        # bcrypt hashing for passwords/PINs (non-blocking)
│   │   └── tokens.py         # JWT creation/decoding (access + pending-verification)
│   ├── services/
│   │   ├── accounts.py       # Account lifecycle: limbo-purge task + onboarding-completion trigger
│   │   └── verification/     # Stateless verification codes (no DB rows)
│   │       ├── core.py       # global HMAC engine (generate/verify/expiry/cooldown)
│   │       ├── account.py    # account-verification orchestration (+ email)
│   │       ├── password_reset.py  # password-reset orchestration (+ email)
│   │       └── pin_reset.py  # PIN-reset orchestration (+ email)
│   ├── dependencies/auth.py  # get_current_user / get_pending_verification_user / get_password_reset_user guards
│   ├── routers/
│   │   ├── auth/              # /api/v1/auth/* endpoints (register, verify, login, logout, password_reset, pin)
│   │   └── profiles.py        # /api/v1/profiles/* endpoints (children, family)
│   └── templates/email/      # HTML email templates (verification code, etc.)
├── alembic/                   # DB migrations
└── tests/                     # pytest suite (httpx AsyncClient against the app)
```

## Data Model

Two tables (`app/models/models.py`). Verification codes are **not** a table — they are stateless, derived from `users.updated_at` (see [Auth Flows](#auth-flows-step-by-step)).

### `users` — parent account

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

### `children` — child profile (N per parent)

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

## Auth Flows (step by step)

Every flow shares one **stateless verification code** primitive (`app/services/verification/core.py`):

> A code is `HMAC(SECRET_KEY, "user_id:purpose:updated_at")`, valid for `VERIFICATION_CODE_EXPIRY_MINUTES` (10 min) from the `updated_at` anchor. **Nothing is persisted** — the server recomputes and compares it. The `purpose` (`account_verification` / `password_reset` / `pin_reset`) is baked into the HMAC, so a code from one flow can't be used in another. Because all purposes share the `updated_at` anchor, at most one code is live per account at a time (rotating for any purpose supersedes the rest) — acceptable for MVP, where these flows don't overlap.

### 1. Registration & email verification — ✅ Implemented

1. **`POST /api/v1/auth/register`** `{ email, password, family_name? }`
   - Validates the password policy (≥`PASSWORD_MIN_LENGTH` chars, upper + lower + digit + special).
   - Inserts a `users` row in **limbo** (`email_verified_at = NULL`); a duplicate email → `409`.
   - Derives an `account_verification` code from `updated_at` and emails it (dispatched *after* the response, off the critical path).
   - Sets a scoped `pending_verification_token` cookie and **arms a durable purge task** (deletes this account after `ACCOUNT_LIMBO_PURGE_HOURS` unless verified first). → `201`
2. **`POST /api/v1/auth/verify`** `{ code }` *(pending cookie required)*
   - `409` if already verified · `410` if the 10-min window elapsed · `400` if the code doesn't match.
   - On success: stamps `email_verified_at`, bumps `updated_at` (so the used code can't be replayed), **cancels the purge task**, and swaps the pending cookie for a full `access_token` session. → `200`
3. **`POST /api/v1/auth/verify/resend`** *(pending cookie required)*
   - `429` (with `retry_after_seconds`) while the current code is still live; otherwise rotates the anchor → new code, emailed off the response path. → `200`
4. **Abandoned verification:** logging in with correct credentials on a limbo account returns `403 account_unverified` + a fresh pending cookie, re-entering this flow. If the limbo window passes with no verification, the purge task deletes the account and frees the email — *as if never registered*.

### 2. Parental PIN & Forgot PIN — ✅ Implemented

> The parental PIN gates the child→parent dashboard switch on a shared device. Forgot-PIN reuses the code primitive with `purpose = pin_reset` — since the caller already holds a full `access_token` session, there's no anti-enumeration concern.

1. **`POST /api/v1/auth/pin`** `{ pin }` *(`access_token` required)*
   - Upserts `parent_pin_hash` (bcrypt) and stamps `pin_set_at`. Evaluates the onboarding trigger (`parent_pin_hash IS NOT NULL AND children count >= 1`) and flips `onboarding_completed` if newly satisfied. → `200`
2. **`POST /api/v1/auth/verify-pin`** `{ pin }` *(`access_token` required)*
   - `428` if no PIN has been set yet · `401` if the PIN doesn't match. On success returns `{"authenticated": true}` — **no new cookie is issued**; this is purely a green light for the frontend to render the parent dashboard. → `200`
3. **`POST /api/v1/auth/forgot-pin`** *(`access_token` required)*
   - `429` (with `retry_after_seconds`) while the current `pin_reset` code is still live; otherwise rotates the anchor and emails a fresh code. → `200`
4. **`POST /api/v1/auth/reset-pin`** `{ code, new_pin }` *(`access_token` required)*
   - `410` if the 10-min window elapsed · `400` if the code doesn't match. On success: sets `parent_pin_hash` + `pin_set_at`, bumps `updated_at` (invalidating the code), and re-evaluates the onboarding trigger. → `200`

### 3. Forgot password — ✅ Implemented

> Reuses the code primitive with `purpose = password_reset`. Three steps: request a code by email → verify the code → set a new password.

1. **`POST /api/v1/auth/forgot-password`** `{ email }`
   - Looks up the account by email. If found and `is_active`, rotates its anchor (`updated_at = now()`) and emails a `password_reset` code (dispatched after the response).
   - **Always** returns the same `200` body — `{"status": "success", "message": "If that email is registered, a password reset code has been sent."}` — regardless of whether the email is registered, active, or not. No enumeration.
2. **`POST /api/v1/auth/forgot-password/verify`** `{ email, code }`
   - Recomputes the `password_reset` code from the user's anchor and compares it. Unknown email, expired window (>10 min), and wrong code are all collapsed into the same `400 {"detail": "Invalid or expired code."}` — distinct outcomes here would leak account existence.
   - On success: issues a `password_reset_token` cookie (scope `password_reset`, path-scoped to `/api/v1/auth/reset-password`, lifetime `VERIFICATION_CODE_EXPIRY_MINUTES`). → `200`
3. **`POST /api/v1/auth/reset-password`** `{ new_password }` *(`password_reset_token` cookie required)*
   - Validates the new password against the same policy as registration, sets `password_hash`, and bumps `updated_at` (which also invalidates the now-used code). Clears the `password_reset_token` cookie. → `200`

### 4. Child profiles & family view — ✅ Implemented

> All three routes require a full `access_token` session. `MAX_CHILDREN_PER_USER` (default 10) caps `children` rows per parent, counting active and deactivated profiles alike.

1. **`POST /api/v1/profiles/children`** `{ name, birth_date?, avatar_url? }` *(`access_token` required)*
   - `409 children_cap_reached` if the parent already has `MAX_CHILDREN_PER_USER` children (active + inactive). Otherwise creates the `Child` row and re-evaluates the onboarding trigger. → `201`
2. **`PATCH /api/v1/profiles/children/{child_id}`** *(`access_token` required)*
   - `404` if the child doesn't exist or belongs to another user · `409` if already inactive. On success, sets `is_active = false` (soft-delete; still counts toward the cap). → `200`
3. **`GET /api/v1/profiles/family`** *(`access_token` required)*
   - Returns the parent's profile (`id`, `family_name`, `onboarding_completed`) plus all `children` rows, active and inactive. → `200`

## Epic 1 (Authentication & Profiles) — Progress

Implementation follows `specs/epic1/spec.md`, split into chunks:

| Chunk | Scope | Status |
|---|---|---|
| 0 | Infrastructure: FastAPI/CORS boilerplate, async DB engine, Alembic migrations, fastapi-mail + email templates, durable limbo-purge background task | ✅ Done |
| 1 | Crypto & auth utilities: JWT tokens, bcrypt hashing, stateless verification-code service, request schemas, `get_current_user` / `get_pending_verification_user` guards | ✅ Done |
| 2 | `POST /auth/register`, `POST /auth/verify`, `POST /auth/verify/resend` | ✅ Done |
| 3 | `POST /auth/login`, `POST /auth/logout` | ✅ Done |
| 4 | `POST /auth/pin`, `POST /auth/verify-pin`, `POST /auth/forgot-pin`, `POST /auth/reset-pin` (parental PIN gate + reset) | ✅ Done |
| 5 | `POST/PATCH /profiles/children`, `GET /profiles/family` | ✅ Done |
| 6 | Final ruff lint pass across all modules | ⏳ Not started |
| 7 | `POST /auth/forgot-password`, `POST /auth/forgot-password/verify`, `POST /auth/reset-password` | ✅ Done |

All implemented endpoints are covered by tests in `tests/` (one file per chunk, e.g. `test_chunk2_registration.py`, `test_chunk3_login_logout.py`).

## Connecting the Frontend

The full request/response contract for the frontend is documented in **[`docs/api-contract.md`](../docs/api-contract.md)** at the repo root — keep it in sync as new chunks ship. Key points to know up front:

- **Cookie-based auth, not tokens in JS.** All session state lives in `HttpOnly` cookies set by the backend (`pending_verification_token` during the verification step, `access_token` for a full session). The frontend never reads or stores these directly.
- **Every request to the API must send `credentials: 'include'`** (fetch) or `withCredentials: true` (axios), or the cookie won't be sent and you'll get a `401` even when "logged in".
- **Two-stage session model:** after `POST /auth/register` (or a login against an unverified account) the client is in a *pending verification* state — only `/auth/verify` and `/auth/verify/resend` are reachable. Once `/auth/verify` succeeds, the cookie is swapped for a full `access_token` session.
- **Structured 403 errors** (`account_disabled`, `account_unverified`) are returned as top-level JSON (`{"error": "...", "message": "...", ...}`), not nested under `"detail"` — see `docs/api-contract.md` for the exact shapes per endpoint.
- **Dev tooling:** verification codes are never returned by the API or logged — during local development, read them from the Mailpit UI at `http://localhost:8025`.
