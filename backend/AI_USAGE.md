# AI Usage — Backend

This document declares AI tool usage specific to the `backend/` directory, as
required by `guide.md` (§10.2) and summarized in the root [README.md](../README.md#ai-usage-section).

## Phase 3

| Tool | Purpose | Scope |
|---|---|---|
| **Claude Code (Sonnet 4.6)** | Implement Epic 1 (Authentication & Profiles) — registration/email verification, login/logout, forgot-password, parental PIN set/verify/reset, and child profile management — following the chunked breakdown in `specs/epic1/spec.md`. | `app/routers/auth/`, `app/routers/profiles.py`, `app/services/`, `app/dependencies/`, `app/security/` |
| **Claude Code (Sonnet 4.6)** | Write and refactor the `pytest` suite (one file per feature), including coverage-driven edge-case tests for the auth dependencies and shared fixtures/helpers. | `tests/` |
| **Claude Code (Sonnet 4.6)** | Apply `ruff` lint/format fixes and keep documentation in sync with the implemented code. | `backend/README.md`, `specs/epic1/spec.md` |

All AI-assisted code was reviewed and is understood by the submitting team
member; see the root README's AI Usage section for tooling used outside the
backend (documentation, infrastructure, design).
