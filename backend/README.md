# EarnIt Backend

This directory contains the FastAPI backend for the EarnIt application.

## Tech Stack
- **Language:** Python 3.14+
- **Framework:** FastAPI
- **Database:** PostgreSQL 17
- **ORM:** SQLModel
- **Package Manager:** [uv](https://github.com/astral-sh/uv)
- **Main Dependencies:** `fastapi[standard]`, `sqlmodel`, `alembic`

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

## Development Conventions
- **Linting:** We use `ruff` for linting and formatting.
- **API Docs:** When running, access the interactive docs at `/docs`.
