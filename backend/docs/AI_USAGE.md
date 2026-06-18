# AI Usage — Backend

This declares how AI was used in the `backend/` directory, as required by
`guide.md` (§10.2) and summarized in the root
[README.md](../../README.md#ai-usage-section).

**Tool:** Claude Code, used as a coding assistant throughout the backend. All
AI-assisted code was read, reviewed, and is understood by the team — nothing
went in that we can't explain or defend.

## How we used it

- **Planning the structure.** Sketching the module layout
  (api / services / models / schemas) and talking through the trickier designs
  before writing them — for example how unverified ("limbo") accounts get
  cleaned up, which we settled on as a daily purge sweep over a `users` query.
- **Spotting reuse.** A lot of the value was noticing where the same logic
  showed up in different places and writing it once instead of three times. The
  clearest case is the stateless verification-code engine: a single core reused
  for account verification, password reset, and PIN reset, with one `flows`
  helper parameterized by purpose rather than a near-identical module per flow.
  Similarly, the onboarding-completion check and the token→user auth logic each
  live in one shared helper rather than being copied across call sites.
- **Challenging over-engineering.** We ran the assistant over the codebase
  specifically to flag speculative abstractions and dead flexibility, then cut
  them: collapsing the three per-purpose verification modules into one, replacing
  per-account purge timers with a single periodic sweep, and removing config
  knobs nobody changed. Each cut was reviewed against "does this still do what
  it did, and can we explain why it's simpler" before keeping it.
- **Drafting and review.** Generating the routine boilerplate (routers,
  schemas), writing tests against the documented API contract, and helping with
  documentation — as well as drafting commit messages and pull-request
  descriptions — always with a human read-through afterwards.
- **Mechanical cleanup.** Running the lint/format passes and tidying small
  consistency issues in one go.

## Scope and limits

- Used across the backend's routers, services, schemas, tests, and docs.
- **Not** used to make architectural calls we couldn't justify ourselves: the
  stack choice, the data model, and the auth/verification design were decided by
  the team and the assistant filled in the implementation.
- Every refactor above kept the test suite green and the docs in sync, so the
  behaviour the assistant touched is pinned by tests we can point to.

For the deeper "why" behind specific decisions, see
[DEFENSE_QA.md](DEFENSE_QA.md).
