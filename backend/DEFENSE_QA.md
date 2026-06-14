# Backend Defense Q&A

A "senior tutor" style interrogation of every technical decision made in the
`backend/` directory so far (Epic 1 — Authentication & Profiles). Each answer
is grounded in the actual code/config in this repo. Use this to prepare for
a project defense — if a question feels too basic, that's intentional: "no
matter how simple" was the brief.

**240 Q&A pairs**, organized into 21 topic sections (language/runtime, web
framework, ORM, database, migrations, package management, linting, testing,
containerization, email, JWT/cookies, hashing, verification codes,
anti-enumeration, background tasks, profiles/onboarding, CI/CD, project
structure, error handling, AI usage, logging & observability).

---

## 1. Language & Python Version

**Q1. Why Python for the backend at all, given the team also knows JS (frontend is React/Bun)?**
Python has the most mature async web ecosystem for this kind of CRUD-heavy,
I/O-bound app (FastAPI + SQLAlchemy + asyncpg), and it's the language the
course's backend track is built around. Splitting frontend/backend languages
also forces a real HTTP contract between them instead of accidentally sharing
code, which matches the "Contract-first... REST JSON" rule in `AGENTS.md` §2.

**Q2. Why Python 3.14 specifically, and not 3.11/3.12 which are more "battle-tested"?**
`AGENTS.md` pins it explicitly ("3.14+ Leveraging improved f-strings"), and
`pyproject.toml` sets `requires-python = ">=3.14"` / `target-version = "py314"`
for Ruff. For a brand-new project with no legacy dependency baggage, there's
no cost to starting on the latest interpreter, and it lets Ruff's `UP`
(pyupgrade) rules enforce the newest idiomatic syntax from day one.

**Q3. What "improved f-strings" feature actually matters here?**
Python 3.12+ allows reusing the same quote character inside an f-string's
expression and across nested braces (PEP 701), and 3.14 continues refining
f-string formatting/templating. In practice this mostly affects readability of
interpolated strings (e.g. building HMAC messages, error strings) rather than
being load-bearing — it's a "free" improvement from being on the latest
interpreter.

**Q4. Where do you actually use an f-string in a security-sensitive spot?**
`app/services/verification/core.py`: `message = f"{user_id}:{purpose}:{anchor.isoformat()}".encode()`.
This builds the HMAC input for verification codes — a single composed string
that's then signed with `SECRET_KEY`. Getting the format exactly right and
stable matters because the same format must be reproduced byte-for-byte at
verify time.

**Q5. Is the codebase fully type-annotated? Why does that matter with FastAPI?**
Yes — function signatures, SQLModel fields, and Pydantic schemas are all
typed. FastAPI uses these annotations directly to generate request validation,
response models, and the OpenAPI schema at `/docs`. Type hints aren't just
documentation here; they're executable contract definitions.

**Q6. Why `from __future__` imports aren't needed anywhere?**
Because Python 3.14 already has postponed evaluation of annotations and all
the union-type syntax (`str | None`) natively — those used to require
`from __future__ import annotations` on older versions. Targeting 3.14 means
that boilerplate is unnecessary.

**Q7. Why `UUID` (from `uuid`) instead of plain `int` autoincrement IDs?**
Two reasons, both documented in `backend/README.md`'s data model table:
non-enumerability (an attacker can't guess `user_id=43` exists by trying
`42`/`44`) and future-proofing for a multi-service/SaaS setup where IDs are
generated client-side or across services without collisions. `id` is
"client-generated `uuid4`" per the README.

**Q8. Why `datetime` with `UTC` everywhere instead of naive datetimes?**
Naive datetimes are a classic source of bugs once a server and a database (or
two servers) disagree on timezone. `app/services/verification/core.py` defines
a single `now() -> datetime: return datetime.now(UTC)` as "Single UTC clock
source, so callers and the engine agree on the instant" — every timestamp
comparison in the verification/limbo-purge code goes through this one
function.

**Q9. Why `UTC` from `datetime` instead of `pytz` or `zoneinfo`?**
`datetime.UTC` is a stdlib constant added in Python 3.11 — no extra dependency
needed for a single, fixed timezone. `pytz`/`zoneinfo` matter when you need
*named* timezones (e.g. "Europe/Lisbon") for display purposes, which isn't a
requirement here — all server-side timestamps are UTC; any local-time display
is a frontend concern.

**Q10. Why is `re` used for password/PIN validation instead of a library like `validators`?**
The checks are simple character-class presence checks (uppercase, lowercase,
digit, one of `PASSWORD_SPECIAL_CHARS`) — `re.search(r"[A-Z]", v)` etc. in
`app/schemas/auth.py`. Pulling in a dependency for five regex checks would be
over-engineering; `re` is stdlib and exactly fits the job.

**Q11. The codebase has no `__future__`/`typing.Optional` — why `str | None` everywhere?**
`X | None` union syntax (PEP 604) is the modern, Ruff-enforced (`UP` ruleset)
spelling, and it's natively supported without imports on 3.14. `Optional[X]`
is the old `typing` spelling Ruff's pyupgrade rules would flag and auto-fix.

**Q12. Are there any `print()` statements or other quick-and-dirty debug leftovers?**
No — the code review pass (done earlier in this project) specifically checked
for this. The only "debug-ish" surface is the `/test-email` endpoint in
`main.py`, which is an intentional dev utility for confirming the Mailpit
pipeline, not a leftover print statement.

---

## 2. Web Framework — FastAPI & Async

**Q13. Why FastAPI over Flask or Django?**
`AGENTS.md` mandates it ("Asynchronous REST API, async/await non-blocking
I/O"). Concretely: FastAPI gives you request/response validation via Pydantic,
automatic interactive docs at `/docs` (required by the "contract-first" rule
in §2), and first-class `async def` route handlers that integrate with
`asyncpg` for non-blocking DB access — none of which Flask gives you without
extra libraries, and Django's ORM is sync-first.

**Q14. Why does almost every route handler use `async def`?**
Because every handler touches the database via `AsyncSession` (asyncpg
driver). If a handler were `def` (sync) but called `await session.execute(...)`,
that would be a syntax error; if it avoided `await` entirely it would run on
a thread pool, defeating the point of an async stack. The one exception is
CPU-bound work (bcrypt hashing), which is explicitly pushed to an executor
(see Q60) so it doesn't block the event loop either.

**Q15. What does "non-blocking I/O" buy you here, concretely?**
While one request's `await session.execute(...)` is waiting on Postgres (or
`await mail.send_message(...)` is waiting on Mailpit's SMTP), the single
event loop can serve other requests. For a small allowance-tracking app this
isn't about handling huge load — it's about not wasting a whole OS thread per
in-flight DB query, which matters when the whole stack runs in modest Docker
containers.

**Q16. Why is CORS configured the way it is in `main.py`?**
`CORSMiddleware` is added with `allow_origins=settings.CORS_ORIGINS`,
`allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`. The
React frontend (Vite dev server, `localhost:5173`) is a different origin from
the API, and because auth uses cookies (not `Authorization` headers),
`allow_credentials=True` is mandatory — without it, browsers silently drop
`Set-Cookie` on cross-origin responses and `fetch`'s `credentials: 'include'`
requests.

**Q17. Why two default origins (`localhost:3000` and `:5173`) in `CORS_ORIGINS`?**
`5173` is Vite's default dev server port (the actual frontend tooling per
`AGENTS.md`); `3000` is the conventional React/CRA port some tooling/examples
still assume. Keeping both as defaults avoids a "CORS error" surprise
regardless of which dev server config a teammate is running, while still being
overridable via env for staging/prod.

**Q18. Why register routers via `app.include_router()` instead of defining all routes in `main.py`?**
Separation of concerns and file size: `main.py` stays focused on app wiring
(middleware, exception handlers, lifespan), while `app/routers/auth/` and
`app/routers/profiles.py` own their endpoints. `app/routers/auth/__init__.py`
itself aggregates eight sub-routers into one `/api/v1/auth` prefixed router,
so `main.py` only needs two `include_router` calls.

**Q19. Why version the API with `/api/v1/...` prefixes from day one?**
Cheap insurance: once `/api/v1/auth/login` ships and a frontend depends on it,
changing its shape becomes a breaking change. Prefixing with `v1` now means a
future incompatible change can ship as `/api/v2/...` alongside it, with zero
cost paid today (it's just a string in `APIRouter(prefix=...)`).

**Q20. Why is there a `/healthz` endpoint, and why does it actually query the DB?**
`/healthz` does `await session.execute(text("SELECT 1"))` and returns `503` on
failure. A health check that only confirms "the process is running" (e.g.
`return {"status": "ok"}` unconditionally) would report healthy even if
Postgres is down — exactly the situation an orchestrator (Docker healthcheck,
k8s probe) needs to detect. `/healthz` is named for that convention
(Kubernetes-style), distinguishing "liveness" from "deep readiness".

**Q21. What's `/test-email` for, and is it safe to ship?**
It's a manual dev utility (`main.py`) that sends a hardcoded HTML email through
the configured `mail` instance to confirm the Mailpit pipeline works end to
end — useful when debugging SMTP config. It's flagged in the backend review as
a candidate for removal or gating behind a debug flag before any real
deployment, since it lets anyone trigger an outbound email with no
authentication.

**Q22. Why use `Depends()` for dependency injection instead of, say, global singletons?**
FastAPI's `Depends()` makes dependencies overridable per-request — critically,
`tests/conftest.py`'s `client` fixture does
`app.dependency_overrides[get_session] = override_get_session` to swap in a
test database session without touching application code. A global singleton
session would make this kind of test isolation much harder.

**Q23. Why is `B008` (Depends-in-defaults) explicitly ignored in Ruff config?**
`B008` normally flags function calls in argument defaults as a footgun
(mutable-default-style bugs), but `Depends(get_session)` *as a default value*
is the standard, required FastAPI dependency-injection pattern — FastAPI
specifically evaluates it per-request, not once at function-definition time.
`pyproject.toml` ignores `B008` because the "bug" it detects is, here, the
correct pattern.

**Q24. Why does the app use a `lifespan` context manager instead of `@app.on_event("startup")`?**
`@app.on_event` is deprecated in modern FastAPI/Starlette in favor of the
`lifespan` async context manager (`main.py`'s `lifespan(app)`), which is the
currently-recommended pattern and also makes shutdown logic (the `yield`'s
"after" half) explicit and symmetric — here, `rearm_pending_purges()` on
startup and `cancel_pending_purges()` on shutdown.

**Q25. Why does FastAPI need a custom `HTTPException` handler at all — doesn't it already return JSON for exceptions?**
By default FastAPI wraps every `HTTPException.detail` as `{"detail": ...}`,
even when `detail` is already a dict. But several endpoints raise
`HTTPException(403, detail={"error": "account_disabled", "message": "..."})`
and the API contract wants `{"error": ..., "message": ...}` at the top level,
not nested under `"detail"`. `main.py`'s `http_exception_handler` checks
`isinstance(exc.detail, dict)` and uses it as-is in that case, falling back to
`{"detail": exc.detail}` for plain strings — preserving both styles.

**Q26. Why catch `IntegrityError` globally in `main.py` instead of per-route?**
Most `IntegrityError`s in this app reduce to "duplicate unique key" (e.g.
double-registering an email) and should surface as a generic `409 {"detail":
"Resource already exists."}`. Handling it once in a global
`@app.exception_handler(IntegrityError)` avoids repeating a try/except in
every router that inserts rows; routes that need a *more specific* message
(none currently do, but the comment documents the escape hatch) can still
catch it themselves first, since FastAPI checks the most specific handler.

**Q27. Why is `Request` an unused-looking parameter in both exception handlers?**
FastAPI's exception-handler signature is `(request: Request, exc: ExceptionType)
-> Response` — it's part of the required interface even if the handler doesn't
read anything off `request`. Removing it would break the handler registration,
not just trigger a lint warning.

---

## 3. ORM — SQLModel

**Q28. Why SQLModel instead of "plain" SQLAlchemy + separate Pydantic schemas?**
`AGENTS.md` specifies it: "Combines Pydantic & SQLAlchemy for unified type
safety." In practice, `app/models/models.py`'s `User`/`Child` classes are
simultaneously SQLAlchemy ORM models (for queries/sessions) *and* Pydantic
models (for validation) — one field definition instead of two parallel
definitions that could drift out of sync.

**Q29. If SQLModel models can act as Pydantic schemas, why do `app/schemas/auth.py` and `app/schemas/profiles.py` exist as separate plain-Pydantic classes?**
Because request/response shapes are deliberately *different* from the DB
table shape — `RegisterRequest` has `password` (never stored as-is; becomes
`password_hash`), `LoginRequest` has no `family_name`, `ChildCreateRequest`
omits `user_id`/`is_active`/timestamps (server-assigned). Reusing the table
model directly as the API schema would either over-expose internal fields
(`password_hash`, `parent_pin_hash`) or require constant `exclude=`/`include=`
juggling. Separate schemas keep the wire contract and the storage model
independently evolvable.

**Q30. Why is `app.models.models` imported with a `# noqa: F401` in `conftest.py`?**
`import app.models.models` has a side effect — it registers the `User` and
`Child` tables on `SQLModel.metadata` — but the module itself isn't referenced
by name afterward, so Ruff's unused-import check (`F401`) would flag it. The
`noqa` comment with an inline explanation documents *why* an apparently-unused
import is intentional, for the next reader.

**Q31. Why `SQLModel.metadata.create_all` / `drop_all` in tests instead of running Alembic migrations?**
Speed and isolation: `create_all` derives the schema directly from the current
model definitions (`db_engine` fixture in `conftest.py`), so tests always run
against exactly what the Python models declare — no risk of migrations and
models drifting apart silently. Running real Alembic migrations in CI/tests
would also be slower and would test migration correctness (a separate concern)
rather than application logic.

**Q32. What's the actual risk of `create_all`/migrations drifting, and how would you catch it?**
If someone changes `app/models/models.py` without writing a matching Alembic
migration, `create_all`-based tests would still pass (they don't use
migrations) but a real deployment running `alembic upgrade head` against an
existing database would be missing that column. This is a known gap — there's
no automated "model vs. migration" diff check in CI currently; it's caught by
code review discipline (every model change should ship its migration).

**Q33. Why does `Child.user_id` use `Field(foreign_key="users.id", ondelete="CASCADE")` at the model level rather than only in the Alembic migration?**
SQLModel/SQLAlchemy needs the FK + cascade behavior declared on the model so
that `create_all` (used in tests, see Q31) produces a schema matching what
Alembic would produce for real deployments. Declaring it once on the model is
also what lets Alembic's autogenerate pick it up correctly when generating
migrations.

**Q34. Why `ondelete="CASCADE"` for children, instead of, say, preventing deletion of a parent with children?**
Soft-delete already covers the "don't lose a child's data" concern
(`is_active=False` on `Child`, never a hard delete from the API). `CASCADE` on
the FK is about *referential integrity if a `users` row is ever hard-deleted*
(e.g. GDPR-style account erasure, or the limbo-purge background task deleting
an unverified account) — in that case its children rows should disappear too,
not become orphaned rows pointing at a nonexistent user.

**Q35. Where does the limbo-purge task rely on that `CASCADE`?**
`app/services/accounts.py`'s `_discard_if_unverified` does
`await session.delete(user)` for an unverified account — the docstring notes
"CASCADE removes any owned children rows." In practice a limbo (unverified)
account can't have children yet (creating a child requires a full
`access_token` session, which requires verification), but the cascade is
correctness-by-construction rather than relying on that invariant.

**Q36. Why are `is_active` fields `bool` with explicit defaults rather than nullable?**
Both `users.is_active` and `children.is_active` default to `true` and are
`NOT NULL` (per the Alembic migration: `nullable=False`). A nullable boolean
would introduce a meaningless third state (`NULL` — active? inactive?
unknown?) that every query would have to account for. Modeling it as a
non-null boolean with a sensible default keeps every read site's logic binary.

**Q37. Why does `User` have both `created_at` and `updated_at`, and why call out that they're "anchors"?**
They're ordinary audit columns, but they're *also* reused as security
primitives: `created_at` is the deadline anchor for the limbo-purge task
(`_limbo_deadline = created_at + ACCOUNT_LIMBO_PURGE_HOURS`), and `updated_at`
is the anchor for the stateless verification-code HMAC (see Section 13).
README calls this out explicitly: "Two columns pull double duty." Reusing
existing audit columns avoids adding purpose-built columns (e.g.
`verification_anchor`) for what's conceptually the same "last meaningfully
changed" timestamp.

**Q38. Is there a risk in `updated_at` being reused as a security anchor — e.g., does an unrelated update accidentally invalidate a pending code?**
Yes, by design — that's the intended behavior. Any flow that legitimately
changes `updated_at` (verifying email, resetting a password, resetting a PIN)
*should* invalidate any other live code, because all purposes share one
anchor (documented in README: "at most one code is live per account at a time
... acceptable for MVP, where these flows don't overlap"). The risk would only
materialize if some *unrelated* future feature bumps `updated_at` as a side
effect (e.g. a generic "touch updated_at on any profile edit" trigger) — that
would silently invalidate in-flight verification codes. This is a documented
MVP tradeoff, not an oversight.

**Q39. Why is `family_name` nullable on `User`?**
Registration (`RegisterRequest`) allows `family_name: str | None = None` —
it's a display nicety ("Família Silva") not required for the account to
function. Forcing it at registration would add friction to the signup flow
for a field that's purely cosmetic in the MVP.

**Q40. Why does `Child.birth_date` use `date` (not `datetime`) and why is it nullable?**
A birth date has no meaningful time-of-day component, so `date` avoids
spurious precision and timezone questions entirely (Q8-Q9's UTC discussion
doesn't apply — there's no "instant" to anchor). It's nullable because
`ChildCreateRequest.birth_date: date | None = None` — a parent can create a
basic profile (just a name) and fill in the birth date later; it's not
required for the core loop to function.

---

## 4. Database — PostgreSQL

**Q41. Why PostgreSQL specifically, and version 17?**
`AGENTS.md` specifies "PostgreSQL 17 (Handles users, accounts, and profiles)."
Postgres is the de-facto default for new relational projects needing strong
consistency, mature `UUID`/`JSON`/timezone-aware datetime support, and a
first-class async driver (`asyncpg`). 17 is simply the current major version
at project start — there's no feature in this MVP that specifically requires
17-only behavior, but starting current avoids an early upgrade.

**Q42. Why `asyncpg` instead of `psycopg2`/`psycopg3`?**
`asyncpg` is built async-native (no thread-pool wrapping) and is one of the
fastest Postgres drivers for Python; it's the standard pairing with SQLAlchemy's
async engine (`postgresql+asyncpg://...` in `app/config.py`'s `database_url`).
Since every DB call in this app is `await`ed, a sync driver like `psycopg2`
would either block the event loop or need `run_sync` wrapping everywhere.

**Q43. Why does `database_url` build the connection string from five separate env vars instead of one `DATABASE_URL`?**
`POSTGRES_USER`/`PASSWORD`/`DB`/`HOST`/`PORT` mirror the variables the official
`postgres` Docker image itself consumes (`compose.yaml`'s `db` service uses
`env_file: ./backend/.env` directly) — one `.env` file configures both the
Postgres container *and* the API's connection string, instead of maintaining
the same credentials in two different formats/places.

**Q44. Why `pool_pre_ping=True` on the async engine?**
It makes SQLAlchemy issue a cheap "is this connection still alive" check
before reusing a pooled connection. Without it, a connection that's gone stale
(e.g. Postgres restarted, or a Docker network blip) would surface as a
confusing mid-request error on the *next* query that happens to grab that
connection. `pool_pre_ping` trades a tiny bit of latency for resilience to
exactly that class of intermittent Docker-networking issue.

**Q45. Why `pool_size=10` / `max_overflow=20` — why those numbers?**
They're SQLAlchemy's own defaults made explicit rather than tuned numbers —
for an MVP with a handful of concurrent users (a family's shared device),
10 persistent + up to 20 overflow connections is far more than needed; the
point of stating them explicitly in `app/database.py` is to make the pool
behavior visible/configurable rather than implicit, not to claim they're
load-tested.

**Q46. Why `expire_on_compute=False` (i.e. `expire_on_commit=False`) on the session factory?**
By default, SQLAlchemy expires all ORM objects after `commit()`, so accessing
any attribute afterward triggers a new (lazy) DB round trip — which, in async
SQLAlchemy, *raises* if done outside an active session/await context (the
classic `MissingGreenlet`/lazy-load-in-async error). Several endpoints commit
and then immediately return attributes of the just-committed object (e.g.
`reset_pin` returns nothing but `create_child` returns `child.id` etc. read
post-commit) — `expire_on_commit=False` keeps those attributes accessible
without a second query.

**Q47. Why is there a separate `AsyncSessionLocal` (in `app/database.py`) used by `app/services/accounts.py`, distinct from the per-request `get_session` dependency?**
The limbo-purge background tasks (`_purge_after_limbo`, `rearm_pending_purges`)
run *outside* any HTTP request — there's no FastAPI dependency injection
context to hand them a session. `AsyncSessionLocal` is the raw
`async_sessionmaker` they instantiate directly with
`async with AsyncSessionLocal() as session:`, independent of any request
lifecycle.

**Q48. Why `select(func.count())` instead of `len((await session.execute(select(Child))).all())` to check the children cap / onboarding trigger?**
`func.count()` runs `SELECT COUNT(*)` *in the database* — Postgres returns a
single integer. The alternative would fetch every `Child` row's full data
across the network just to measure how many there are, which is wasted I/O
and gets worse as a family adds more children. Both `maybe_complete_onboarding`
and `create_child` (children cap) use the `func.count()` form.

---

## 5. Migrations — Alembic

**Q49. Why Alembic instead of letting SQLModel/SQLAlchemy `create_all()` manage the schema in production too?**
`create_all()` is additive-only and silent about drift — it creates missing
tables but never alters an existing column's type, drops a column, or records
*how* the schema got from state A to state B. Alembic gives versioned,
reviewable, reversible migration scripts (`upgrade`/`downgrade`), which is
what a real deployment needs when the schema evolves after data already
exists. `create_all` is fine for ephemeral test databases (Q31) precisely
because they're thrown away every run.

**Q50. Walk through why there are two migrations instead of one.**
`3138ec56d59a_initial_schema.py` is the original schema: `users`, `children`,
and an `email_verifications` table (one row per issued code, with
`code_hash`/`expires_at`/`consumed_at`). `b7f2c9d4e1a0_drop_email_verifications.py`
then drops that table entirely once verification codes were redesigned to be
stateless (Section 13) — the HMAC-based scheme needs no stored rows at all.
Two migrations because the design changed *after* the first one had already
been written/applied, and Alembic migrations are append-only history, not
something you rewrite.

**Q51. Why not just edit the first migration to remove `email_verifications` instead of adding a second migration that drops it?**
Because the first migration may have already been applied to a real database
(or at least committed and potentially applied by a teammate) — editing
history that's already been run elsewhere causes Alembic's revision tracking
to disagree with the actual DB state. A follow-up migration that drops the
table is the only safe way to represent "we changed our mind" once a migration
is no longer purely local/unapplied.

**Q52. The second migration's `downgrade()` recreates the full `email_verifications` table — isn't that a lot of code for a "just in case"?**
Yes, and that's intentional: `downgrade()` must be the exact inverse of
`upgrade()` so `alembic downgrade -1` is safe to run. Since `upgrade()` drops
a table (losing its DDL), `downgrade()` has to fully reconstruct that DDL —
columns, indexes, FK, PK — to actually restore the prior schema shape (not the
data, which is unrecoverable, but at least the structure).

**Q53. Why do the migration files have descriptive docstrings (e.g. explaining *why* `email_verifications` was dropped) rather than just the autogenerated header?**
Alembic's autogenerate only produces *what* changed (DDL diffs), not *why*. Six
months from now, "dropped table X" in a migration log is much less useful than
"verification codes moved to a stateless service layer... so there is no
longer any row to persist" (the actual docstring in
`b7f2c9d4e1a0_drop_email_verifications.py`) — it tells a future reader this was
a deliberate architectural shift, not a mistake being corrected.

**Q54. Why are there `.pyc` files for a `984199afea8f_initial_schema` revision that doesn't exist as a `.py` file in `alembic/versions/`?**
That's a stale bytecode cache from a since-renamed/removed migration file
(Python's `__pycache__` doesn't get cleaned up automatically when the source
`.py` is deleted or renamed). It's harmless — Alembic reads `.py` files, not
`.pyc` — but it's exactly the kind of "useless file" a cleanup pass should
remove (and ideally `alembic/versions/__pycache__/` should be gitignored).

**Q55. How would you actually run these migrations — what command, and against which database?**
`uv run alembic upgrade head` from `backend/`, using the connection info from
`app/config.py`'s `database_url` (built from the `POSTGRES_*` env vars, same
ones the `db` Docker service uses). In Docker Compose, this would typically
run as part of the `api` service's startup or as a one-off `docker compose run
api uv run alembic upgrade head` before the API starts serving traffic.

**Q56. Does CI run Alembic migrations?**
No — the `backend-test` CI job (`.github/workflows/ci.yml`) uses
`SQLModel.metadata.create_all`/`drop_all` via the test suite's `db_engine`
fixture (Q31), not `alembic upgrade head`, against the `postgres:17-alpine`
service container. This is a known gap: CI verifies the *models* are
internally consistent and that application logic works against that schema,
but doesn't verify the *migrations* themselves apply cleanly. Running
`alembic upgrade head` in CI would be a reasonable future addition.

**Q57. Why does the `users` table have indexes on both `id` and `email` (`ix_users_id`, unique `ix_users_email`)?**
`id` (UUID primary key) gets an index implicitly via the `PrimaryKeyConstraint`
in most databases, but Alembic's autogenerate explicitly created
`ix_users_id` too — mostly redundant but harmless. `ix_users_email` is the
load-bearing one: it's `unique=True` (enforcing "one account per email" at the
DB level, the source of the `409` on duplicate registration) and is also the
index that makes `WHERE email = ...` lookups in `login`/`forgot-password`/etc.
fast rather than a full table scan.

**Q58. Why index `children.user_id`?**
Every "list this parent's children" query (`get_family`, the children-cap
count in `create_child`, the onboarding check) filters
`WHERE Child.user_id == current_user.id`. Without an index on the FK column,
each of those becomes a full table scan of `children` as the table grows —
`ix_children_user_id` makes them index lookups instead.

---

## 6. Package Management — uv

**Q59. Why `uv` instead of `pip` + `venv`, or `poetry`?**
`AGENTS.md` specifies it, and practically: `uv` is dramatically faster at
dependency resolution/installation (written in Rust), manages the virtualenv
implicitly (`uv run` activates it for you), and unifies what `pip`,
`venv`, and a lockfile tool (`uv.lock`) would otherwise be three separate
tools. `pyproject.toml` + `uv.lock` together give fully reproducible installs.

**Q60. What's the difference between `uv sync` and `uv sync --all-extras`, and why does CI use the latter?**
`uv sync` installs the project's main + dev dependency groups by default
(dev deps are *included* by default in `uv`, not excluded — `--no-dev` is what
excludes them). `--all-extras` additionally installs any optional
"extras" groups declared under `[project.optional-dependencies]` (this project
doesn't currently define any, so in practice it's equivalent to plain `uv
sync` here, but it's future-proof/explicit for CI — if an extras group is
added later, CI picks it up without an edit).

**Q61. Earlier you tried `uv sync --all-extras --dev` and it failed — why?**
`--dev` isn't a valid `uv sync` flag at all (confirmed via `uv sync --help`).
The dev dependency group (`pytest`, `ruff`, `httpx`, etc., under
`[dependency-groups] dev = [...]` in `pyproject.toml`) is installed *by
default* — there's no flag needed to opt in. `--no-dev` is the flag that
exists, and it does the opposite (excludes dev deps), which is what you'd want
for a slim production image.

**Q62. The production Dockerfile runs `uv sync --no-dev` — why exclude dev dependencies there but not in CI?**
The production image (`ops/Dockerfile`) only needs to *run* the app —
`pytest`/`ruff`/`httpx` etc. add image size and attack surface for no runtime
benefit. CI's `backend-test` job, by contrast, exists specifically to run
`pytest`, so it needs the dev group present — hence plain `uv sync
--all-extras` (dev included by default) there.

**Q63. Why commit `uv.lock` to the repo?**
It pins exact resolved versions (including transitive dependencies) so
`uv sync` produces byte-identical environments on every machine — a
teammate's laptop, CI, and the Docker image all install the exact same
dependency graph. Without it, `pyproject.toml`'s version ranges (e.g.
`fastapi[standard]>=0.136.3`) could resolve differently over time as new
releases land.

**Q64. How do you add a new dependency with `uv`, and what changes?**
`uv add <package>` — it updates both `pyproject.toml` (adding the dependency
to the appropriate group) and `uv.lock` (re-resolving and pinning), and
installs it into the local virtualenv in one step. There's no separate
"`pip install` then manually edit `requirements.txt`" dance.

**Q65. Why is `greenlet` an explicit dependency when nothing in the app code imports it?**
SQLAlchemy's async mode uses `greenlet` under the hood to bridge its
historically-sync internals with `asyncio` (it's how `await session.execute()`
can call into SQLAlchemy's core machinery safely). It's usually pulled in
transitively, but pinning it directly (`greenlet>=3.5.1`) documents that the
async engine *depends* on a recent-enough greenlet and avoids relying on
another package's transitive pin.

**Q66. Why `email-validator` as a separate dependency from `pydantic`?**
Pydantic's `EmailStr` type (used in `RegisterRequest.email`,
`LoginRequest.email`, `ForgotPasswordRequest.email`, etc.) requires the
`email-validator` package to actually perform RFC-compliant email validation —
Pydantic deliberately doesn't bundle it to keep its core install lean. Without
it, using `EmailStr` raises an import error at runtime.

**Q67. Why `fastapi[standard]` rather than bare `fastapi`?**
The `[standard]` extra bundles `uvicorn` (the ASGI server actually used to run
the app — see `ops/Dockerfile`'s `uv run uvicorn main:app ...`), plus a few
other commonly-needed extras (e.g. `python-multipart` for form data). Without
it you'd need to separately add `uvicorn` as its own dependency.

**Q68. Why is `pytest-cov` a dev dependency if coverage isn't enforced in CI?**
It's there to support the *local/manual* coverage workflow documented in
`backend/README.md`: `uv run pytest --cov=app --cov-report=term-missing`. The
team uses it during development to find untested branches (e.g. the edge
cases added during the test-consolidation pass), even though CI currently only
runs the test suite, not a coverage gate. Adding a coverage threshold to CI
would be a natural next step but wasn't part of this iteration's scope.

---

## 7. Linting & Formatting — Ruff

**Q69. Why Ruff instead of separate `flake8` + `black` + `isort` + `pyupgrade`?**
Ruff reimplements (and is largely compatible with) all four tools' rule sets
in a single, much faster (Rust-based) binary — one config block in
`pyproject.toml`, one command for linting (`ruff check`) and one for
formatting (`ruff format`), instead of four tools with four configs that can
disagree with each other.

**Q70. Walk through the rule selection: `["E", "F", "I", "UP", "B", "SIM", "C4", "ASYNC", "RUF"]` — what does each one actually catch?**
- `E` (pycodestyle errors): basic style issues (spacing, line length).
- `F` (Pyflakes): correctness issues — unused imports/variables, undefined
  names.
- `I` (isort): import ordering/grouping.
- `UP` (pyupgrade): modernize syntax for the target Python version (e.g.
  `Optional[X]` → `X | None`, old-style `%` formatting → f-strings).
- `B` (flake8-bugbear): likely-bug patterns (mutable default arguments, etc.).
- `SIM` (flake8-simplify): simplifiable code (e.g. nested `if`s that could be
  combined).
- `C4` (flake8-comprehensions): inefficient/unnecessary
  list/dict/set-comprehension patterns.
- `ASYNC` (flake8-async): async-specific footguns — e.g. blocking calls inside
  `async def` functions, which is directly relevant to the bcrypt-in-executor
  pattern (Q60 in Section 12).
- `RUF`: Ruff's own additional checks not covered by the above.

**Q71. Why ignore `B008` — already covered in Q23, but why is it framed as a Ruff *config* decision rather than per-line `# noqa`?**
Because `Depends(...)` in a default argument is the *correct, idiomatic*
pattern for essentially every FastAPI route/dependency in this codebase —
dozens of occurrences. A per-line `# noqa: B008` on every single route handler
would be noise; a one-line ignore in `pyproject.toml` documents "this rule
doesn't apply to this project's framework" once, globally.

**Q72. Why ignore `RUF001`/`RUF002`/`RUF003` (ambiguous Unicode characters)?**
These flag characters that *look* like ASCII punctuation but aren't (e.g. an
en-dash `–` vs. hyphen `-`, or a curly quote vs. straight quote) — useful for
catching copy-paste artifacts in *code*, but the project's user-facing strings
and docstrings intentionally use proper typographic dashes/quotes (e.g. "Família
Silva", or em-dashes in error messages) for readability. Ignoring these rules
avoids Ruff flagging correct typography as a bug.

**Q73. Why `line-length = 100` instead of the traditional 79 or Black's 88?**
100 is a common modern middle ground — modern monitors comfortably fit
100-character lines side-by-side, and FastAPI route signatures with multiple
typed `Depends(...)` parameters plus return-type annotations get long quickly;
79 would force awkward wrapping on almost every endpoint definition. 88
(Black's default) was considered too tight for the same reason; 100 reduces
unnecessary wrapping without going to "anything goes" widths like 120.

**Q74. Why `quote-style = "double"` under `[tool.ruff.format]`?**
This is Ruff's formatter equivalent of Black's default — picking one quote
style and enforcing it everywhere avoids bikeshedding and noisy diffs where
lines change only because someone used `'` vs `"`. Double quotes were chosen
because they're Python's (and Ruff's) default and don't require escaping
apostrophes in natural-language strings (error messages, docstrings) as often.

**Q75. How is Ruff actually enforced — is it just a suggestion?**
Two layers: locally via `pre-commit` git hooks (per `AGENTS.md` §2: "Ruff for
backend... formatter"), and in CI via the `backend-lint` job
(`.github/workflows/ci.yml`), which runs `ruff check .` and `ruff format
--check .` (the `--check` flag makes formatting a *gate* — it fails if any
file isn't already formatted, rather than auto-fixing in CI).

**Q76. Why does `backend-lint` install Ruff via `pip install --upgrade ruff` instead of `uv sync` like `backend-test` does?**
`backend-lint` only needs the `ruff` binary — it doesn't need the full
application dependency graph (FastAPI, SQLAlchemy, etc.) to lint Python
syntax/imports. A bare `pip install ruff` is faster and avoids the job needing
`uv` or a lockfile sync at all, keeping the lint job minimal and fast as a
first-line CI check.

**Q77. Why are `backend-lint` and `backend-test` two separate CI jobs instead of one job running both?**
Separate jobs run in parallel (faster overall CI), fail independently (a
formatting nit doesn't block you from seeing whether the *tests* pass, and
vice versa), and have very different setup costs — lint needs only `ruff`,
test needs Postgres + Mailpit service containers and the full dependency
install. Conflating them would make the lint feedback as slow as the test
feedback for no benefit.

**Q78. What does "Ruff format" actually rewrite, beyond quote style?**
Trailing whitespace, blank-line conventions between functions/classes, import
grouping/sorting (via the `I` rules' formatter-compatible output), consistent
indentation, and wrapping long function signatures/collections across
multiple lines in a canonical way — essentially everything Black would do,
applied via `ruff format .`.

**Q79. Is there a risk that `ruff format` and `.editorconfig` (4 spaces for Python) disagree?**
No — Ruff's formatter defaults to 4-space indentation for Python (matching
PEP 8 and `.editorconfig`'s declared convention), so the two are consistent by
construction. `.editorconfig` mainly exists for editors/IDEs that don't run
Ruff on every keystroke, so manual edits still land on 4-space indents before
`ruff format` ever runs.

**Q80. Have you actually run into a Ruff rule firing on intentional code, beyond the three ignored?**
Not beyond what's already ignored — the ignore list (`B008`, `RUF001-003`) was
arrived at by running `ruff check .` against the real codebase and ignoring
only the rules that fired on *idiomatic, intentional* patterns (FastAPI DI,
typographic punctuation), while leaving everything else enabled. Section 7's
ignore list is short and each entry is justified, rather than a blanket
disable of inconvenient categories.

---

## 8. Testing — Pytest, Async, Fixtures & Conftest

**Q81. Why Pytest over `unittest`?**
`AGENTS.md` specifies it, and practically: Pytest's fixture system (used
extensively here — `db_engine`, `db_session`, `client`, `mock_mail`) is far
more composable than `unittest.TestCase` subclassing/setUp methods, and
`pytest-asyncio` integrates `async def test_...` functions directly, which
`unittest` requires `IsolatedAsyncioTestCase` boilerplate for.

**Q82. Why `httpx.AsyncClient` with `ASGITransport` instead of `TestClient` from FastAPI/Starlette?**
`TestClient` (based on `requests`) is synchronous and runs the app via a
sync-to-async bridge, which doesn't exercise the real async request path the
same way. `AsyncClient(transport=ASGITransport(app=app), ...)` drives the
*actual* ASGI app asynchronously, in the same event loop as the test — so
`async def test_...` functions can `await client.post(...)` directly, matching
how the app really runs.

**Q83. Why `asyncio_mode = "auto"` in `pyproject.toml`?**
Without it, every `async def test_...` needs an explicit
`@pytest.mark.asyncio` decorator — `"auto"` mode applies that marker to *all*
async test functions automatically. Given essentially every test in this
suite is async (it's testing an async API), requiring the decorator on each
of 100+ tests would be pure repetition.

**Q84. Why `asyncio_default_fixture_loop_scope = "session"` and `asyncio_default_test_loop_scope = "session"`?**
This makes all async tests and async fixtures share a single event loop for
the whole test session, rather than pytest-asyncio's older default of a fresh
loop per test function. That matters because `db_engine` is a
`scope="session"` fixture holding a single `AsyncEngine` with its own
connection pool — an engine created on one event loop can't be used from a
different one. Session-scoped loop + session-scoped engine keeps them
compatible and avoids "attached to a different loop" errors.

**Q85. Why is `db_engine` session-scoped but `db_session`/`client` are function-scoped?**
Creating an `AsyncEngine` (and its connection pool, and running
`create_all`/`drop_all` against real Postgres) is relatively expensive — doing
it once per test session instead of once per test saves significant time
across 100+ tests. `db_session` and `client`, by contrast, are cheap to create
per test and *need* to be per-test, because each test should start from a
clean slate (see Q86).

**Q86. How is test isolation achieved if all tests share one `db_engine`/database?**
Both `db_session` and `client` fixtures clean up after themselves: at
teardown, each runs `DELETE FROM children` then `DELETE FROM users` (children
first, to respect the FK) and commits. So every test starts with empty
`users`/`children` tables even though they all hit the same Postgres database
and engine — isolation is achieved via cleanup, not via separate databases or
transactions-per-test.

**Q87. Why delete-and-cleanup instead of wrapping each test in a transaction that's rolled back?**
A rollback-per-test pattern usually requires the app code itself to use the
*same* transaction/connection the test set up (often via a nested
savepoint/`begin_nested`) — but here, `client`'s `override_get_session`
creates a *fresh* session per request (via `session_factory()`), matching
production behavior where each request gets its own session. Forcing a shared
transaction would mean the test setup and the app code under test aren't using
independent sessions the way they do in prod, which could mask
session-isolation bugs. Explicit cleanup is simpler and closer to reality.

**Q88. Why is `_cleanup_purge_tasks` an `autouse=True` fixture?**
Because `/register` (used by almost every test, directly or via
`register_and_verify`) calls `schedule_limbo_purge`, which creates a real
`asyncio.Task` that sleeps for up to `ACCOUNT_LIMBO_PURGE_HOURS` (24h). If
left running, these tasks pile up across the test session and emit
"coroutine was never awaited"/pending-task warnings at event-loop teardown —
or worse, hold references that interfere with the next test's cleanup.
`autouse=True` means *every* test gets this cleanup without each test file
remembering to request it.

**Q89. Why does `_cleanup_purge_tasks` import `from app.services import accounts` *inside* the fixture function rather than at module level?**
The comment-free reason is avoiding a module-level import cycle/cost at
collection time, but more importantly it's a defensive/local import pattern —
`conftest.py` is loaded for every test session regardless of which tests run,
so keeping this import scoped to where it's used (a single fixture) avoids
making `accounts` an implicit dependency of `conftest.py` itself for tests
that never touch it. (In practice it's a minor style choice; either would
work.)

**Q90. What does the `mock_mail` fixture actually do, and why monkeypatch `send_message` specifically?**
`monkeypatch.setattr("app.mail.mail.send_message", _fake_send)` replaces the
*one method* that would make a real network call to Mailpit's SMTP port with
an async no-op that appends the `MessageSchema` to a `captured` list (returned
to the test). Patching at this single seam means the rest of `app/mail.py`
(template rendering, `FastMail` config) is untouched — tests verify "did we
*attempt* to send the right email with the right template data" without any
network dependency.

**Q91. If `mock_mail` removes the need for a real mail server, why does CI still run a `mailpit` service container?**
Two different concerns: `mock_mail` makes *test correctness* independent of
Mailpit (Q90) — tests would pass even if Mailpit were down. But
`backend/README.md` documents Mailpit as part of the required local dev/CI
environment for *parity* (mirroring `compose.yaml`'s services), and the user
explicitly wanted CI to mirror the local stack exactly, in case a future test
*does* need a live SMTP sink (e.g. an integration test that doesn't mock
`send_message`). It's "belt and suspenders" — currently unused by the suite,
but keeps CI's environment honest relative to local dev.

**Q92. How does a test retrieve the verification *code* from a mocked email, given the real code is never returned by the API?**
`mock_mail[-1].template_body["code"]` — `MessageSchema.template_body` is the
dict of Jinja2 template variables that *would* be rendered into the HTML email
(`app/templates/email/verification_code.html` etc.). Since `mock_mail`
captures the `MessageSchema` object before it would be sent, the test reads
the code straight out of the template context that was prepared for it — the
exact value a human would see in the rendered email.

**Q93. Why does `tests/conftest.py` define `VALID_USER`, `extract_cookie`, and `register_and_verify` as *module-level* helpers rather than fixtures?**
`VALID_USER` is just a constant dict — a fixture would add ceremony
(`def valid_user(): return {...}`) for no benefit over `from tests.conftest
import VALID_USER`. `extract_cookie` and `register_and_verify` are pure
functions parameterized by `client`/`mock_mail` (which *are* fixtures, passed
in explicitly) — making them fixtures themselves would force every test to
declare them as dependencies even in tests that call them conditionally or
multiple times with different overrides (e.g. registering two different
accounts in one test via `register_and_verify(client, mock_mail,
email="other@example.com")`).

**Q94. Why did these three things (`VALID_USER`/`_VALID`, `extract_cookie`/`_cookie`, `register_and_verify`/`_register_and_verify`) need consolidating — what was the actual duplication?**
Before consolidation, multiple test files (`test_login_logout.py`,
`test_pin.py`, `test_profiles.py`, `test_forgot_password.py`,
`test_registration.py`) each defined their own near-identical copy of "the
example user dict", "pull a cookie out of a response", and "register, verify,
return the access token" — five copies of logic that's conceptually one thing.
Any change to, say, the registration payload shape would have required editing
all five files identically (and risk missing one).

**Q95. Why is `extract_cookie` more complex than `response.cookies.get(name)` — what's the fallback for?**
The docstring explains: "some flows issue multiple Set-Cookie headers that
httpx's jar doesn't expose [individually]." A single response can set, e.g.,
both `pending_verification_token` and some other cookie in one response, and
httpx's `response.cookies` jar can miss one depending on header-folding
behavior. The fallback manually splits the raw `set-cookie` header string on
commas and searches for `f"{name}="`, as a belt-and-suspenders extraction.

**Q96. `register_and_verify` takes `**overrides` — why not a `payload: dict | None` parameter?**
`**overrides` lets call sites read naturally as field-level edits:
`register_and_verify(client, mock_mail, email="other@example.com")` clearly
says "same as default, except this email." A `payload` dict parameter would
require callers to spread `{**VALID_USER, "email": "..."}` themselves at every
call site — `**overrides` pushes that merge (`{**VALID_USER, **overrides}`)
into the helper, once.

**Q97. Why does `register_and_verify` return only the `access_token` cookie value, not the full response?**
Because every caller's actual need is "an authenticated session to attach to
subsequent requests" — `cookies={"access_token": token}` on the next call.
Returning the full verify-response would make every call site repeat
`extract_cookie(res, "access_token")`; returning just the token is the
"params, not options" simplification of the common case.

**Q98. How many tests exist in total, and how are they organized?**
109 tests across one file per feature area (`test_registration.py`,
`test_login_logout.py`, `test_pin.py`, `test_profiles.py`,
`test_forgot_password.py`, plus others for verification/resend and pin-reset
flows) — mirroring the router split in `app/routers/auth/`. Each file groups
tests by endpoint with `# ---...---` section-header comments (e.g.
`test_forgot_password.py` has `/forgot-password`, `/forgot-password/verify`,
`/reset-password` sections).

**Q99. Give an example of a test that needed direct SQL (`text(...)`) rather than going through the API — why?**
`test_forgot_password_disabled_account_returns_same_response` does
`await db_session.execute(text("UPDATE users SET is_active = false"))`. There's
no API endpoint to disable an account (that's an admin/out-of-scope action for
MVP) — but the *test* needs to get a user into that state to verify the
forgot-password flow's behavior toward disabled accounts. Direct SQL via the
`db_session` fixture is the pragmatic way to set up states the API itself
can't produce.

**Q100. Similarly, `test_forgot_password_verify_expired_code_returns_400` does `UPDATE users SET updated_at = NOW() - INTERVAL '11 minutes'` — why manipulate time this way instead of mocking `core.now()`?**
Because the verification code's expiry is computed *relative to
`users.updated_at`* (Q37/Section 13) — rewinding `updated_at` by 11 minutes
(just past the 10-minute `VERIFICATION_CODE_EXPIRY_MINUTES`) makes the
*already-issued* code expired from the system's perspective, without needing
to mock `datetime.now()` globally (which would also affect unrelated timestamp
fields like `created_at` and risk interfering with the limbo-purge
calculations in the same test run).

**Q101. Why does `test_reset_password_with_valid_cookie_allows_new_login` test *both* that the old password fails AND the new one succeeds, rather than just checking the `200` from `/reset-password`?**
A `200` from `/reset-password` only proves the endpoint *ran without error* —
it doesn't prove the password was actually *changed* in a way that affects
login. Testing the old password now returns `401` and the new password
returns `200` exercises the real behavioral contract: "this endpoint changes
what credentials authenticate this account," which is the actual
user-observable outcome.

**Q102. Why do PIN tests use a fixed `_PIN = "1234"` / `_NEW_PIN = "5678"` rather than random values?**
Determinism and readability — a test asserting "verify-pin with `_NEW_PIN`
after reset-pin succeeds" is clearer when the reader can see the exact digits
involved, and there's no security reason to randomize PINs in tests (unlike,
say, secrets that must never be predictable in *production*). `PARENT_PIN_LENGTH
= 4` in `app/config.py` constrains them to 4 digits either way.

**Q103. `test_profiles.py` defines `_OTHER = {"email": "other@example.com", ...}` — why a second full user dict instead of just overriding `email`?**
Some profile tests need *two independent parent accounts* to verify
cross-account isolation (e.g. "child belonging to another user → 404" in the
Chunk 5 plan). `_OTHER` being a complete dict (not just an email override)
makes those tests self-documenting — `register_and_verify(client, mock_mail,
**_OTHER)` clearly registers "the other family," with its own `family_name`
("Costa") distinguishing it from `VALID_USER`'s "Silva" in assertions/output.

**Q104. Why does `tests/__init__.py` exist (an empty file, presumably)?**
It's what makes `tests/` an importable Python *package*, which is required for
`from tests.conftest import VALID_USER, ...` to work as an absolute import
from within test modules. Without `tests/__init__.py`, `tests.conftest` isn't
a valid import path (pytest can still *discover* tests in a non-package
directory via its rootdir/conftest mechanism, but cross-file imports like this
need the package structure).

**Q105. Why `pythonpath = ["."]` in `pyproject.toml`'s pytest config?**
It adds `backend/` (the directory containing `pyproject.toml`) to `sys.path`
for the test run, so `from app.config import settings`, `from main import
app`, and `from tests.conftest import ...` all resolve relative to `backend/`
as the root — without it, these absolute imports would fail unless the tests
were run from exactly the right working directory with the right
`PYTHONPATH` already set.

**Q106. `client` fixture imports `from main import app` *inside the fixture function* — why not at module level in `conftest.py`?**
The comment says "imported here to avoid circular issues at module load."
`main.py` imports routers, which import services/dependencies, which may
(transitively) end up importing things that touch `app.database`/settings —
if `conftest.py` imported `main` at module *collection* time (before fixtures
run), it risks import-order issues (e.g. settings not yet configured, or a
circular import between test infrastructure and app modules). Deferring the
import to inside the fixture sidesteps this entirely.

**Q107. Why does the `client` fixture override `get_session` with a *new* `session_factory()` per call, rather than reusing `db_session`'s session?**
Because a single HTTP request might internally open/commit multiple sessions
in sequence (each `Depends(get_session)` call gets its own), and more
importantly, the test client should behave like *production* — where each
request gets an independent session from the pool, not one shared/long-lived
session. Sharing `db_session`'s single session across all requests in a test
could mask bugs around commit/flush ordering that would surface with
per-request sessions in prod.

**Q108. What would happen if a new test forgot to clean up data it inserted directly via `db_session` (bypassing the API)?**
The `db_session` fixture's teardown (`DELETE FROM children` then `DELETE FROM
users`) runs regardless of *how* rows were inserted — whether via the API
(through `client`) or directly via `db_session.execute(...)`. Both `users` and
`children` are wiped after every test that uses either fixture, so even
"raw SQL setup" rows are cleaned up automatically.

**Q109. Is there any test for the `/healthz` endpoint or the limbo-purge background task's actual firing (not just its cancellation)?**
Not currently — `_cleanup_purge_tasks` ensures purge tasks don't leak across
tests, but no test fast-forwards time (or shortens `ACCOUNT_LIMBO_PURGE_HOURS`)
to assert an unverified account is actually *deleted* after its deadline, nor
is there a `/healthz` test. These are reasonable gaps for a future test pass —
the purge *logic* (`_discard_if_unverified`) is straightforward enough to unit
test directly without waiting 24 (simulated) hours, by calling it directly with
a session and asserting the user row is gone.

---

## 9. Containerization — Docker, Compose & Nginx

**Q110. Why Docker Compose for local dev instead of "just run `uv run uvicorn` and `bun run dev` directly"?**
`AGENTS.md` mandates it ("Local DevOps: Execution is containerized entirely via
Docker and Docker Compose"), and practically: the stack has five
interdependent pieces (Postgres, Mailpit, the API, the React dev server, and an
Nginx reverse proxy) — Compose declares all of them, their networking, and
startup ordering (`depends_on`) in one file (`compose.yaml`), so `docker
compose up` gives every teammate an identical environment regardless of what's
installed on their host.

**Q111. Why does `compose.yaml` put an Nginx reverse proxy in front of everything, rather than exposing the API and frontend ports directly?**
The comment in `compose.yaml` is explicit: "ONLY NGINX exposes ports to the
outside world." This mirrors a production topology (one public entry point,
internal services on a private Docker network) even in dev — so routing rules,
TLS termination (commented-out `443` port for future certs), and any
path-based routing between `/api/...` and the frontend are exercised
early, not bolted on right before deployment.

**Q112. Why is `proxy` the only service binding `80:80` to the host, with everything else unmapped (relying on the Docker network)?**
Defense in depth / topology accuracy: the API and frontend containers are
reachable from the host on their own ports too in this `compose.yaml` (note
`db` does map `5432:5432` for local psql access, and `mailpit` maps `8025`/`1025`
for the web UI) — but conceptually, `proxy` being the single "front door" means
that if this were tightened for a staging environment, only `80`/`443` would
need to remain published.

**Q113. Why does `db`'s healthcheck matter, and why does `api` declare `depends_on: db: condition: service_healthy`?**
Postgres's container reports "started" almost immediately, but isn't ready to
accept connections for a few more seconds (initdb, etc.). Without
`condition: service_healthy`, the `api` container could start and immediately
fail its first DB connection attempt (a startup race). `pg_isready -U
$POSTGRES_USER -d $POSTGRES_DB` is Postgres's own readiness-check tool — once
it succeeds, `api` is allowed to start.

**Q114. Why `env_file: ./backend/.env` for the `db` service specifically?**
The official `postgres` image bootstraps its superuser/database from
`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` env vars on *first* startup.
Pointing `db` at the *same* `.env` file the API reads (`app/config.py`'s
`Settings` also loads `.env`) guarantees the credentials Postgres creates and
the credentials the API connects with are always identical — one file, one
source of truth, instead of duplicating credentials in `compose.yaml` and
`.env` separately.

**Q115. Why is there a commented-out `./ops/postgres/init.sql` volume mount?**
It's a documented extension point — if the project ever needed to seed the
database with initial data or run arbitrary SQL on first container creation
(Postgres images execute anything in `/docker-entrypoint-initdb.d/` on first
init), this is where it would be wired in. Currently Alembic migrations handle
schema setup, so it's unused, but leaving the commented line documents "this is
how you'd do it" for a future need rather than requiring someone to rediscover
the Postgres image's convention.

**Q116. Why does `api` mount `./backend:/app` as a volume in addition to the image's `COPY`-based build?**
Live-reload development: `ops/Dockerfile`'s `CMD` runs `uvicorn ... --reload`,
which watches the filesystem for changes. Without the bind mount, the
container would only ever see the code as it was at `docker build` time —
mounting the host's `./backend` directory over `/app` means edits on the host
are immediately visible inside the container, so `--reload` actually reloads
on *your* edits.

**Q117. Why does `frontend` mount both `./frontend:/app` *and* `/app/node_modules` as separate volumes?**
This is the standard "anonymous volume over node_modules" trick: mounting
`./frontend:/app` would otherwise *shadow* the `node_modules` that was
installed inside the image during `docker build` with the host's
(possibly-empty or platform-mismatched) `node_modules`. Adding `/app/node_modules`
as its own volume makes Docker preserve the container's own `node_modules`
directory underneath the bind mount, so dependencies installed at build time
(for the container's Linux/Bun environment) survive.

**Q118. Why does `frontend`'s build pass `UID`/`GID` build args (`${UID:-1000}` / `${GID:-1000}`)?**
To avoid file-permission mismatches when the bind-mounted `./frontend`
directory is written to by a process inside the container — if the container
runs as a different UID than the host user, files created inside the container
(e.g. by Bun) would be owned by that UID on the host filesystem, causing
permission errors when the host user tries to edit them later. Passing the
host's actual UID/GID (defaulting to `1000`, the common first-user UID on
Linux) at build time lets the container's user match the host user.

**Q119. Why does the backend `ops/Dockerfile` *not* have a similar UID/GID concern?**
The backend bind mount (`./backend:/app`) is read by `uvicorn --reload` for
live-reload, but the backend process itself doesn't typically *write* new
files into that tree during normal operation (no build artifacts, no generated
node_modules-equivalent) — Python doesn't have a build step that writes back
into the source tree. The frontend's Bun/Vite tooling, by contrast, can write
caches/build outputs into the mounted tree.

**Q120. `ops/Dockerfile` installs `libpq-dev` via `apt-get` — why, if the app uses `asyncpg` (a pure-Python/C-extension driver, not `psycopg2`)?**
`asyncpg` itself doesn't require `libpq`, but `libpq-dev` provides headers/libs
that some transitive dependency in the stack may need to *build* a C extension
during `uv sync` on `python:3.14-slim` (which has minimal build tooling).
Including it preempts a "missing pg_config" or similar build failure during
`uv sync` inside the container — cheap insurance for a ~few-MB apt package.

**Q121. Why `python:3.14-slim` instead of the full `python:3.14` image, or `python:3.14-alpine`?**
`-slim` (Debian-based, minimal) is the standard tradeoff: much smaller than the
full image (no extra dev tools/docs preinstalled) but still glibc-based, so
Python C-extension wheels (which are usually built against glibc) install
without issues — unlike Alpine, which uses `musl` and often requires
compiling C extensions from source (slower builds, sometimes outright
incompatible prebuilt wheels).

**Q122. Why `RUN pip install uv` rather than using an official `uv` base image or installer script?**
Simplicity and explicitness inside a `python:3.14-slim` base — `pip` is
already present, so `pip install uv` is a one-liner with no extra `curl`/shell
script execution (which would also need `ca-certificates`/`curl` installed
first on a slim image). It trades a theoretically-faster `uv`-provided install
method for fewer moving parts in the Dockerfile.

**Q123. Why does `ops/Dockerfile` `COPY pyproject.toml uv.lock ./` *before* `RUN uv sync --no-dev`, separately from copying the rest of the source?**
Docker layer caching: dependencies change far less often than application
code. By copying only the dependency manifests first and running `uv sync`
before copying the rest of the source (implied by the bind-mount-based dev
workflow, and standard practice for production builds), Docker can cache the
(slow) dependency-install layer and only re-run it when `pyproject.toml`/`uv.lock`
actually change — not on every code edit.

**Q124. Why `CMD [..., "--reload"]` even in what looks like a "production" Dockerfile?**
This Dockerfile currently serves *both* roles (dev, via the bind-mounted
`compose.yaml` `api` service, and would be the base for any deployment) — for
this MVP/academic project stage, `--reload` being always-on is a pragmatic
simplification. A genuinely separate production image would drop `--reload`
and likely add `--workers N` for multi-process serving; that split wasn't
needed yet at this project phase.

---

## 10. Email — fastapi-mail & Mailpit

**Q125. Why does the app send emails at all in an MVP described as "no actual emails"?**
Three flows fundamentally require out-of-band proof of identity: account
verification (prove you own the email you registered with), forgot-password,
and forgot-PIN — all use a code "sent" to the user's email. Even though no
*real* external email provider is configured, the app still needs to exercise
the full "generate code → render template → dispatch message" pipeline so the
architecture is correct; Mailpit substitutes for the "real inbox" in dev/test
without touching `app/services/verification/*` or `app/mail.py`'s logic.

**Q126. Why fastapi-mail specifically, rather than calling `smtplib` directly?**
`fastapi-mail` gives you `ConnectionConfig` (centralizing SMTP host/port/creds),
Jinja2 template rendering integration (`TEMPLATE_FOLDER`,
`template_body=...`), and an async `send_message` — `smtplib` is synchronous
and would need manual thread-pool wrapping plus hand-rolled HTML templating to
match. `app/mail.py` is ~20 lines because fastapi-mail handles all of that.

**Q127. Why Mailpit specifically, instead of `MailHog` (its predecessor/alternative) or a real SMTP relay with a test inbox?**
Mailpit is MailHog's actively-maintained successor — same core idea (a fake
SMTP server with a web UI to inspect captured emails at `:8025`, SMTP on
`:1025`), but maintained, faster, with a modern UI and a JSON API
(`/api/v1/...`, used by the CI healthcheck). Using a real SMTP provider in
dev/CI would mean managing real credentials, rate limits, and actual email
deliverability for an MVP that explicitly has "no actual emails."

**Q128. Why is `MAIL_SERVER` default `"mailpit"` in `app/config.py` but `MAIL_PORT: 1025` is set explicitly as an *env var* in CI rather than relying on the default?**
`MAIL_SERVER`'s default (`"mailpit"`) is the Docker Compose service *name* —
DNS-resolvable only on the Compose network, where `app/config.py`'s default
already works as-is. In CI, GitHub Actions service containers are reachable via
`localhost` (not a custom hostname), so CI sets `MAIL_SERVER: localhost`
*and* `MAIL_PORT: 1025` explicitly — `MAIL_PORT`'s default (`1025`) actually
already matches, but setting it explicitly in CI's `env:` block documents the
full intended config for that environment rather than silently relying on a
default that happens to match.

**Q129. `_config` sets `MAIL_STARTTLS=False`, `MAIL_SSL_TLS=False`, `USE_CREDENTIALS=False`, `VALIDATE_CERTS=False` — isn't that insecure?**
Yes, by design — for Mailpit specifically. Mailpit (dev/test) is an
unauthenticated, plaintext SMTP sink with no certificate at all; any of those
being `True` would simply fail to connect to it. The comment in `app/mail.py`
notes "production would swap in real SMTP credentials via environment
variables" — these are dev-only settings, not hardcoded production config; a
real deployment would set `MAIL_USERNAME`/`MAIL_PASSWORD`/TLS flags via env
vars pointing at a real provider (SendGrid, SES, etc.).

**Q130. Where do `MAIL_USERNAME`/`MAIL_PASSWORD` defaults of `""` come from, and is that safe?**
`app/config.py` defaults both to empty strings, paired with `USE_CREDENTIALS=False`
— fastapi-mail simply won't attempt SMTP AUTH when `USE_CREDENTIALS` is
`False`, so the empty strings are never used as actual credentials. They exist
so `Settings` doesn't *require* these env vars to be set at all for local
dev/CI (where Mailpit needs none), while still being overridable for a real
provider.

**Q131. Why does email-sending happen via `background_tasks.add_task(...)` rather than `await`ing it directly in the route handler?**
Several routes (`forgot_password`, `forgot_pin`, registration/resend) call
`background_tasks.add_task(password_reset.send_current_code, user)` (etc.) —
FastAPI's `BackgroundTasks` runs this *after* the response has been sent to
the client. The user doesn't need to wait for an SMTP round-trip (even to a
local Mailpit, that's extra latency) before getting their `200 success`
response — email delivery is "fire and forget" from the request's perspective.

**Q132. Does using `BackgroundTasks` for email mean a failed send is silently swallowed — is that a problem?**
For this MVP, yes — if `mail.send_message` raised (e.g. Mailpit briefly down),
there's no retry/dead-letter handling, and the user already got a `200`. This
is an accepted MVP tradeoff: the *code* (and thus the ability to complete the
flow by re-requesting it) isn't lost — `forgot_pin`'s `429`+cooldown logic
means a user can simply request a new code if the email never arrived. A
production system would likely want a proper task queue (Celery/RQ) with
retries, but that's explicitly out of scope for this academic MVP.

**Q133. Why three separate email templates (`verification_code.html`, `password_reset_code.html`, `pin_reset_code.html`) instead of one generic "here's your code" template?**
Each purpose has a different message context for the recipient (registering
vs. resetting a forgotten password vs. resetting a PIN they may not have
requested) — wording like "If you didn't request this, ignore this email" is
purpose-specific and matters for security communication (e.g. a PIN-reset
email should make clear what action it's tied to, since the recipient already
has a full account). Three small templates keep each message's copy accurate
without conditional logic inside one template.

**Q134. How does `app/services/verification/{account,password_reset,pin_reset}.py`'s `send_current_code` know which template to use?**
Each module is purpose-specific (mirrored structure per the summary) and
constructs its own `MessageSchema(template_name="<purpose>_code.html",
template_body={"code": ..., ...})`, calling `mail.send_message(message,
template_name=...)`. The "which template" decision is made by *which module's*
`send_current_code` is called from the router — `forgot_password.py` calls
`password_reset.send_current_code`, `pin_reset.py`'s router calls
`pin_reset.send_current_code`, etc.

**Q135. Why is the code never included in the API JSON response, only the email?**
That *is* the security property: if `/auth/forgot-password` returned the code
in its JSON body, anyone could trigger a password reset for any email and read
the code directly from the HTTP response, without ever needing access to that
email's inbox — completely defeating the "prove you own this email" purpose.
The `backend/README.md` "Dev tooling" note ("verification codes are never
returned by the API or logged... read them from the Mailpit UI") makes this
explicit for developers who might otherwise look for a shortcut.

**Q136. Are verification codes ever logged server-side, e.g. for debugging?**
No — and per Q135, that's intentional. If they were written to application
logs, anyone with log access (which may be broader than "people who can read
this user's email") could complete any pending verification/reset flow. Mailpit's
web UI (`localhost:8025`) is the *only* place a developer can see a code, and
access to it requires being on the dev Docker network — a reasonable
dev-time proxy for "has access to the inbox."

**Q137. Why are the three verification "purposes" (`account_verification`, `password_reset`, `pin_reset`) baked into the HMAC rather than just having three different email templates with the same underlying code?**
This is the core anti-replay property explained in Section 13, but from the
email-template angle: even though the *visual* templates differ, the actual
*code value* a user receives must also differ per-purpose — otherwise a
`password_reset` email and a `pin_reset` email sent around the same `updated_at`
anchor could contain the *same string*, and a user (or attacker with access to
one email) could submit that code to the *other* endpoint. Folding `purpose`
into the HMAC input ensures the codes themselves are different strings per
purpose, regardless of template.

**Q138. The Jinja2 templates live under `app/templates/email/` — why not `app/static/` or a top-level `templates/`?**
`app/templates/email/` keeps templates colocated with the application package
(`app/`) they belong to, namespaced under `email/` in case other kinds of
templates (not email) are ever needed. `app/mail.py` computes
`_TEMPLATE_FOLDER = Path(__file__).parent / "templates" / "email"` —
relative-to-`__file__` pathing means this works regardless of the process's
working directory (important since `uv run uvicorn main:app` could be invoked
from different directories).

---

## 11. Authentication — JWT & Cookies

**Q139. Why JWT for parent sessions instead of opaque server-side session tokens (stored in a sessions table)?**
`AGENTS.md` §3 specifies "Secure stateless JWT... issued asynchronously by
FastAPI." A JWT is self-contained and verifiable without a DB lookup on every
request (`get_current_user` only needs to decode/verify the signature and read
`sub`/`scope`/`exp` — no `SELECT` against a sessions table). For this MVP's
scale, the simplicity of "no session table to manage, expire, or clean up"
outweighs the main downside of JWTs (can't be revoked server-side before
expiry) — see Q149 for how that downside is mitigated.

**Q140. Why `pyjwt` instead of `python-jose` or `authlib`?**
`pyjwt` is the minimal, focused library for exactly what's needed here —
encode/decode HS256 JWTs with standard claims (`sub`, `exp`, `iat`). `app/security/tokens.py`'s
`_make_token` is a thin wrapper around `jwt.encode`. `python-jose`/`authlib`
bring broader OAuth2/OIDC feature sets (multiple algorithms, JWKS fetching,
OAuth flows) that this app — a single first-party backend issuing its own
tokens — doesn't need.

**Q141. Why HS256 (symmetric) instead of RS256/ES256 (asymmetric)?**
HS256 uses one shared secret (`SECRET_KEY`) to both sign and verify — perfectly
adequate when the *same service* both issues and validates tokens (no
separate "auth server" vs. "resource server" split where a public key would
need to be distributed). RS256 matters when other services need to *verify*
tokens without being able to *forge* them (different keys for signing vs.
verification) — not the case here.

**Q142. What three claims does every token carry, and why each one?**
`sub` (subject — the user's UUID as a string, who this token is *about*),
`scope` (what this token is *for* — `"full"`, `"verify"`, or
`"password_reset"`, restricting which dependency will accept it), and `exp`
(expiry — when the token stops being valid) plus `iat` (issued-at, useful for
debugging/auditing token age). `_make_token(user_id, scope, expire_minutes)`
in `app/security/tokens.py` sets all four.

**Q143. Why three different cookies (`access_token`, `pending_verification_token`, `password_reset_token`) instead of one cookie with different `scope` claims?**
Cookies are scoped by `path` independently of JWT claims — `pending_verification_token`
is `path`-scoped to `/api/v1/auth/verify` and `password_reset_token` to
`/api/v1/auth/reset-password`. Using separate cookie *names* (in addition to
the `scope` claim inside each) means the browser itself won't even *send* a
`password_reset_token` on a request to, say, `/api/v1/profiles/children` —
two independent layers of restriction (cookie path scoping + server-side scope
check), rather than relying on the server alone to reject a misused token.

**Q144. Walk through why `pending_verification_token` has a 24-hour lifetime (`PENDING_VERIFICATION_TOKEN_EXPIRE_MINUTES = 60*24`) while the verification *code* itself expires in 10 minutes.**
These are deliberately different things at different layers: the *cookie/token*
just identifies "this browser is mid-verification for this user" — losing that
identity after only 10 minutes would be needlessly punishing (closing the tab
and coming back in an hour shouldn't require re-registering). The *code*
(emailed, 10-minute `VERIFICATION_CODE_EXPIRY_MINUTES`) is the actual
security-sensitive, short-lived secret; if it expires, `/auth/verify/resend`
mints a fresh one without needing a new pending token.

**Q145. Why is `access_token`'s lifetime a full 30 days (`ACCESS_TOKEN_EXPIRE_MINUTES = 60*24*30`)?**
The product context: "Devices are frequently shared" but realistically belong
to one family — `AGENTS.md` §1. A parent logging into the household's shared
device shouldn't need to re-enter their password every day; 30 days balances
convenience against the risk window of a stolen/lost device (which is also
mitigated by the separate parental PIN gate for the *parent* dashboard, even
within an active `access_token` session — `AGENTS.md` §3's "Dashboard Switching
Perimeter").

**Q146. Why `httponly=True` on every auth cookie?**
Prevents any JavaScript (including injected XSS payloads) from reading
`document.cookie` and exfiltrating the token — `AGENTS.md` §3: "Token Storage:
Handled via secure, HTTP-only cookies to mitigate Cross-Site Scripting (XSS)
token leakage." The frontend never needs to *read* these cookies' values
directly (the browser sends them automatically); it only needs
`credentials: 'include'` on requests.

**Q147. Why `secure=True` on every auth cookie, even in local dev (which is typically HTTP, not HTTPS)?**
`secure=True` means the browser will only send the cookie over HTTPS. The
Nginx reverse-proxy topology (Section 9) is the intended path even in dev,
and the project is built "secure by default" — rather than having different
cookie configs for dev vs. prod (a classic source of "works on my machine,
breaks in prod" cookie bugs), the same `secure=True` is used everywhere, and
local dev is expected to go through HTTPS (or browsers' `localhost`
exception, where some browsers treat `localhost` as secure even over HTTP).

**Q148. Why `samesite="lax"` rather than `"strict"` or `"none"`?**
`"strict"` would prevent the cookie being sent on top-level navigations
*arriving* from another site (e.g. clicking an email link to `/auth/verify`
that's a cross-site GET, if such a link existed) — `"lax"` allows cookies on
top-level GET navigations while still blocking them on cross-site
POST/embedded requests (the main CSRF vector), giving CSRF protection without
breaking normal link-following. `"none"` would require `secure=True` (already
set) but also disables the CSRF protection `"lax"` provides — unnecessary
since this isn't an embedded/cross-site-iframe use case.

**Q149. JWTs can't be revoked server-side before `exp` — how does `logout` actually "log out" a user, then?**
`logout.py`'s `response.delete_cookie(key="access_token", path="/")` removes
the cookie from the *browser* (sets `Max-Age=0`) — the JWT itself, if somehow
replayed (e.g. an attacker captured it before logout), would technically still
verify as valid until `exp`. This is the classic JWT tradeoff: logout is
"client forgets the token," not "server invalidates the token." Given
`httponly`+`secure` cookies make exfiltration hard in the first place, and the
MVP has no "log out all devices" requirement, this tradeoff is accepted rather
than building a token-blocklist.

**Q150. How would `get_current_user` actually reject a request — walk through the failure modes.**
From `app/dependencies/auth.py`: missing/unparseable `access_token` cookie →
401; JWT signature invalid or `exp` passed → 401 (pyjwt raises, caught and
re-raised as `HTTPException(401)`); `scope` claim isn't `"full"` → 401 (wrong
token type used on this endpoint); `sub` claim isn't a valid UUID → 401
"Invalid token" (via the shared `_extract_user_id` helper); user row for that
`sub` doesn't exist → 401; `user.is_active is False` → 403
`account_disabled`. Each is a distinct way the "is this a valid, currently-usable
full session" question can fail.

**Q151. Why does `_extract_user_id` exist as a *shared* helper across all three dependencies, rather than each dependency parsing `sub` itself?**
All three dependencies (`get_current_user`, `get_pending_verification_user`,
`get_password_reset_user`) need to do the same thing with the `sub` claim:
parse it as a `UUID`, returning the same 401 "Invalid token" if it's malformed.
A shared helper means that error message/behavior can't drift between the
three — fixing or improving it happens once.

**Q152. Why does `get_current_user` check `is_active` but `get_pending_verification_user` and `get_password_reset_user` don't (per the summary)?**
A disabled (`is_active=False`) account shouldn't be usable for *anything*
requiring a full session — hence the check in `get_current_user`. But
`get_pending_verification_user` is used by `/auth/verify` for an account that
hasn't even completed registration yet (no meaningful "disabled" state applies
mid-registration), and `get_password_reset_user` is a narrow, short-lived,
single-purpose token (Q143) for an account that — by the time it reaches
`forgot-password/verify` — has already been confirmed `is_active` by the
`forgot_password` endpoint itself (Q-Section-14). Re-checking `is_active`
there would be redundant.

**Q153. Why is `set_access_cookie`/`set_pending_cookie`/`set_password_reset_cookie`/`clear_*` centralized in `app/routers/auth/_shared.py` instead of inlined in each router?**
Every cookie's `httponly`/`secure`/`samesite`/`path`/`max_age` combination is
security-relevant and must be *consistent* — if `login.py` and
`register.py` each hand-rolled `response.set_cookie(...)` with slightly
different flags, a typo in one (e.g. forgetting `httponly=True`) would be a
silent vulnerability in just that one flow. `_shared.py` makes "set the access
cookie" a single reviewed implementation used by every flow that issues one
(login, verify, register-then-immediately-pending, etc.).

**Q154. Why is the underscore-prefix used for `_shared.py`, `_extract_user_id`, `_make_token`, etc.?**
Convention signaling "internal/private to this package, not part of the
public interface other modules should import directly." `_shared.py`'s
helpers are meant to be used by sibling modules within `app/routers/auth/`,
not imported from, say, `app/routers/profiles.py` — the underscore is a
readability cue (not enforced by Python) for "this is implementation detail of
the auth router package."

---

## 12. Password & PIN Hashing — bcrypt

**Q155. Why bcrypt instead of argon2 (mentioned as an alternative in `AGENTS.md` §3) or PBKDF2/scrypt?**
`AGENTS.md` §3 explicitly allows either ("`passlib` with `bcrypt` or
`argon2-cffi`"); bcrypt was chosen as the more battle-tested, simpler-to-configure
option with broad library support (`bcrypt` package directly, no `passlib`
wrapper needed) and a built-in salt — adequate for this MVP's threat model
(an attacker with DB access trying to crack hashed passwords/PINs offline).
argon2 is arguably stronger against GPU-cracking but adds tuning complexity
(memory/parallelism params) that wasn't necessary here.

**Q156. Why is the *same* `hash_secret`/`verify_secret` pair used for both passwords and the 4-digit parental PIN — isn't a 4-digit PIN trivially crackable regardless of hash algorithm?**
Yes — a 4-digit PIN has only 10,000 possibilities, so bcrypt's cost factor
doesn't make *offline* brute-forcing meaningfully hard if an attacker has the
hash. But the PIN's threat model (per `AGENTS.md` §3, "Dashboard Switching
Perimeter") is an *online*, rate-limited-by-UI check on a device the family
already controls — it's a "are you the parent, not the kid" UX gate, not a
cryptographic secret. Still hashing it (rather than storing plaintext) means a
DB leak doesn't trivially hand over PINs in cleartext, and reusing the same
`hash_secret`/`verify_secret` avoids a second hashing implementation for a
4-digit value.

**Q157. Why are `hash_secret`/`verify_secret` `async def`, given bcrypt itself is a synchronous, CPU-bound C function?**
This is the key async-correctness point (Q14's "one exception"): bcrypt's
hashing/verification is deliberately *slow* (that's the whole point — it
resists brute-forcing) and CPU-bound, meaning it would *block the entire event
loop* for that duration if called directly from an `async def` route. `app/security/hashing.py`
wraps the actual `bcrypt.hashpw`/`bcrypt.checkpw` calls in
`loop.run_in_executor(None, ...)`, moving the blocking work to a thread pool so
other requests' `await`s keep progressing.

**Q158. What would happen, concretely, if `hash_secret` were just `def` calling `bcrypt.hashpw` directly inside an `async def` route?**
Every *other* in-flight request — including unrelated ones like `/healthz` or
another user's `/auth/login` — would stall for however long bcrypt takes (tens
of milliseconds, by design) on a single-threaded event loop, because nothing
else can run until that synchronous call returns. Under any concurrent load,
this would manifest as periodic latency spikes across the whole API correlated
with login/register/PIN activity.

**Q159. Why `run_in_executor(None, ...)` — what does `None` mean as the first argument?**
`None` tells `asyncio` to use the *default* executor, which is a
`ThreadPoolExecutor` shared across the event loop. bcrypt's C implementation
releases the GIL during its computation, so running it in a thread actually
achieves parallelism (not just "moved off the event loop but still
serialized") — multiple concurrent bcrypt calls genuinely run concurrently
across threads.

**Q160. Where does the Ruff `ASYNC` rule set (Q70) become directly relevant to this hashing code?**
`flake8-async` rules specifically flag *blocking calls inside `async def`*
functions — if someone later "simplified" `hash_secret` back to a direct
`bcrypt.hashpw` call inside `async def`, `ASYNC` rules are designed to catch
exactly that class of regression (a sync, blocking call where async code is
expected) during `ruff check`.

**Q161. Why does `_DUMMY_PASSWORD_HASH` (login.py) need to be bcrypt-hashed too, rather than just a hardcoded string compared with `==`?**
Two reasons: (1) `verify_secret` expects a real bcrypt hash to parse (cost
factor, salt, digest) — a plain string would raise, not just return `False`.
(2) Critically for the timing-attack defense (Section 14), the *whole point*
is that `verify_secret(body.password, _DUMMY_PASSWORD_HASH)` takes
approximately the *same time* as verifying against a real user's hash — that's
only true if `_DUMMY_PASSWORD_HASH` is a real bcrypt hash with the same cost
factor (`bcrypt.gensalt()`'s default), computed once at module load.

**Q162. Is `_DUMMY_PASSWORD_HASH` regenerated on every request, or once?**
Once — it's computed at *module import time* (`_DUMMY_PASSWORD_HASH =
bcrypt.hashpw(b"timing-equalizer", bcrypt.gensalt()).decode()`, a module-level
constant in `login.py`). Regenerating it per-request would add unnecessary
bcrypt cost to every login attempt against an unknown email; a fixed constant
hash is just as effective for the timing-equalization purpose and costs
nothing extra per request.

---

## 13. Stateless Verification Codes

**Q163. Why design verification codes as "stateless" (HMAC-derived) instead of the original `email_verifications` table (storing `code_hash`/`expires_at`/`consumed_at`)?**
The original table-based design (first Alembic migration, Section 5) requires:
a write on code generation, a read+compare on verification, and a write to mark
`consumed_at` — three DB round trips per code, plus a cleanup story for
expired/consumed rows. The stateless design computes the *same* code
deterministically from `(user_id, purpose, users.updated_at)` — verification
becomes a pure computation + `hmac.compare_digest`, no extra table, no cleanup
job, and "consuming" a code is just bumping `updated_at` (a column that already
exists and is already written on most of these flows anyway).

**Q164. Walk through the exact formula: `HMAC(SECRET_KEY, "user_id:purpose:updated_at")`. Why these three inputs?**
- `user_id`: ties the code to *this specific account* — the same `purpose`
  and `updated_at` for a different user produces a completely different code
  (HMAC output depends on the full message).
- `purpose`: the discriminator that keeps a code minted for
  `account_verification` from validating against `/reset-pin` (Q137).
- `updated_at` (the "anchor"): the *time-varying* component — without it, the
  same `(user_id, purpose)` pair would always produce the same code forever,
  meaning a code never expires and is reusable indefinitely.
`SECRET_KEY` is the HMAC key — without it, anyone could compute valid codes for
any `(user_id, purpose, anchor)` they can observe (and `user_id`/`updated_at`
are not secret).

**Q165. Why HMAC-SHA256 specifically, rather than a plain SHA256 hash of the same string?**
A plain hash (`SHA256(user_id:purpose:updated_at)`) could be computed by
*anyone* who knows those three values — and `user_id` and `updated_at` aren't
secret (an attacker could potentially infer/guess `updated_at` to the minute,
and `user_id` if it ever leaked). HMAC incorporates `SECRET_KEY` as a key, so
the output is only computable by someone who knows the server's secret —
exactly the property "is this code genuinely something the server generated"
requires.

**Q166. Why fold the HMAC digest bytes into `VERIFICATION_CODE_CHARSET` (`"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"`) instead of, say, base64 or hex of the digest?**
Human-friendliness: this code is *typed by a human* (or copy-pasted) from an
email into a form. The charset deliberately *excludes* visually-ambiguous
characters — no `0`/`O`, no `1`/`I`/`L` (note `I` and `L` and `1` and `0` are
absent) — so a user reading "O" vs "0" or "I" vs "1" off a phone screen doesn't
transcribe it wrong. Base64/hex include exactly these ambiguous characters.

**Q167. `generate_code` does `charset[b % len(charset)] for b in digest[:VERIFICATION_CODE_LENGTH]` — why take the *first 8 bytes* of a 32-byte SHA256 digest, and why `% len(charset)`?**
`VERIFICATION_CODE_LENGTH = 8` defines the desired *output length* in
characters — only 8 digest bytes are needed to produce 8 characters (one byte
→ one charset index via modulo). Using more of the digest wouldn't add
meaningful security (8 bytes of a keyed HMAC already gives 32 charset-symbols^8
≈ astronomically many possibilities — far more than the 10-minute window allows
to brute-force) but would require a longer code, hurting usability. `% len(charset)`
(32 here) maps each byte (0-255) onto one of 32 charset positions —
note 256 isn't evenly divisible by 32... actually it is (256/32=8), so the
modulo introduces no bias here, which is a deliberate charset-length choice.

**Q168. Is there bias from `b % len(charset)` if `len(charset)` doesn't evenly divide 256? Does it matter here?**
`VERIFICATION_CODE_CHARSET` has exactly 32 characters, and 256 / 32 = 8 exactly
— so every charset character corresponds to exactly 8 byte values, with zero
modulo bias. If the charset length didn't evenly divide 256 (e.g. 30
characters), some characters would be very slightly more likely than others.
It doesn't matter cryptographically either way at this scale (the bias would
be negligible and the HMAC is still unforgeable), but the 32-character charset
was a clean choice that sidesteps the question entirely.

**Q169. Why is the expiry tied to `updated_at + VERIFICATION_CODE_EXPIRY_MINUTES` rather than storing an explicit `expires_at` somewhere?**
Because `expires_at(anchor)` is a *pure function* of the anchor
(`anchor + timedelta(minutes=...)`) — there's nothing to store. `is_expired`
and `seconds_until_resend` both just call `expires_at` and compare against
`now()`. The "no stored state" property (Q163) extends to expiry too: the
single `updated_at` column carries both "what code is currently valid" and
"until when."

**Q170. Why does `verify_code` upper-case and strip the submitted code before comparing (`submitted.strip().upper()`)?**
User input tolerance: someone copy-pasting a code from an email might
accidentally include leading/trailing whitespace (`strip()`), and the charset
is all-uppercase but a user might type lowercase on a mobile keyboard
(`upper()`). Since the charset has no case-sensitive pairs that could collide
(it's intentionally unambiguous, Q166), normalizing case before comparison
costs nothing and removes a common source of "valid code, rejected as wrong"
support complaints.

**Q171. Why `hmac.compare_digest` instead of `==` for comparing `expected == submitted`?**
`hmac.compare_digest` is a constant-time comparison — `==` on strings
short-circuits at the first differing character, so the *time* a comparison
takes can leak how many leading characters of a guess are correct (a timing
side-channel for brute-forcing one character at a time). For an 8-character
code with a 10-minute window this is a fairly low-severity concern in
practice, but `hmac.compare_digest` is the textbook-correct primitive for
"comparing a secret to user input" and costs nothing to use.

**Q172. `verify_code`'s docstring says it "does NOT check expiry... callers run `is_expired` separately so they can return a distinct 410." Why split these two checks instead of one `is_valid()` function?**
Because the *caller* needs to distinguish the two failure modes for different
HTTP responses in some flows: `reset_pin` returns `410` ("PIN reset code has
expired") for an expired-window case but `400` ("Invalid PIN reset code") for a
wrong-code case — different status codes communicate different things to the
frontend (410 might prompt "request a new code", 400 might prompt "check what
you typed"). A single `is_valid()` returning just `bool` would lose that
distinction. (Note: `/forgot-password/verify` deliberately *collapses* both
into the same `400` for anti-enumeration reasons — Section 14 — showing the
same primitives support both styles depending on the caller's needs.)

**Q173. Why do `password_reset.py`/`pin_reset.py`/`account.py` each have their own `rotate`/`is_window_open`/`send_current_code`/`verify` functions instead of one shared `verification_flow(purpose)` function parameterized by purpose?**
Each purpose has *different side effects* beyond the shared HMAC math:
`account.ensure_active` also (re)arms/disarms limbo-purge tasks;
`pin_reset.rotate` doesn't touch `password_hash`; each `send_current_code`
picks a different email template (Q134) and may include different template
variables. A single parameterized function would need a large
if/elif-per-purpose body — three small, purpose-named modules sharing the
`core` engine (composition) is more readable than one function with
purpose-conditional branches.

**Q174. What does "rotate" mean concretely, and why is it the verb used (vs. "generate" or "issue")?**
"Rotate" = `user.updated_at = core.now()` (bump the anchor) — which
*simultaneously* invalidates whatever code was previously valid (if any) *and*
makes a new code (derivable from the new anchor) become the current one.
"Generate"/"issue" would imply something is *created and stored*; "rotate"
accurately conveys "the single shared anchor moves forward, superseding
whatever it pointed to before" — consistent with the "at most one code live at
a time" model (Q38).

**Q175. `forgot_pin`'s `429` response includes `retry_after_seconds` from `seconds_until_resend` — why give the client this number rather than just "try again later"?**
UX: the frontend can render a live countdown ("you can request a new code in
4:32") instead of a user repeatedly clicking "resend" and getting errors. It's
computed as `max(0, int((expires_at(anchor) - now()).total_seconds()))` — i.e.
exactly how long until the *current* code's window closes (since a new code
can only be issued once the old window is closed, per `is_window_open`'s
anti-spam check).

**Q176. Is there a risk that two *different* purposes' codes could collide (same string) for the same user at the same anchor, given they share `updated_at`?**
No — `purpose` is part of the HMAC input (Q164), so
`HMAC(key, "user_id:account_verification:T")` and
`HMAC(key, "user_id:pin_reset:T")` (same `user_id`, same anchor `T`) produce
*different* HMAC digests, hence different codes, even though they share the
same anchor. What *is* shared is the *anchor* — and thus the *expiry window*
— not the code value itself.

---

## 14. Anti-Enumeration & Timing Attacks

**Q177. What is "user enumeration" and why does it matter for a family allowance app — isn't the data low-stakes?**
Enumeration is an attacker discovering *which email addresses have accounts*
(e.g. by noting "register" returns `409` for existing emails but `200` for
new ones, or "forgot password" behaves differently for known vs. unknown
emails). Even for a "low-stakes" app, this leaks PII (confirms a specific
person uses this service) and is a stepping stone to targeted attacks
(credential stuffing only the confirmed-valid emails, social engineering
specific families). It's cheap to prevent and a standard expectation for any
auth system, regardless of the app's stakes.

**Q178. Why does `/auth/login` return the *same* `401 "Invalid login credentials."` whether the email doesn't exist or the password is wrong — isn't a clearer error more user-friendly?**
A clearer error ("no account with that email" vs "wrong password") directly
answers "does this email have an account here?" for any attacker willing to
try. The marginal UX loss (a legitimate user with a typo'd email sees the same
generic message as a wrong-password user) is small — both cases are resolved
the same way ("check your email and password" / use forgot-password) — while
the security gain (no enumeration oracle on the most-attacked endpoint) is
significant.

**Q179. Walk through the *timing* side of login enumeration — what's the actual oracle if you *didn't* do the dummy-hash trick?**
If `user is None` short-circuited straight to `401` without calling
`verify_secret` at all, that branch would return in, say, ~1ms (a DB lookup
that found nothing). But `user is not None` + wrong password would take
~50-100ms (bcrypt's deliberate cost). An attacker measuring response times
across many emails could distinguish "fast 401 = no such account" from "slow
401 = account exists, wrong password" — without any difference in the
*response body*. The dummy-hash trick (Q161) ensures *both* paths always run
exactly one bcrypt verify, equalizing timing.

**Q180. Why is `is_active` checked *before* `email_verified_at` in `login.py`, with the explicit comment about ordering?**
If `email_verified_at is None` (limbo account) were checked first, a *disabled*
account that also happens to be unverified would get `403 account_unverified`
— potentially nudging an attacker (or a confused disabled user) toward the
verification flow for an account that's actually been administratively
disabled. Checking `is_active` first means a disabled account *always* reports
`account_disabled` regardless of its verification state — one consistent,
unambiguous signal for "this account is disabled," not two different signals
depending on an unrelated internal state.

**Q181. `/auth/forgot-password` always returns the same `200` — but doesn't the *email being sent or not* leak the same information to anyone who can see the user's inbox (or Mailpit)?**
Yes — but that's the *intended* channel. The point of anti-enumeration here is
that the HTTP *response* (what an attacker probing the API sees) is identical
regardless of account existence/state. Whether an email actually arrives is
only observable by someone with access to *that specific inbox* — which is
exactly the "proof of ownership" the flow is designed around. An attacker
without inbox access learns nothing from the API response; someone *with*
inbox access (the legitimate account owner) gets the real signal (an email, or
its absence) through the channel that's supposed to convey it.

**Q182. `/auth/forgot-password/verify` collapses "unknown email," "expired window," and "wrong code" into one `400 "Invalid or expired code."` — why not at least distinguish "expired" (410, like `/reset-pin` does)?**
Because `/auth/forgot-password` is *unauthenticated* and enumeration-sensitive
(Q177), whereas `/reset-pin` requires an existing `access_token` session — the
caller is already a known, authenticated user, so there's "no anti-enumeration
concern" (per `pin_reset.py`'s docstring) and `reset_pin` *can* afford to
distinguish `410` vs `400` for better UX. `/forgot-password/verify`'s `400`
for *every* failure mode (including "this email doesn't even exist") avoids
giving an attacker a 3-way oracle (exists-and-expired vs. exists-and-wrong-code
vs. doesn't-exist) — collapsing to one response code for all three.

**Q183. Does `/auth/register` leak enumeration via its `409` on duplicate email — isn't that the same problem as login?**
It's a narrower, more *necessary* leak: registration fundamentally has to tell
the user "this email is already registered" (otherwise how would a user know
to go to "forgot password" instead of registering again?) — unlike login,
where "wrong password" already gives the user their next step regardless. This
is a common, accepted tradeoff industry-wide: registration endpoints typically
*do* confirm email-already-exists (often even via email, e.g. "you tried to
register but you already have an account"), while *login* and *password-reset*
endpoints — which are repeatedly probeable without any account action — hide
it. The asymmetry is intentional, not an oversight.

**Q184. Is there rate-limiting on `/auth/login` or `/auth/forgot-password` to prevent brute-forcing, beyond the timing/enumeration protections?**
Not currently implemented — this is a known MVP gap. The timing-equalization
and response-collapsing protect against *enumeration* (learning *which*
accounts exist / *whether* a guess was close), but don't themselves rate-limit
*how many guesses* an attacker can make. A production deployment would add
rate-limiting (per-IP and/or per-email) at the reverse-proxy (Nginx) or
application layer — out of scope for Epic 1's authentication-flow
implementation but a natural follow-up.

---

## 15. Background Tasks — Limbo Purge

**Q185. What problem does the limbo-purge system solve, and why is it needed at all?**
Registration creates a `users` row *before* email ownership is proven
(`email_verified_at = NULL`, "limbo"). If a user registers with an email they
don't control (typo, or someone else's address) and never verifies, that email
would be permanently "taken" by a dead row — `email` is `UNIQUE`, so the real
owner could never register. The limbo-purge deletes such unverified accounts
after `ACCOUNT_LIMBO_PURGE_HOURS` (24h), "freeing the email... as if never
registered" (per `backend/README.md`).

**Q186. Why an `asyncio.Task` per pending account ("self-disarming promise") instead of a periodic cron-style sweep (e.g. "every hour, DELETE unverified accounts older than 24h")?**
A periodic sweep would need to run as a *separate process/scheduler* (cron,
Celery beat, APScheduler) — additional infrastructure for what's otherwise a
single-process FastAPI app. The `asyncio.Task` approach needs *no* extra
infrastructure: each registration spawns a task that `asyncio.sleep`s until
its own deadline, all within the same process already running the API. The
docstring's framing — "self-disarming promises" — captures that each task is
*specific to one account* and "defuses" itself on verification (Q187),
rather than a generic sweep re-checking everything repeatedly.

**Q187. What does "defuse" mean here, and why is it described as an *optimization*, not the actual safety mechanism?**
"Defuse" = `cancel_limbo_purge(user_id)`, called when a user verifies — it
cancels the in-memory `asyncio.Task` immediately, so it doesn't uselessly wake
up at its deadline only to find `email_verified_at` is now set and no-op. The
*actual* safety mechanism is `_discard_if_unverified`'s fire-time re-check
(`if user is None or user.email_verified_at is not None: return False`) — even
if `cancel_limbo_purge` were never called (e.g. a multi-process deployment
where the verifying request landed on a *different* worker than the one
holding the task), the task would still wake up, re-check, and correctly do
nothing. Defusing is purely "don't bother waking up for nothing"; correctness
doesn't depend on it.

**Q188. The module comment says the registry holds "strong references... asyncio keeps only weak refs" — what would break without `_pending: dict[UUID, asyncio.Task]`?**
`asyncio.create_task()` schedules a task, but if *nothing* holds a reference to
the returned `Task` object, it can be garbage-collected before it completes —
Python's docs explicitly warn about this ("Save a reference to the result").
A GC'd task simply stops running silently — an account meant to be purged in
24h might never be, with no error. `_pending` exists specifically to keep that
reference alive for the task's full lifetime (`task.add_done_callback(...)`
removes it from the dict once done, so the dict doesn't grow unboundedly
either).

**Q189. Why is `_pending` keyed by `user_id` (`UUID`) rather than, say, a list of tasks?**
Keying by `user_id` lets `cancel_limbo_purge(user_id)` find and cancel *that
specific account's* task in O(1) when it verifies — a list would require
scanning to find "the task for this user" (and tasks don't inherently carry
their associated user_id without extra bookkeeping). The key *is* the
bookkeeping.

**Q190. Walk through `rearm_pending_purges` — why is it needed, and what would happen without it?**
On every process restart (deploy, crash, `docker compose restart`), all
in-memory `asyncio.Task`s — including pending limbo-purges — are lost (they
were never persisted; only their *trigger condition*, `users.created_at`, is
in the DB). Without `rearm_pending_purges`, an account that registered 23
hours before a restart would simply *never* get purged — its deadline passed
silently with no task to act on it. `rearm_pending_purges` (called in
`main.py`'s `lifespan` startup) queries all `email_verified_at IS NULL` users
and calls `schedule_limbo_purge` for each — reconstructing every pending task
from durable state (`created_at`).

**Q191. What happens if `rearm_pending_purges` finds an account whose 24h deadline has *already passed* (e.g. the server was down for 2 days)?**
`_purge_after_limbo` computes `remaining = (deadline - now()).total_seconds()`
— if `remaining <= 0`, `asyncio.sleep` is skipped entirely (`if remaining > 0:`)
and `_discard_if_unverified` runs immediately. So an overdue account gets
purged essentially right away on the next startup, rather than the purge being
lost or delayed further.

**Q192. Why does `cancel_pending_purges` use `asyncio.gather(*tasks, return_exceptions=True)` after cancelling — why not just call `.cancel()` and move on?**
`.cancel()` only *requests* cancellation — it doesn't synchronously stop the
task; the task raises `CancelledError` the next time it's scheduled, which
happens asynchronously. `cancel_pending_purges` is called on app shutdown
(`lifespan`'s post-`yield`) and in the test `_cleanup_purge_tasks` fixture —
both contexts want to *wait* until all tasks have actually finished
unwinding before proceeding (shutdown completing cleanly; the next test
starting with no leftover tasks). `return_exceptions=True` ensures the
expected `CancelledError` from each cancelled task doesn't propagate as an
unhandled exception from `gather` itself.

**Q193. Is there a race condition where a user verifies *while* their purge task is mid-execution (e.g. just past `asyncio.sleep`, about to call `_discard_if_unverified`)?**
In principle, yes — but it's benign by construction: `_discard_if_unverified`
re-fetches the user (`session.get(User, user_id)`) and checks
`email_verified_at is not None` *at that moment*. If verification committed
first, the purge sees `email_verified_at` set and returns `False` (no delete).
If the purge's `session.get` + check happens first but verification is
concurrently committing, standard DB transaction isolation means one of the
two operations' effects will be consistently visible to the other — worst case
is a narrow window where verification *just barely* loses the race and the
account gets deleted moments after being verified, which would be a genuine
(if extremely unlikely, given the 24h vs. millisecond timescales) edge case.
This wasn't specifically tested but is an inherent tradeoff of avoiding
DB-level locking for a 24-hour-granularity check.

**Q194. Why is the purge a hard `DELETE` (via `session.delete(user)`) rather than a soft-delete (`is_active=False`), consistent with how `Child` deactivation works?**
Soft-delete (`is_active=False`) preserves the row — but the entire point of
purging is to *free the email* (the `UNIQUE` constraint on `users.email`
applies to soft-deleted rows just as much as active ones). A soft-deleted
limbo account would still permanently block that email from being
re-registered, defeating the purpose. Hard-delete is correct here specifically
*because* the row represents an account that was never confirmed to belong to
anyone.

---

## 16. Profiles & Onboarding

**Q195. Why is `onboarding_completed` a single boolean derived from two conditions (`parent_pin_hash IS NOT NULL AND children count >= 1`) rather than the frontend just checking both conditions itself via `GET /family`?**
`GET /family` *does* return both pieces of information (`onboarding_completed`
plus the `children` array, from which the frontend could derive child-count;
`parent_pin_hash` itself is never exposed). But `onboarding_completed` as a
stored, server-computed flag gives the frontend a single, stable signal — "has
this family completed setup, yes/no" — without needing to *re-derive* that
logic (and its two conditions) in frontend code, where it could drift from the
backend's definition of "onboarded."

**Q196. Why is `maybe_complete_onboarding` "one-way" (`if user.onboarding_completed: return` — never reverts)?**
Once a family has completed initial setup, deactivating their *last* remaining
child (Q197) shouldn't suddenly put them back into an "onboarding" UI state —
that would be a confusing regression for a family that's been using the app
normally. "Onboarding" specifically describes the *first-time setup
experience*; it's a one-time milestone, not a live computed "are both
conditions currently true" status.

**Q197. Given `onboarding_completed` is one-way, what happens if a family deactivates their only child — do they get stuck, or does anything break?**
Nothing breaks — `onboarding_completed` stays `true` (correctly: they *did*
complete onboarding once), and `PATCH /children/{id}` (deactivation) doesn't
re-run `maybe_complete_onboarding` at all (only `create_child`, `set_pin`, and
`reset_pin` do, per the README's flow descriptions) — deactivation doesn't
need to *re-check* a one-way flag that's already `true`, and if it's still
`false` (e.g. they deactivate before ever setting a PIN — unusual but
possible), deactivating a child can't *complete* onboarding anyway (it moves
the count *down*, never up).

**Q198. Why call `maybe_complete_onboarding` from *three* different places (`set_pin`, `reset_pin`, `create_child`) instead of computing `onboarding_completed` lazily whenever `GET /family` is called?**
Lazy computation on read would mean `onboarding_completed` is *always*
correct without needing multiple call-sites — simpler in one sense. But it
was modeled as a *stored, server-flipped* flag (per the data-model table:
"server-flipped once...") specifically so it behaves as a one-way milestone
(Q196/Q197) rather than a live-recomputed value — a lazy computation would
naturally be "live" (two-way) unless additional logic special-cased "don't
unset it," which is more complex than calling one helper from the few places
that can make either condition newly-true.

**Q199. Why does `create_child` count children with `select(func.count()).where(Child.user_id == current_user.id)` *including inactive* children for the `MAX_CHILDREN_PER_USER` cap — isn't that wasteful if a family churns through profiles?**
The README is explicit: "counts against `MAX_CHILDREN_PER_USER` even when
inactive" / "still counts toward the cap." This is a deliberate
anti-abuse choice: if deactivating freed up a cap slot, a malicious or
careless user could create unlimited `Child` rows by repeatedly
create-then-deactivate — each cycle leaving a permanent row in the table. With
inactive rows still counting, the cap (`MAX_CHILDREN_PER_USER = 10`) is a hard
ceiling on total rows ever created per user, which is also a reasonable proxy
for "this is a real family, not a script."

**Q200. Why `409 children_cap_reached` (dict-detail) rather than `400` or `403` for hitting the children cap?**
`409 Conflict` represents "the request is valid, but conflicts with the
current state of the resource" — the request to create a child is
well-formed, but the *family's current state* (already at the cap) conflicts
with creating another. `400` would suggest the *request itself* is malformed
(it isn't), and `403` suggests a *permissions* issue (it isn't — the user owns
this resource, they've just hit a quantity limit). The dict-detail shape
(`{"error": "children_cap_reached", "message": "..."}`) follows the same
machine-readable-error-code convention as `account_disabled`/`account_unverified`
(Q25), letting the frontend branch on `error` without string-matching
`message`.

**Q201. `PATCH /children/{id}` returns `404` if the child doesn't exist *or* belongs to another user, without distinguishing — why?**
Same anti-enumeration logic as Section 14, applied to resource ownership: if
the response *did* distinguish ("403 Forbidden — this child exists but isn't
yours" vs "404 Not Found — no such child"), a user could enumerate *other
families'* child IDs by noting which UUIDs return `403` vs `404`. Collapsing
both to `404` ("Child profile not found.") means a UUID belonging to another
family is indistinguishable from a UUID that doesn't exist at all.

**Q202. Why `409` (not `404` or `400`) when `PATCH /children/{id}` is called on an *already-inactive* child?**
Same `409 Conflict` reasoning as Q200: the request ("deactivate this child")
is well-formed and the child *exists and belongs to you* — but the resource is
already in the target state. `409` communicates "nothing to do, you're asking
for a state-change that's already happened" — distinct from `404` (doesn't
exist) and `400` (malformed request), and arguably more informative to the
frontend than silently returning `200` for a no-op (which could mask a bug
where the frontend thinks it just deactivated something it had already
deactivated earlier).

**Q203. Why does `GET /family` return *all* children (active and inactive) rather than just active ones — won't the frontend need to filter?**
Yes, by design — the README says "the frontend can filter on `is_active`."
A parent dashboard plausibly wants to show "Sara (active), Tomás (active),
Old Profile (deactivated)" — e.g. to let a parent *reactivate* a profile later,
or simply see family history — which requires the inactive ones to be present
in the response at all. Filtering a list client-side is trivial; the backend
returning a *subset* would make "show deactivated profiles" a feature the
backend would need to support via a query param instead.

**Q204. `ChildCreateRequest.name` uses `Field(min_length=1, max_length=100)` — why a *minimum* length of 1 (isn't that just "not empty," which `str` already sort-of implies)?**
Pydantic's plain `str` type *does* accept an empty string `""` as valid — `""`
is a string. `min_length=1` is what actually rejects an empty name at
validation time (`422`), before it ever reaches the database as a
meaningless empty `name` column. Without it, `POST /profiles/children` with
`{"name": ""}` would succeed and create a nameless child profile.

---

## 17. CI/CD

**Q205. Why does `.github/workflows/ci.yml` trigger on `push` to `main` but `pull_request` against `dev` — why two different target branches?**
This reflects the team's branch flow: feature work lands via PRs into `dev`
(so `pull_request: branches: [dev]` runs lint+test as a PR gate before merging
into the integration branch), while `push: branches: [main]` re-runs the full
suite when `dev`'s changes are eventually promoted to `main` (release branch)
— a final confirmation that what's shipping to `main` is still green,
independent of whatever state `dev` was in at each intermediate PR.

**Q206. Why use Postgres/Mailpit *service containers* in CI rather than, e.g., `docker compose up` using the repo's own `compose.yaml`?**
GitHub Actions' `services:` block is purpose-built for "ephemeral dependencies
a job needs" — it starts/stops the containers automatically, wires up
healthchecks, and exposes them on `localhost` to the job's steps, all without
the job needing Docker-in-Docker or Compose itself installed. Reusing
`compose.yaml` directly would also start the `proxy`/`frontend` services
(Section 9) that the *backend test job* has no need for — the service-container
approach lets CI declare exactly the two dependencies (`db`, `mailpit`) the
backend tests actually need.

**Q207. Why do the `db` and `mailpit` service containers use *different* healthcheck mechanisms (`pg_isready` vs. `wget` against an HTTP API)?**
Each checks the tool natively available for that image/protocol:
`postgres:17-alpine` ships `pg_isready` (a purpose-built Postgres readiness
probe) — using it is the standard, correct way to check Postgres health.
Mailpit doesn't speak a "readiness protocol" over SMTP in the same way, but it
*does* expose an HTTP JSON API (`/api/v1/info`) once its web UI is up — `wget
-qO-` against that endpoint is a simple "is the HTTP server responding" check,
reusing whatever's available in the Mailpit image (no extra tooling installed).

**Q208. The `backend-test` job's `env:` block hardcodes `SECRET_KEY: ci-test-secret-key` — is that a security problem (a "real" secret in plaintext in version control)?**
No — `SECRET_KEY` here only needs to be *some* fixed string so that
JWT signing/verification and HMAC verification-code generation (Section 13)
work *consistently within a single CI run*. It's never used to protect
anything that persists beyond the job (the Postgres container is destroyed
after the job), and CI runs are inherently ephemeral/throwaway environments.
Using a real secret (e.g. from GitHub Secrets) would be necessary for
*deploying* to a real environment, but would add no value for *running tests*
— and would risk that secret being printed in CI logs on a test failure.

**Q209. Why do the `db` service's env vars (`POSTGRES_USER`, etc.) get repeated in *both* the `services.db.env` block *and* the job-level `env:` block — isn't that duplication?**
They serve two different consumers: `services.db.env` configures *the Postgres
container itself* (how the `postgres:17-alpine` image bootstraps its
superuser/database on first start — same mechanism as `compose.yaml`'s
`env_file`, Q114). The job-level `env:` configures *the test process*
(`app/config.py`'s `Settings`, which builds `database_url` from
`POSTGRES_USER`/`PASSWORD`/`DB`/`HOST`/`PORT`) — these need to *match* the
container's credentials for the app to connect successfully, but they're
genuinely two different things being configured (the server vs. the client)
that happen to need the same values.

**Q210. Why `POSTGRES_HOST: localhost` and `POSTGRES_PORT: 5432` (with `ports: - 5432:5432` on the service) rather than referencing the service by its GitHub Actions service name?**
GitHub Actions service containers, when the job itself runs directly on the
runner (not inside its own container, as is the case here —
`runs-on: ubuntu-latest` with no `container:` key for the job), are reached via
`localhost` on their mapped ports — not via a service-name hostname (that
hostname-based addressing only applies when the *job* itself also runs in a
container on the same Docker network). `localhost:5432`/`localhost:1025` is
therefore the correct addressing for this job's configuration, mirroring how a
developer running tests directly on their host (outside Docker) would connect
to Compose's port-mapped services.

**Q211. If `backend-lint` and `backend-test` both check out the same code and could theoretically share setup, why is there no "shared setup" job they both depend on?**
Each job needs *different* setup (Q76: lint needs only `ruff`, test needs the
full `uv sync` + service containers) — a "shared setup" job would need to
produce an artifact (e.g. a built virtualenv) that both downstream jobs
restore, which adds complexity (artifact upload/download, cache key
management) for a marginal time saving on a project this size. Two independent
jobs that each do their own (cheap) setup is simpler and, run in parallel,
isn't meaningfully slower overall.

**Q212. Is there a deploy step in CI — what happens after `backend-test` passes?**
No — CI currently covers lint + test only; there's no `deploy`/`build-and-push-image`
job. This matches the project's current phase (academic MVP, local
Docker Compose-based dev/demo, no hosted environment yet) — a deploy stage
(e.g. building and pushing `ops/Dockerfile` to a registry, or deploying via
SSH/Compose to a server) would be a natural addition once there's an actual
target environment to deploy to.

**Q213. The CI workflow file lives at the repo root (`.github/workflows/ci.yml`) but both jobs set `working-directory: backend` — why is the workflow file itself not inside `backend/`?**
GitHub Actions *requires* workflow files to live under `.github/workflows/` at
the repository root — this isn't a choice, it's a platform constraint (Actions
won't discover workflows defined elsewhere). `defaults.run.working-directory:
backend` is how a root-level workflow scopes its *steps'* shell commands to the
`backend/` subdirectory of this monorepo (which also contains `frontend/`),
without needing `cd backend &&` prefixed on every `run:` line.

---

## 18. Project Structure & Conventions

**Q214. Why is the auth router split into 8 files (`register.py`, `verification.py`, `login.py`, `logout.py`, `forgot_password.py`, `reset_password.py`, `pin.py`, `pin_reset.py`) instead of one `auth.py` with all endpoints?**
Each file maps to one *conceptual flow* with its own docstring explaining the
flow's security model (e.g. `login.py`'s enumeration-resistance comments,
`pin_reset.py`'s "no anti-enumeration concern... unlike forgot-password"
framing). A single `auth.py` would mix together very different security
postures (anonymous + enumeration-sensitive vs. authenticated + not) in one
file, making it harder to review "does this specific flow handle X correctly"
in isolation. The split also keeps each file short enough to read in full
during review.

**Q215. Why are `forgot_password.py`/`reset_password.py` and `pin.py`/`pin_reset.py` split into *pairs* rather than each being one file (`password_reset.py`, `pin_management.py`)?**
Within each pair, one file handles the *unauthenticated, enumeration-sensitive*
half (`forgot_password.py`: request + verify a reset code, no session
required) and the other handles the *authenticated* half
(`reset_password.py`: actually change the password, requires the
`password_reset_token` cookie from the first half). Similarly `pin.py` is the
*always-authenticated* set/verify-PIN endpoints (no email involved at all),
while `pin_reset.py` is specifically the *email-based recovery* path for a
forgotten PIN. The split mirrors a genuine difference in auth requirements and
threat model between the two halves, not just file-size management.

**Q216. Why does `app/services/verification/` exist as a *package* (with `core.py` + three purpose modules) rather than three flat files at `app/services/`?**
Grouping them under `verification/` makes the relationship explicit at the
filesystem level: `core.py` is the shared engine, and `account.py`/
`password_reset.py`/`pin_reset.py` are siblings that *depend on* `core` and
share its conventions (mirrored function names: `rotate`, `is_window_open`,
`send_current_code`, `verify` — per the summary's "mirrored structure"). A
flat `app/services/verification_core.py`,
`app/services/verification_account.py`, etc. would convey the same
information through naming alone, but the package grouping makes "these four
files are one cohesive subsystem" visually obvious in a file tree.

**Q217. Why does `app/services/accounts.py` (singular concept: account lifecycle) hold *two* seemingly-unrelated things — limbo-purge AND `maybe_complete_onboarding`?**
Both are "account lifecycle state transitions that aren't tied to a single
HTTP request's direct purpose": limbo-purge is a transition that happens
*automatically* (time-based), and onboarding-completion is a transition that's
a *side effect* of several different endpoints (PIN set, PIN reset, child
created) rather than any one endpoint's primary job. `accounts.py` is the home
for "things that happen to a `User` row as a consequence of, but not as the
main point of, various flows" — as opposed to `verification/`, which is
specifically about the code-based proof-of-identity primitive.

**Q218. Why do `app/schemas/auth.py` and `app/schemas/profiles.py` live in a separate `schemas/` package from `app/models/models.py`, given SQLModel could theoretically serve both roles (Q29)?**
Even though SQLModel *can* double as a Pydantic schema, `app/models/models.py`
defines the *storage* shape (DB columns, FKs, indexes — things like
`parent_pin_hash`, `is_active`, timestamps that should never be part of a
request/response contract). `app/schemas/` defines the *wire* shape (what a
client sends/receives). Keeping them in separate top-level packages makes the
distinction structurally obvious — `models/` is "what's in the database,"
`schemas/` is "what's in an HTTP request/response body" — even on projects
where the two heavily overlap.

**Q219. Why `app/security/` (hashing.py, tokens.py) as its own package, separate from `app/services/`?**
`app/security/` contains *stateless, side-effect-free cryptographic
primitives* — given inputs, produce outputs, no DB access, no email, no
business logic (`hash_secret(plain) -> hash`, `verify_secret(plain, hash) ->
bool`, `_make_token(user_id, scope, minutes) -> jwt_string`). `app/services/`
contains *orchestration* — code that reads/writes the database, sends emails,
manages background tasks, and *calls into* `app/security/` and
`app/services/verification/` as building blocks. The separation is
"primitives" vs. "flows that use primitives," which also makes
`app/security/` trivially unit-testable without any DB/app context.

**Q220. Why does `app/dependencies/` exist as its own package for just `auth.py` (three functions)?**
`app/dependencies/auth.py`'s three functions
(`get_current_user`/`get_pending_verification_user`/`get_password_reset_user`)
are FastAPI `Depends(...)` providers — a distinct *role* in the architecture
(request-scoped guards that routers declare as parameters) from both
"primitives" (`app/security/`) and "orchestration" (`app/services/`), even
though they're implemented using primitives (`app/security/tokens.py`'s
decode functions). Naming the package `dependencies/` signals "these are
things you put in a route's function signature," distinct from things you
*call* from inside a route body.

**Q221. The `backend/README.md` "Project Structure" tree is fairly detailed (down to individual files with one-line descriptions) — why maintain that by hand instead of, say, generating it?**
For a project at this size (a few dozen files), a hand-maintained tree with
*intent* annotations ("durable limbo-purge, re-armed on startup" next to
`accounts.py`) conveys *why* a file exists, which an auto-generated `tree`
output never could. The cost is that it can drift if files are added/moved
without updating the README — a tradeoff accepted because the README is
explicitly the onboarding document for "Connecting the Frontend" /
understanding the system, where *intent* matters more than an always-perfectly-synced
file listing.

---

## 19. Error Handling & Response Conventions

**Q222. Beyond the global `IntegrityError`/`HTTPException` handlers (Q25-26), is there a consistent convention for *success* response shapes across endpoints?**
Most success responses include `"status": "success"` and a human-readable
`"message"` (e.g. `{"status": "success", "message": "Logged out
successfully."}`), often alongside endpoint-specific data (`reset_pin`'s
`expires_at`, `create_child`'s full child object). This isn't enforced by a
shared Pydantic `response_model` — each handler builds its own dict — but the
`status`/`message` pair recurring across nearly every mutating endpoint gives
the frontend a predictable "did this work, and what should I tell the user"
shape even where the rest of the payload varies.

**Q223. Why aren't `response_model=...` Pydantic schemas declared on most routes, given FastAPI supports (and typically encourages) them for response validation/docs?**
This is a pragmatic MVP gap rather than a deliberate architectural choice —
declaring `response_model` for every endpoint would improve `/docs`'
auto-generated examples and catch response-shape mistakes at the framework
level. It wasn't done for Epic 1's endpoints, likely because response shapes
were still being iterated against `docs/api-contract.md` during development;
adding `response_model` schemas retroactively (matching the shapes already
documented in the contract and README) would be a reasonable hardening pass.

**Q224. Why do some error responses use `detail` as a plain string (`{"detail": "Invalid or expired code."}`) while others use a dict (`{"error": "account_disabled", "message": "..."}`) — couldn't this inconsistency confuse frontend error-handling?**
It's actually a *deliberate two-tier convention* (Q25): a plain-string
`detail` is used for errors that are essentially "just show this message to the
user" (validation failures, generic 400/401/404s with one human-readable
sentence) — the frontend doesn't need to branch on *which* error this is,
just display it. A dict with `"error": "<machine_code>"` is reserved for
errors the frontend needs to *branch on programmatically* (e.g.
`account_unverified` → redirect to verification flow; `children_cap_reached`
→ show an upgrade/limit-reached UI) — these need a stable string the frontend
can `switch` on, which a free-text `detail` message wouldn't reliably provide
(message wording could change without the *meaning* changing).

**Q225. `forgot_pin`'s `429` response is built manually with `JSONResponse(status_code=429, content={...})` rather than `raise HTTPException(429, detail={...})` — why the inconsistency with how `children_cap_reached` (also a structured error) is raised?**
Both ultimately produce the same JSON shape thanks to `main.py`'s
`http_exception_handler` (dict `detail` → top-level dict, Q25) — so
`raise HTTPException(429, detail={...})` *would* work too. Building
`JSONResponse` directly in `forgot_pin` is a stylistic inconsistency rather
than a functional difference; `raise HTTPException(...)` is generally
preferable since it's interceptable by the global handler and keeps error
construction declarative (a `raise` short-circuits the function clearly,
whereas `return JSONResponse(...)` looks like — and is — a normal return
that could be missed in a quick read).

**Q226. Why does `verify_pin`'s `428` use the numeric code `428` ("Precondition Required") rather than `404`/`409`?**
`428 Precondition Required` is the semantically precise HTTP status for "you
can't do this yet because a prerequisite state hasn't been established" — here,
"you can't verify a PIN because no PIN has been set yet." `404` would suggest
"the verify-pin *endpoint*/resource doesn't exist" (it does); `409` (used for
the children cap and already-inactive-child cases, Q200/Q202) represents "your
request conflicts with current state" — closer, but `428` more specifically
says "set a PIN first, *then* this endpoint becomes usable," which is exactly
the relationship between `/auth/pin` and `/auth/verify-pin`.

---

## 20. AI Usage & Tooling

**Q227. The `backend/AI_USAGE.md` table lists "Claude Code (Sonnet 4.6)" for implementation, tests, and docs — why declare this at all, given it's not a typical software-engineering practice?**
It's a course requirement: `guide.md` §10.2 (NFR-07) mandates AI Usage
declarations, and the root `README.md` establishes the phase-based structure
(`## Phase 1`/`## Phase 2`/etc.) that `backend/AI_USAGE.md` mirrors —
per-directory declarations supplement the root one with backend-specific
scope (which files/directories were AI-assisted). It's a transparency/academic-integrity
artifact specific to this course's evaluation criteria, not a general industry
norm (though many teams do informally track this now).

**Q228. Why is `backend/AI_USAGE.md` a *table* rather than the bullet-list format the root README originally used?**
A table (`| Tool | Purpose | Scope |`) makes the three dimensions — *which*
tool, *for what*, *touching which files* — scannable at a glance and easy to
add rows to as new AI-assisted work happens, versus a bullet list where each
item would need to restate all three as prose. This was an explicit
follow-up request after the bullet-list version was first drafted matching the
root README's then-current structure.

**Q229. Why does `AI_USAGE.md` end with "All AI-assisted code was reviewed and is understood by the submitting team member" — isn't that implied?**
It directly addresses the likely concern behind an AI-usage-declaration
requirement in an academic context: not "was AI used" (which the table already
answers) but "do you, the student, actually understand what was produced" —
i.e., this isn't an academic-integrity violation where AI output was copied
without comprehension. The sentence makes that assurance explicit rather than
assumed.

**Q230. Given how much of this backend was AI-assisted, what's *not* AI-generated — what did the human team actually decide?**
The architectural *decisions* — tech stack (`AGENTS.md`'s table, predating any
implementation), the MVP scope boundaries (what's in/out of scope, the
RACI/decision protocol), the data model's two tables and their fields, the
auth flow design (cookie-based, PIN-gated dashboard switch), and the
stateless-verification-code *concept* — were specified by the team (primarily
Pedro Santos as Lead Architect per `AGENTS.md` §5) via specs (`specs/epic1/spec.md`)
and the API contract (`docs/api-contract.md`) *before* implementation. AI
assistance (per `AI_USAGE.md`) was scoped to *implementing* those specified
flows, writing tests against the specified contract, and keeping docs in sync
— translation of human-made decisions into code, plus the lower-stakes
mechanical work (lint fixes, test consolidation, CI wiring) covered in this
very session.

---

## 21. Logging & Observability

**Q231. NFR-05 asks for unit tests *and* logging. Tests existed early; why was logging added only now?**
The verification-code and account-lifecycle logic was the riskier, more
novel part of the system, so it got tests first — `pytest` catches *logic*
regressions before the code ships. Logging is an *operational* concern: it
matters once the app is running unattended (in Docker, in CI, eventually in
front of real users) and something needs investigating after the fact. It was
always planned, just sequenced after the auth/profile chunks (0-7 in the Epic
1 table) were functionally complete and tested.

**Q232. Why plain stdlib `logging` instead of `structlog`, `loguru`, or JSON logs?**
The MVP doesn't have a log aggregator (ELK, Loki, Datadog) to consume
structured JSON — `docker compose logs` / `make` output is read by a human in
a terminal. Stdlib `logging` is in the standard library (no new dependency),
every other library in the stack (`uvicorn`, `sqlalchemy`, `fastapi`) already
logs through it, and `logging.basicConfig` plus `logging.getLogger(__name__)`
is the smallest thing that works. If a later epic needs log aggregation, the
per-module loggers don't change — only `app/logging_config.py`'s formatter/
handler would, e.g. swapping in `python-json-logger`.

**Q233. Walk through `app/logging_config.py` and how it's wired into `main.py`.**
`configure_logging()` is a single function that calls
`logging.basicConfig(level=settings.LOG_LEVEL, format="%(asctime)s %(levelname)s %(name)s: %(message)s")`.
`main.py` calls it once, at module level, *before* `app = FastAPI(...)` — so
every logger created afterward (including inside FastAPI/uvicorn/SQLAlchemy)
inherits the root handler and level. Each module that logs does
`logger = logging.getLogger(__name__)`, so log lines are prefixed with e.g.
`app.routers.auth.login` — immediately telling you which file emitted the
line without grepping.

**Q234. Why plain-text lines (`%(asctime)s %(levelname)s %(name)s: %(message)s`) instead of JSON?**
Same reasoning as Q232 — there's no log shipper parsing JSON yet, and
plain text is what a developer actually reads with `docker compose logs -f
api` or in CI output. The format string is centralized in one place
(`app/logging_config.py`), so switching to JSON later (e.g.
`python-json-logger`'s `jsonlogger.JsonFormatter`) is a one-line change with
zero impact on the ~25 call sites that call `logger.info(...)`.

**Q235. How is the log level controlled, and what would you set in each environment?**
`LOG_LEVEL` is a new `Settings` field in `app/config.py` (default `"INFO"`,
documented in `.env.example`). Locally, `DEBUG` would show more detail while
developing a new flow; `INFO` (the default) is right for normal development
and for the CI test run — it captures every lifecycle event in this Q&A
without the volume of per-request `DEBUG` chatter; `WARNING` would be an
option if a noisy environment needs to suppress the routine "PIN
verification failed" / "login failed" lines and only see actual anomalies.

**Q236. What gets logged for the auth/profile flows — give the full inventory.**
One `logger.info`/`logger.warning` per security-relevant transition,
identified by `user_id` once resolved:
- **Registration & verification** (`register.py`, `verification.py`): new
  account registered; account verified; verification failed (expired/invalid
  code); verification resend (incl. `429` rate-limited).
- **Login/logout** (`login.py`, `logout.py`): login success; login failed
  (invalid credentials — no identifier, see Q237); login blocked
  (`account_disabled` / `account_unverified`); logout.
- **Password recovery** (`forgot_password.py`, `reset_password.py`):
  reset requested; reset code verified (or failed); password reset completed.
- **Parental PIN** (`pin.py`, `pin_reset.py`): PIN set; PIN verification
  success/failure; PIN-reset requested (incl. `429`); PIN-reset failed
  (expired/invalid code); PIN-reset completed.
- **Profiles** (`profiles.py`): child profile created (incl. `409
  children_cap_reached`); child profile deactivated.
- **Background lifecycle** (`app/services/accounts.py`, `main.py`): API
  startup/shutdown; limbo accounts re-armed on startup; a limbo account
  actually purged; onboarding-completion trigger firing.

**Q237. Why does a failed login log nothing identifying — not even `user_id` when the email *is* registered?**
Because the anti-enumeration guarantee (Q177-184) is about the *response*,
but logs are a side channel an attacker shouldn't be able to use either —
even indirectly, by inferring from log *volume* whether their guessed email
exists. If a failed login for a registered email logged `user_id=<uuid>`
while an unregistered email logged nothing, an attacker with read access to
logs (or to metrics derived from them) could distinguish the two cases
without ever seeing the HTTP response. So `login.py` logs the bare fact
"Login failed: invalid credentials" with no identifier at all, regardless of
which branch (`user is None` vs `not password_ok`) was hit.

**Q238. What is explicitly *never* logged, and why?**
Verification codes, passwords, PINs, `password_hash`/`parent_pin_hash`
values, and JWTs (access/pending/reset tokens) — these are exactly the
secrets the rest of the security design (Q139-184) protects, and a log line
is a much weaker storage medium than a `bcrypt` hash or an HMAC comparison:
logs often end up in less-access-controlled places (container stdout,
log aggregators, support tickets) than the database. Raw email addresses are
also avoided on failure paths for the enumeration reason in Q237 — `user_id`
(a non-enumerable UUID, already the case for every primary key per Q41-style
discussions) is the identifier of choice once an account is resolved.

**Q239. Does this logging change anything about the stateless verification-code design (Q163-176) or the `updated_at` anchor?**
No — and that's intentional. Logging here is for *observability/audit*
("what happened, when, to which account"), not a substitute store for the
verification anchor. The anchor still has to live in `users.updated_at`
because `/verify`, `/forgot-password/verify`, and `/reset-pin` need a
transactionally-consistent "current anchor right now" to recompute the HMAC
against — a log line is write-only and isn't queryable inside that request's
transaction. Logging *does* now record *when* an anchor rotation happened
(e.g. "Verification code resent: user_id=..."), which is useful for an audit
trail, but it doesn't reduce the one-column read each verification endpoint
already does.

**Q240. Is any of this logging covered by tests?**
Not yet directly — the 109 `pytest` tests (Q81-109) assert on HTTP responses
and DB state, not on `caplog` output. Adding `caplog`-based assertions (e.g.
"a failed `/auth/login` produces exactly one `WARNING`-level record containing
no email") would be a natural follow-up, especially for the anti-enumeration
logging rule in Q237 — a test that fails if someone later "helpfully" adds
`user.email` to that log line would catch the regression long before a code
review would.

---

*This document covers Epic 1 (Authentication & Profiles) as implemented at the
time of writing. As later epics (tasks, gamification, goals) are built, the
same "why" questions should be asked of those decisions too — this is a living
defense-prep document, not a one-time artifact.*
