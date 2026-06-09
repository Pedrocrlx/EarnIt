# GEMINI.md - EarnIt Project Context (Absolute Source of Truth)

This document provides the foundational architecture, product definition, and operational guidance for the EarnIt project. It serves as the primary reference for AI agents.

---

## 1. Executive Summary & Core Value
* **Product Definition:** EarnIt is a web application for allowance management based on performance and gamification. It is explicitly an educational and motivational tool, not a banking or financial solution.
* **Academic Context:** Developed within the *Project II – Web Programming* course.
* **The Core Loop:** Parent creates tasks -> Child completes tasks -> Parent approves tasks -> Child earns progress toward a visual goal.
* **Primary Target Audience:** Children aged 7 to 10 years old (and their parents). Devices are frequently shared, requiring seamless user-switching profiles.

---

## 2. Tech Stack & Environmental Blueprint

### Backend Infrastructure (This Repository)
| Component | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Language** | Python | 3.14+ (Leveraging improved f-strings) |
| **Framework** | FastAPI | Latest (Asynchronous REST API) |
| **ORM / Link** | SQLModel | Latest (Pydantic + SQLAlchemy) |
| **Database** | PostgreSQL | 17 |
| **Migrations** | Alembic | Latest |
| **Package Management** | `uv` | Modern Python packaging |
| **Linting & Formatting** | Ruff | Extremely fast linter/formatter |
| **Testing Suite** | Pytest | Unit and integration testing |

### Frontend Infrastructure
| Component | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Core Framework** | React | Latest (SPA) |
| **Build Tool** | Vite | Next-gen frontend tooling |
| **Styling Engine** | Tailwind CSS | Utility-first CSS |
| **UI Components** | Shadcn/ui | Radix UI primitives |
| **Runtime & PM** | Bun | JavaScript runtime and package manager |
| **Server State** | TanStack Query | API request management |
| **Global UI State** | Zustand | Lightweight state management |

### Architectural Enforcement & Standards
* **Local DevOps:** Containerized via Docker and Docker Compose.
* **API Communication:** Strictly RESTful JSON. Contract-first with automated documentation at `/docs`.
* **Code Quality:** Enforced through `.editorconfig` and `pre-commit` hooks (Ruff).

---

## 3. Core Security & Authentication Engine

* **Parent Authentication:** Secure stateless JWT issued by FastAPI via email/password.
* **Token Storage:** Secure, HTTP-only cookies.
* **Child Authentication:** Password-free access to the child dashboard from shared family devices.
* **Dashboard Switching:** Parent PIN required to switch from Child to Parent dashboard. PINs must be salted/hashed (e.g., `bcrypt` or `argon2-cffi`).

---

## 4. Functional Scope (MVP v1 Matrix)

### In Scope (MVP)
* **Parent:** Register/Login, Manage multiple child profiles, Create tasks (Title, Description, Reward, Expiry), Approve/Reject tasks, Define visual goals, View balance/history.
* **Child:** Password-free dashboard, View tasks with countdowns, Mark tasks complete (with photo proof), View balance/earnings.
* **Gamification:** Streak bonuses, Puzzle Reveal (goal image split into 10), Balance Toggle (Euro vs. real-world items).
* **Task Types:** 
  1. **Duty:** Regular responsibilities (Not Paid).
  2. **Extra Task:** Optional tasks (Paid).

### Out of Scope (MVP)
* Mobile Push Notifications, Tinder-style swipe approval, Avatar XP/Outfits, Virtual 3D coin jars, Payment gateways, Multiple simultaneous goals.

---

## 5. Team RACI & Decision Protocol

### RACI Matrix
* **Pedro Santos** (Project Owner, Lead Architect): Accountable & Responsible for System Architecture, API Design, UI/UX Design, Documentation, and Project Management. Final decision-making authority.
* **Nuno Silva** (Fullstack Developer): Responsible for Frontend/Backend execution, peer reviews, and technical feedback. Consulted on Architecture and UI/UX.

### Decision-Making Protocol for AI Agents
1. **Proposal & Brainstorming:** Pedro introduces initial technical blueprints, concepts, or API designs.
2. **Consultation Phase:** Nuno evaluates proposals, provides critiques, suggests optimizations, and verifies metrics.
3. **Final Resolution:** Pedro reviews feedback and makes the final decision. Nuno supports and assists in implementation.

---

## 6. Getting Started (Backend Repository)

### Prerequisites
- Docker & Docker Compose
- `uv` (for local development)
- Python 3.14

### Building and Running
```bash
make up-ba      # Start stack (API, DB, Mailpit)
make down       # Stop stack
make enter-db   # Access DB shell
```

### Local Development (without Docker)
```bash
uv sync
uv run uvicorn main:app --reload
```

---

## 7. Development Conventions

### Linting and Formatting
We use `ruff` (100 char line length, double quotes, import sorting).
```bash
uv run ruff check .
uv run ruff format .
```

### Database & Email
- Initial schema: `ops/postgres/init.sql/`
- Mailpit UI: `http://localhost:8025`
- SMTP: `localhost:1025`

---

## 8. Project Structure
- `main.py`: FastAPI entry point.
- `ops/`: Infrastructure (Dockerfile, Postgres scripts).
- `pyproject.toml`: Metadata and dependencies.
- `Makefile`: Convenience commands.
- `compose.yaml`: Docker Compose config.
