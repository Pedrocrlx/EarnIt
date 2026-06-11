# EarnIt Backend

This directory contains the FastAPI backend for the EarnIt application.

## Tech Stack
- **Language:** Python 3.14+
- **Framework:** FastAPI
- **Database:** PostgreSQL 17
- **ORM:** SQLModel
- **Migrations:** Alembic
- **Mail:** fastapi-mail (SMTP, dev via Mailpit)
- **Scheduling:** APScheduler (background purge job)
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
├── main.py                   # FastAPI app, middleware, exception handlers, lifespan/scheduler
├── app/
│   ├── config.py             # Settings (env-driven), token lifetimes, password/PIN rules
│   ├── database.py           # Async SQLAlchemy engine + get_session dependency
│   ├── mail.py                # fastapi-mail config (SMTP + Jinja2 templates)
│   ├── models/models.py      # SQLModel tables: User, Child, EmailVerification
│   ├── schemas/auth.py       # Pydantic request/response schemas + validators
│   ├── security/
│   │   ├── hashing.py        # bcrypt hashing for passwords/PINs/codes (non-blocking)
│   │   ├── tokens.py         # JWT creation/decoding (access + pending-verification)
│   │   └── codes.py          # Verification code generation
│   ├── dependencies/auth.py  # get_current_user / get_pending_verification_user guards
│   ├── routers/auth.py       # /api/v1/auth/* endpoints
│   ├── jobs/purge.py         # Scheduled "limbo account" purge sweep
│   └── templates/email/      # HTML email templates (verification code, etc.)
├── alembic/                   # DB migrations
└── tests/                     # pytest suite (httpx AsyncClient against the app)
```

## Epic 1 (Authentication & Profiles) — Progress

Implementation follows `specs/epic1/spec.md`, split into chunks:

| Chunk | Scope | Status |
|---|---|---|
| 0 | Infrastructure: FastAPI/CORS boilerplate, async DB engine, Alembic migrations, fastapi-mail + email templates, APScheduler limbo-purge job | ✅ Done |
| 1 | Crypto & auth utilities: JWT tokens, bcrypt hashing, verification codes, request schemas, `get_current_user` / `get_pending_verification_user` guards | ✅ Done |
| 2 | `POST /auth/register`, `POST /auth/verify`, `POST /auth/verify/resend` | ✅ Done |
| 3 | `POST /auth/login`, `POST /auth/logout` | ✅ Done |
| 4 | `POST /auth/pin`, `POST /auth/verify-pin` (parental PIN gate) | ⏳ Not started |
| 5 | `POST/PATCH /profiles/children`, `GET /profiles/family` | ⏳ Not started |
| 6 | Final ruff lint pass across all modules | ⏳ Not started |

All implemented endpoints are covered by tests in `tests/` (one file per chunk, e.g. `test_chunk2_registration.py`, `test_chunk3_login_logout.py`).

## Connecting the Frontend

The full request/response contract for the frontend is documented in **[`docs/api-contract.md`](../docs/api-contract.md)** at the repo root — keep it in sync as new chunks ship. Key points to know up front:

- **Cookie-based auth, not tokens in JS.** All session state lives in `HttpOnly` cookies set by the backend (`pending_verification_token` during the verification step, `access_token` for a full session). The frontend never reads or stores these directly.
- **Every request to the API must send `credentials: 'include'`** (fetch) or `withCredentials: true` (axios), or the cookie won't be sent and you'll get a `401` even when "logged in".
- **Two-stage session model:** after `POST /auth/register` (or a login against an unverified account) the client is in a *pending verification* state — only `/auth/verify` and `/auth/verify/resend` are reachable. Once `/auth/verify` succeeds, the cookie is swapped for a full `access_token` session.
- **Structured 403 errors** (`account_disabled`, `account_unverified`) are returned as top-level JSON (`{"error": "...", "message": "...", ...}`), not nested under `"detail"` — see `docs/api-contract.md` for the exact shapes per endpoint.
- **Dev tooling:** verification codes are never returned by the API or logged — during local development, read them from the Mailpit UI at `http://localhost:8025`.
