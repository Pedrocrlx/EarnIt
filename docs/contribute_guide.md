# Contributing Guide

Thanks for helping improve EarnIt. This guide explains how to run the project locally and submit changes cleanly.

## Project structure
- `backend/` FastAPI API + PostgreSQL
  - `backend/mail/` Mailpit (dev SMTP sink), isolated and included by the compose files below
- `frontend/` React (Vite) SPA
- `compose.yaml` full stack (Nginx + API + DB + Frontend, includes `backend/mail/compose.yaml`)

## Local development

### Full stack (recommended for end-to-end flow)
From the repo root:
```bash
docker compose up --build
```
Then open:
- App: http://localhost
- API docs: http://localhost/docs

### Backend only (API focus)
From `backend/`:
```bash
docker compose up --build
```
Then open:
- API docs: http://localhost:8000/docs

### Frontend only (UI focus)
From `frontend/`:
```bash
docker compose up --build
```
Then open:
- App: http://localhost:3000

## Database notes
The backend stack uses PostgreSQL and initializes with `backend/ops/postgres/init.sql` when present. Environment variables are loaded from `backend/.env`.

## Before you open a PR
- Keep changes focused and scoped to the feature or fix.
- Run any existing checks relevant to your changes (lint/build/tests if present).
- Update documentation when behavior or setup changes.
