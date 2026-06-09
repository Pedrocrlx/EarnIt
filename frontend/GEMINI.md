# EarnIt Frontend

A modern React application built with TypeScript, Vite, and Tailwind CSS.

## 1. Executive Summary & Core Value
* **Product Definition:** EarnIt is a web application for allowance management based on performance and gamification. It is explicitly an educational and motivational tool, not a banking or financial solution.
* **The Core Loop:** Parent creates tasks -> Child completes tasks -> Parent approves tasks -> Child earns progress toward a visual goal.
* **Primary Target Audience:** Children aged 7 to 10 years old (and their parents). Devices are frequently shared, requiring seamless user-switching profiles.

## 2. Tech Stack

### Frontend Infrastructure
| Component | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Core Framework** | React 19 | Latest (SPA) with React Compiler active |
| **Build Tool** | Vite 8 | Next-gen frontend tooling |
| **Language** | TypeScript 6 | Strict typing enforced |
| **Styling Engine** | Tailwind CSS 4 | Vite Plugin, high-performance styling |
| **UI Components** | Shadcn/ui | Radix UI + Hugeicons (fully accessible) |
| **Runtime & PM** | Bun | All-in-one runtime and package manager |
| **Server State** | TanStack Query | Managing API requests and caching |
| **Global UI State** | Zustand | Lightweight state for sidebar/themes/profiles |
| **Testing Suite** | Jest | Unit testing and component behavior mapping |

### Backend Infrastructure (Context)
| Component | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Language** | Python 3.14+ | Improved f-strings |
| **Framework** | FastAPI | Asynchronous REST API |
| **ORM / Link** | SQLModel | Pydantic + SQLAlchemy |
| **Database** | PostgreSQL 17 | Users, accounts, and profiles |
| **API Comm.** | RESTful JSON | Contract-first with OpenAPI |

## 3. Architecture & Security

### Project Structure
- `src/components/ui`: Reusable UI components managed by Shadcn.
- `src/lib/utils.ts`: Core utility functions (e.g., `cn` for Tailwind class merging).
- `src/assets`: Static assets like logos and icons.
- `ops/`: Infrastructure and deployment configuration (Dockerfile, entrypoint).

### Security Model
- **Parent Auth:** Secure stateless JWT issued by FastAPI, stored in secure, HTTP-only cookies.
- **Child Auth:** Password-free, direct access via shared family device.
- **Switching Perimeter:** Transitioning from Child to Parent dashboard requires a parent-defined PIN (verified via `/api/v1/auth/verify-pin`).

## 4. Functional Scope (MVP)

### In Scope
- **Parent:** Manage child profiles, create tasks (Duty vs Extra Task), approve/reject tasks, define 1 visual goal per child, view balance sheets.
- **Child:** View tasks with expiry countdown, mark complete with photo proof, view balance/earnings.
- **Gamification:** Streak Bonus, Puzzle Reveal (goal image split into 10 pieces), Balance Toggle (Euro vs items).

### Task Types
1. **Duty:** Regular responsibilities. Not Paid.
2. **Extra Task:** Optional tasks. Paid.

## 5. Development Workflow

### Getting Started
- **Prerequisites:** [Bun](https://bun.sh/) installed locally or Docker.
- **Installation:** `bun install`
- **Development:** `bun run dev`
- **Build:** `bun run build`
- **Lint:** `bun run lint`

### Conventions
- **Path Aliases:** Use `@/` to reference `src/`.
- **Styling:** Follow Tailwind CSS 4 patterns. Use `cn` helper.
- **Component Pattern:** Use Shadcn UI. `npx shadcn@latest add [component-name]`.
- **Type Safety:** Maintain strict TypeScript typing.
- **React Compiler:** Active; optimizes rendering automatically.

### Infrastructure
- **Docker:** Uses `node:24.16-slim` with Bun installed.
- **Orchestration:** `compose.yaml` in root.

## 6. Team RACI
- **Pedro Santos** (Project Owner, Lead Architect): Accountable for System Architecture, API/UI Design, and Project Management. Final decision authority.
- **Nuno Silva** (Fullstack Developer): Responsible for Frontend/Backend execution and peer reviews. Consulted on Architecture/UI.
