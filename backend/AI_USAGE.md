# AI Usage — Backend

This document declares AI tool usage specific to the `backend/` directory, as
required by `guide.md` (§10.2) and summarized in the root [README.md](../README.md#ai-usage-section).

All entries below use **Claude Code (Sonnet 4.6)**, following the chunked
breakdown in `specs/epic1/spec.md`. All AI-assisted code was reviewed and is
understood by the submitting team member.

## Chunk 1 — Crypto & Auth Utilities
`app/security/`, `app/services/verification/core.py`

- This is the shared primitive (bcrypt hashing, JWT scopes, the stateless HMAC
  verification-code engine) every later chunk reuses — getting it right *once*
  meant Chunks 2/4/5 didn't each re-derive the same crypto logic.
- **Advice:** front-load AI assistance on shared/foundational modules first.
  Mistakes here would have propagated into three different flows; reviewing
  one small, well-tested core module is far cheaper than reviewing the same
  logic copy-pasted three times.

## Chunk 2 — Registration & Email Verification
`app/routers/auth/register.py`, `app/routers/auth/verification.py`, `app/services/accounts.py`

- The durable, self-disarming limbo-purge background task (survives process
  restarts via `users.created_at`) is the kind of asyncio pattern that's easy
  to get subtly wrong — task GC, double-purge races, re-arming on startup.
- **Advice:** for concurrency-heavy code, ask the AI to write the tests
  *alongside* the implementation (not after) and read both together. The
  asyncio plumbing is where a quick read-through is most likely to miss a
  race condition that a test would catch.

## Chunk 3 — Login & Logout
`app/routers/auth/login.py`, `app/routers/auth/logout.py`

- Anti-enumeration logins have failure modes that "look right" but leak via
  timing or response shape (constant-time dummy-hash comparison, the
  `is_active`/`email_verified_at` check ordering).
- **Advice:** for security-sensitive flows, have the AI generate the
  *adversarial* test cases (Q177-184 in `DEFENSE_QA.md`) alongside the
  implementation. Reviewing "does this leak whether the email exists?" is much
  easier with a concrete failing/passing test than by reading the code alone.

## Chunk 4 — Forgot/Reset Password
`app/routers/auth/forgot_password.py`, `app/routers/auth/reset_password.py`, `app/services/verification/password_reset.py`

- Mechanical reuse of the Chunk 1 primitive (`purpose=password_reset`) across
  a new three-step flow.
- **Advice:** this was the highest AI-time-saved-to-review-effort ratio of the
  whole epic — once the primitive (Chunk 1) and the pattern (anti-enumeration
  from Chunk 3) are both established and reviewed, applying them to a new flow
  is low-risk, high-volume boilerplate.

## Chunk 5 — Parental PIN & PIN Reset
`app/routers/auth/pin.py`, `app/routers/auth/pin_reset.py`, `app/services/verification/pin_reset.py`

- The onboarding-completion trigger (`parent_pin_hash` set **and** ≥1 child)
  has *two* independent entry points (`/pin` and, later, `/profiles/children`
  in Chunk 6).
- **Advice:** when a condition needs checking from multiple call sites, ask
  the AI to extract it into a shared helper (`maybe_complete_onboarding` in
  `app/services/accounts.py`) *before* the second call site exists — otherwise
  it's tempting to duplicate the check "just this once" and the two copies
  drift.

## Chunk 6 — Child Profiles & Family View
`app/routers/profiles.py`, `app/schemas/profiles.py`

- Straightforward CRUD over an already-modeled table (`MAX_CHILDREN_PER_USER`
  cap, soft-deactivation, family summary).
- **Advice:** even "boring" CRUD has sharp edges worth double-checking in
  review — e.g. the cap counts *deactivated* children too, and the
  ownership check returns `404` (not `403`) for another user's child to avoid
  confirming the child exists at all.

## Chunk 7 — Final Lint Pass
repo-wide (`backend/`)

- A single `ruff check`/`ruff format` pass after all chunks landed (import
  ordering, `datetime.now(UTC)` consistency, error-message wording).
- **Advice:** save mechanical lint/format cleanup for *one* pass at the end
  rather than chunk-by-chunk — auto-fixes are low-risk by construction, so
  reviewing one combined diff is faster than re-reviewing the same kind of
  change seven times.

## Test Suite
`tests/` (`conftest.py` + one file per feature, ~109 tests)

- Tests were written from the *spec's documented contract* (`docs/api-contract.md`),
  not from the implementation.
- **Advice:** writing tests from the spec rather than the code is a deliberate
  choice — it makes the test suite double as an independent check on the
  implementation. Several edge cases (e.g. deactivated children still counting
  toward the cap) were caught *because* the test and the code came from the
  same spec but different reasoning paths, not because one was copied from the
  other.

## Logging
`app/logging_config.py`, `app/config.py`, `app/routers/auth/*.py`, `app/routers/profiles.py`, `app/services/accounts.py`

- One shared stdlib `logging` config, ~20 security/lifecycle events logged by
  `user_id`, with a hard rule: never log secrets (codes/passwords/PINs/hashes/
  JWTs), and on login failure, log *no* identifier at all (anti-enumeration
  applies to logs too, not just HTTP responses).
- **Advice:** for anything touching "what gets logged," design the rules
  (what/never-what) in conversation *first*, then have the AI apply that
  agreed design consistently across every file. Consistency across ~10 files
  is the hard part — a human reviewing file-by-file is more likely to miss the
  one spot that breaks the rule than the AI is to apply it unevenly, provided
  the rule was nailed down before implementation started.

## Defense Q&A
`backend/DEFENSE_QA.md` (240 Q&A, 21 sections)

- A defense-prep document grounded by reading the actual implementation
  file-by-file before answering "why" questions about every technical
  decision.
- **Advice:** this kind of document is most useful when generated *late*,
  after the code it describes has stabilized — and the grounding step (AI
  re-reading each module before writing the answer) is itself a free
  informal consistency check, separate from the document's stated purpose.
