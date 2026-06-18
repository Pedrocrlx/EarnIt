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
  before writing them — for example the durable background task that purges
  unverified accounts.
- **Spotting reuse.** A lot of the value was noticing where the same logic
  showed up in different places and writing it once instead of three times. The
  clearest case is the stateless verification-code engine: a single core reused
  for account verification, password reset, and PIN reset. Similarly, the
  onboarding-completion check lives in one shared helper rather than being
  duplicated across the endpoints that can trigger it.
- **Drafting and review.** Generating the routine boilerplate (routers,
  schemas), writing tests against the documented API contract, and helping with
  documentation — as well as drafting commit messages and pull-request
  descriptions — always with a human read-through afterwards.
- **Mechanical cleanup.** Running the lint/format passes and tidying small
  consistency issues in one go.

For the deeper "why" behind specific decisions, see
[DEFENSE_QA.md](DEFENSE_QA.md).
