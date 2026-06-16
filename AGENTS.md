# Repository Guidelines

## Project Structure & Module Organization

EarnIt is a full-stack app: React/Vite frontend, FastAPI backend, PostgreSQL, Mailpit, and Nginx for the full Docker stack. Root `compose.yaml` runs the complete stack. Backend code is in `backend/src/`: routes in `api/`, settings in `core/`, database setup in `db/`, models in `models/`, schemas in `schemas/`, and business logic in `services/`. Backend tests live in `backend/tests/`; migrations live in `backend/alembic/`. Frontend code is in `frontend/src/`, with components, auth context, API helpers, pages, and assets split under matching subdirectories. API contracts and contribution docs are under `docs/`.

## Build, Test, and Development Commands

- `docker compose up --build`: start the full stack through Nginx on port 80.
- `cd backend && make up-ba`: start backend, PostgreSQL, and Mailpit.
- `cd backend && uv run uvicorn main:app --reload`: run the API locally on port 8000.
- `cd backend && uv run pytest tests/ -q`: run backend tests.
- `cd backend && make format` / `make lint-fix`: format or auto-fix Python with Ruff.
- `cd frontend && bun run dev`: run Vite locally.
- `cd frontend && bun run build`: type-check and build the frontend.
- `cd frontend && bun run lint`: run ESLint.

## Coding Style & Naming Conventions

Python targets 3.14 and uses Ruff with 100-character lines, double quotes, import sorting, and modern Python rules. Keep FastAPI route modules focused by feature, and place shared business rules in `backend/src/services/`. Use snake_case for Python modules, functions, and test helpers.

Frontend code uses TypeScript, React, Tailwind CSS, and ESLint. Name React components and pages in PascalCase, for example `DashboardPage.tsx`; use lower camelCase for hooks and helpers.

## Testing Guidelines

Backend tests use pytest and pytest-asyncio. Add tests in `backend/tests/` named `test_<feature>.py`, and reuse fixtures from `tests/conftest.py`. Integration flows expect PostgreSQL and Mailpit. Frontend test infrastructure is not currently defined; validate frontend changes with `bun run lint` and `bun run build`.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit-style messages such as `feat:`, `fix(frontend):`, `fix(CI):`, `refactor(structure):`, and `docs:`. Keep commits scoped and imperative. Pull requests should include a short description, linked issue or task, test commands run, and screenshots for visible UI changes.

## Security & Configuration Tips

Never commit `.env` files, secrets, JWTs, verification codes, passwords, PINs, or hashes. Backend local setup starts from `backend/.env.example`; generate a strong `SECRET_KEY`. During local auth testing, read email codes from Mailpit at `http://localhost:8025`.
