# Project Specification: EarnIt (API Integration)

## 1. Overview
EarnIt is a multi-tenant gamified web application for family allowance management based on task performance and milestone visualization.
**Goal:** Deliver an integrated frontend-backend experience where parents manage and validate household items from a secure cockpit, and children track tangible goals using highly visual interactive components on a shared household device. All client-side network actions are brokered directly through the unified NGINX gateway layer, abstracting internal microservice boundaries.

## 2. Tech Stack & Requirements Mapping
* **Runtime & Package Manager:** **Bun** (Frontend local execution, packaging, linting, and fast script running).
* **Frontend Framework:** **React (Latest SPA Pattern)** powered by **Vite** (Next-generation build tool with HMR).
* **Backend Core Framework:** **Python 3.14+** + **FastAPI** (Asynchronous, type-safe REST API using native `async/await`).
* **Database & ORM Layer:** **PostgreSQL 17** + **SQLModel** (Unified layer combining Pydantic validation & SQLAlchemy mapping).
* **UI & Styling:** **Tailwind CSS** + **Shadcn/ui** (Accessible layout components).
* **Ingress Ingress/Proxy:** **NGINX Gateway** (Brokers routing paths: `/` for frontend client, `/api` for backend services, `/docs` for Swagger).
* **HTTP Client Layer:** Native Fetch API or Axios configured with a baseline Axios Instance mapping base URL paths directly to `/api`.

## 3. Architecture & Integration Strategy

### 3.1 Network Topology & API Routing
All frontend communications hit the NGINX reverse proxy listening on standard web port `80`. The network boundary treats endpoints as relative origins:
* **Frontend Asset Access:** `http://localhost/`
* **API Ingress Boundary:** `http://localhost/api` ➡️ Maps internally to FastAPI on port `8000`.

### 3.2 Authentication & Session Isolation
* **Parent Authentication:** Secured via email and password strings converting to a persistent local session wrapper (JWT or cookie token).
* **Child Authentication:** Passwordless state machine. Profiling flows resolve child tokens using a parent dashboard session, enabling zero-password entry for children on shared home tablets.
* **Dashboard Guardrail:** Transitioning from the Child dashboard back to the Parent control console is intercepted on the client and validated on the backend via a secure 4-digit parental **PIN**.

### 3.3 Storage Strategy for Evidence
* **Upload Pipeline:** Child evidence uploads use multi-part form requests transmitted to `/api/tasks/{task_id}/submit`.
* **Persistence:** Backend intercepts binary images and maps them to local persistent Docker image storage volumes, exposing asset paths back to the client application.

---

## 4. Feature Breakdown & Business Rules (MVP)

### 4.1 Interface Splitting & Views
* **Parent Cockpit:** CRUD controls for chore lists, milestone target configuration, configuration of child sub-profiles, and verification queues.
* **Child Dashboard:** High-stimulus layout tracking interactive countdown tasks, streak progress indicators, and visual milestone charts.

### 4.2 Interactive Task Structural Mutation
Chores contain strict property validation blocks matching two specific backend domain models:
* **Duties:** Mandatory household jobs (e.g., making the bed). Paid: **No** (Enforces intrinsic values, generates zero balance increases).
* **Extra Tasks:** Optional milestone-linked jobs. Paid: **Yes** (Generates real financial value in Euros upon parent verification).

### 4.3 Core Business Constraints
* **Goal Ceiling:** Maximum 1 concurrent active goal target allowed per child profile (e.g., "PlayStation").
* **Visual Puzzle Breakdown:** The active goal price is split into exactly 10 programmatic increments. Accumulating increments unlocks pieces of a 10-piece structural puzzle overlay.
* **Balance Toggle Rule:** Client-side display allows toggling viewing metrics instantly between fiat standard formats (e.g., `€10.00`) and parent-defined commodity indexes (e.g., `5 Ice Creams`).

---

## 5. Integration Workflow (Chunked)

### **Chunk 0: Gateway & Client Linkage** (COMPLETED ✅)
* Configure Docker Compose multi-container link hooks.
* Wire NGINX routing parameters proxying downstream `/api` paths to FastAPI port `8000`.
* Initialize the React frontend with Bun, configuring the global HTTP Service Layer instance to direct all outbound service calls to `/api`.

### **Chunk 1: Authentication & Onboarding Integration** (IN PROGRESS 🔄)
* **Backend Endpoints:**
  * `POST /api/auth/register` (Parent account generation)
  * `POST /api/auth/login` (Parent login verification)
  * `POST /api/auth/logout` (Session clear utility)
* **Frontend Integration:**
  * Connect registration pages to `auth/register` endpoint schemas.
  * Connect login workflows to `auth/login`, caching parent auth cookies or secure context tokens in the browser client.
  * Enforce client routing wrappers restricting workspace views if active authorization context keys are missing.

### **Chunk 2: Profile Setup & PIN Protection Integration** (NOT STARTED ❌)
* **Backend Endpoints:**
  * `GET/POST /api/profiles` (Fetch/Create linked child sub-profiles; Name, avatar placeholder tags)
  * `POST /api/auth/verify-pin` (Validates parental 4-digit PIN access requests)
* **Frontend Integration:**
  * Build parental setup page mapping structural inputs directly to child profile creation arrays.
  * Implement the shared login profile picker component enabling fluid local switching.
  * Integrate an overlay modal block interception mechanism demanding parent PIN code checks whenever a user attempts to leave child dashboard contexts.

### **Chunk 3: Milestone & Task Factory Integration** (NOT STARTED ❌)
* **Backend Endpoints:**
  * `POST /api/children/{child_id}/goals` (Saves active target goal, purchase threshold price, and asset image reference)
  * `GET/POST/PUT/DELETE /api/tasks` (CRUD operations for individual tasks. Body mappings: Title, Description, Type enum `["Duty", "ExtraTask"]`, € Value, Expiration Datetime)
* **Frontend Integration:**
  * Create the parent goal management interface sending target price structures to the backend.
  * Connect the parent task manager form to the task creation endpoints, ensuring UI fields dynamically disable or hide reward values if the task type is set to unmonetized `Duty`.

### **Chunk 4: Child Core Dashboard & Progress Integration** (NOT STARTED ❌)
* **Backend Endpoints:**
  * `GET /api/children/{child_id}/dashboard` (Aggregated payload returns active child balance string, active goal details, and array of currently valid available tasks)
* **Frontend Integration:**
  * Implement the child dashboard payload consumer component, plotting active chores against precise structural timer countdown modules.
  * Program the client **Balance View Toggle** to transform the raw balance float using calculated parent-defined conversion ratios.
  * Connect balance progression rates to the procedural **Puzzle Reveal** canvas view, revealing a segment of the goal canvas whenever balance increments tick up by 10%.

### **Chunk 5: Photo Evidence & Verification Cycle Integration** (NOT STARTED ❌)
* **Backend Endpoints:**
  * `POST /api/tasks/{task_id}/submit` (Accepts multipart form-data image proof, toggling status state parameters to `Pending`)
  * `GET /api/parent/pending-approvals` (Returns collection of submitted child items including image URLs)
  * `POST /api/parent/approvals/batch` (Performs atomic array completions or rejections, recalculating wallet entries and updating streak records)
* **Frontend Integration:**
  * Connect camera snapshot/upload click events on the Child interface directly to the task submission multipart form endpoint.
  * Build the parent approval dashboard visualization queue rendering child photo attachments, connecting confirmation items directly to single-action or **Batch Approval** backend endpoints.