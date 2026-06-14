# AI Usage — Backend

This document declares AI tool usage specific to the `backend/` directory, as
required by `guide.md` (§10.2) and summarized in the root [README.md](../README.md#ai-usage-section).

## Phase 3 — overview

| Tool | Purpose | Scope |
|---|---|---|
| **Claude Code (Sonnet 4.6)** | Implement Epic 1 (Authentication & Profiles) — registration/email verification, login/logout, forgot-password, parental PIN set/verify/reset, and child profile management — following the chunked breakdown in `specs/epic1/spec.md`. | `app/routers/auth/`, `app/routers/profiles.py`, `app/services/`, `app/dependencies/`, `app/security/` |
| **Claude Code (Sonnet 4.6)** | Write and refactor the `pytest` suite (one file per feature), including coverage-driven edge-case tests for the auth dependencies and shared fixtures/helpers. | `tests/` |
| **Claude Code (Sonnet 4.6)** | Apply `ruff` lint/format fixes and keep documentation in sync with the implemented code. | `backend/README.md`, `specs/epic1/spec.md` |
| **Claude Code (Sonnet 4.6)** | Add application logging (stdlib `logging`, config + per-module loggers across auth/profile flows), document it, and produce a 240-question defense-prep Q&A covering every technical decision in the backend. | `app/logging_config.py`, `app/config.py`, `app/routers/`, `app/services/accounts.py`, `backend/README.md`, `backend/DEFENSE_QA.md` |

All AI-assisted code was reviewed and is understood by the submitting team
member; see the root README's AI Usage section for tooling used outside the
backend (documentation, infrastructure, design).

## Phase 3 — detail (where, what, why)

### 1. Crypto & auth utilities (Chunk 1)
- **Where:** `app/security/hashing.py`, `app/security/tokens.py`, `app/services/verification/core.py`, `app/dependencies/auth.py`, `app/schemas/auth.py`.
- **What:** Async-safe bcrypt wrappers for password/PIN hashing, JWT creation/decoding for the three cookie scopes (`full`, `verify`, `password_reset`), and the stateless HMAC verification-code engine (`HMAC(SECRET_KEY, "user_id:purpose:updated_at")`) with its expiry/cooldown helpers — the shared primitive every later flow builds on.
- **Why:** This is the highest-stakes, most reusable layer — getting the cookie scopes and the stateless-code math right once, with AI doing the repetitive crypto/boilerplate correctly on the first pass, meant every subsequent chunk (registration, password reset, PIN reset) could reuse it without re-deriving the same logic three times.

### 2. Registration & email verification (Chunk 2)
- **Where:** `app/routers/auth/register.py`, `app/routers/auth/verification.py`, `app/services/verification/account.py`, `app/services/accounts.py` (limbo-purge task), `app/templates/email/verification_code.html`.
- **What:** `POST /register` (creates a "limbo" account, arms a durable purge task, emails a code), `POST /verify` (redeems the code, promotes to a full session), `POST /verify/resend` (rate-limited rotation).
- **Why:** The durable, self-disarming background-task design for limbo-account purging (surviving process restarts via `users.created_at`) is the kind of asyncio pattern that's easy to get subtly wrong (task GC, double-purge races); Claude Code implemented and then test-drove this against the spec in `specs/epic1/spec.md` so the team could focus review on the *design* rather than the asyncio plumbing.

### 3. Login & logout (Chunk 3)
- **Where:** `app/routers/auth/login.py`, `app/routers/auth/logout.py`.
- **What:** Credential check with a constant-time dummy-hash comparison for unknown emails (no user-enumeration via timing), the `is_active` → `email_verified_at` ordering for 403 responses, and cookie issuance/clearing.
- **Why:** Anti-enumeration login flows have a lot of "looks right but leaks a bit timing/response wise" failure modes; this was an area where having the AI draft the implementation *and* the adversarial test cases (Q177-184 in `DEFENSE_QA.md`) side-by-side made it easier to spot-check both at once.

### 4. Forgot/reset password (Chunk 4)
- **Where:** `app/routers/auth/forgot_password.py`, `app/routers/auth/reset_password.py`, `app/services/verification/password_reset.py`, `app/templates/email/password_reset_code.html`.
- **What:** The three-step reset flow (`/forgot-password` → `/forgot-password/verify` → `/reset-password`), reusing the Chunk 1 code primitive with `purpose=password_reset`, collapsing all failure cases into one generic `400`/`200` to avoid account-existence leaks.
- **Why:** Mechanical reuse of an already-reviewed primitive (Chunk 1) across a new flow — low-risk, high-volume boilerplate where AI assistance saved the most time relative to review effort.

### 5. Parental PIN + PIN reset (Chunk 5)
- **Where:** `app/routers/auth/pin.py`, `app/routers/auth/pin_reset.py`, `app/services/verification/pin_reset.py`, `app/templates/email/pin_reset_code.html`.
- **What:** `POST /pin` (set/upsert), `POST /verify-pin` (dashboard-switch gate), `POST /forgot-pin` / `POST /reset-pin` (email-based recovery, `purpose=pin_reset`), plus the shared `maybe_complete_onboarding` trigger (`parent_pin_hash` set **and** ≥1 child).
- **Why:** Same reuse rationale as Chunk 4, plus correctly wiring the onboarding trigger from *two* independent entry points (`/pin` and `/profiles/children`) without duplicating the check — AI handled extracting it into `app/services/accounts.maybe_complete_onboarding` so both call sites stay in sync.

### 6. Child profiles & family view (Chunk 6)
- **Where:** `app/routers/profiles.py`, `app/schemas/profiles.py`.
- **What:** `POST /profiles/children` (with `MAX_CHILDREN_PER_USER` cap, counting active + inactive), `PATCH /profiles/children/{id}` (soft-deactivate), `GET /profiles/family` (family summary).
- **Why:** Straightforward CRUD over an already-modeled table — AI-generated first draft plus tests, reviewed for the cap-counting edge case (deactivated children still count) and the 404-vs-403 ownership check.

### 7. Final lint pass (Chunk 7)
- **Where:** repo-wide (`backend/`).
- **What:** A single `ruff check`/`ruff format` pass after all chunks landed, fixing import ordering, datetime-handling (`datetime.now(UTC)` consistency), and a few error-message wording inconsistencies flagged by `RUF`/`B`/`SIM` rules.
- **Why:** Cheap, mechanical, high-volume — exactly the kind of pass where AI assistance has the best effort/risk ratio; the diff was reviewed as a whole rather than file-by-file since lint auto-fixes are low-risk by construction.

### 8. Test suite (`tests/`)
- **Where:** `tests/conftest.py` (shared fixtures: `VALID_USER`, `extract_cookie`, `register_and_verify`, `mock_mail`, `db_session`/`client`/`_cleanup_purge_tasks`) plus one file per feature (`test_registration.py`, `test_login_logout.py`, `test_forgot_password.py`, `test_pin.py`, `test_profiles.py`, `test_purge.py`, `test_security.py`).
- **What:** ~109 async tests against the real FastAPI app via `httpx.AsyncClient` + a real (test) Postgres database — every endpoint's happy path, every documented error code, and edge cases like rate-limit cooldowns, expired codes, and cap enforcement.
- **Why:** AI wrote the bulk of the test bodies from the spec's documented status codes/response shapes, which (a) gave near-complete coverage of the documented contract for free, and (b) doubled as a check on the implementation itself — several edge cases (e.g. deactivated children still counting toward the cap) were caught *because* the test was written from the spec independently of the implementation, not copied from it.

### 9. Logging (this session)
- **Where:** `app/logging_config.py` (new), `app/config.py` (`LOG_LEVEL` setting), `main.py` (wiring + startup/shutdown logs), and a `logging.getLogger(__name__)` + targeted `logger.info`/`logger.warning` calls added across `app/routers/auth/*.py`, `app/routers/profiles.py`, and `app/services/accounts.py`.
- **What:** One stdlib `logging` config (plain-text, `LOG_LEVEL`-controlled) shared by every module, logging ~20 security/lifecycle events (registration, verify, login/logout, password/PIN reset, profile create/deactivate, limbo purges, onboarding completion) identified by `user_id`, with an explicit rule never to log secrets (codes/passwords/PINs/hashes/JWTs) or, on login failure, any identifier at all (anti-enumeration).
- **Why:** This was discussed and designed collaboratively first (what to log, what never to log, why `updated_at` can't be replaced by a log-derived anchor) before any code was written — AI's role here was implementing an already-agreed design consistently across ~10 files, which is exactly the kind of repetitive-but-easy-to-miss-one-spot task where consistency matters more than originality.

### 10. Documentation — `DEFENSE_QA.md` and `README.md`
- **Where:** `backend/DEFENSE_QA.md` (new, 240 Q&A across 21 sections), `backend/README.md` (Logging section, Epic 1 progress table, project structure).
- **What:** A defense-prep document answering "why" for every technical decision visible in the code (stack choices, ORM, migrations, hashing, verification codes, anti-enumeration, background tasks, CI, logging, and AI usage itself), grounded by reading the actual implementation rather than written from memory.
- **Why:** Preparing to defend a project means anticipating "why did you do X this way" questions — having AI draft grounded answers from the real code (then reviewed by the team) is faster than writing 240 answers from scratch, and the grounding step (reading each file before answering) doubled as an informal code-consistency check.

## Review note

All AI-assisted code was reviewed and is understood by the submitting team
member. AI assistance here was scoped to *implementing* designs and contracts
specified by the team (`specs/epic1/spec.md`, `docs/api-contract.md`) and to
mechanical/documentation work (linting, tests-from-spec, defense Q&A) — not to
making architectural decisions. See the root README's AI Usage section for
tooling used outside the backend (documentation, infrastructure, design).
