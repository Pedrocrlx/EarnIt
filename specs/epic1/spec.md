# Backend Functional Specification: Epic 1 - Authentication & Profiles (`spec.md`)

## 1. Overview

EarnIt is an allowance management and gamification web application designed as an educational tool for children aged 7 to 10 and their parents. This specification covers the complete backend architectural design, database schemas, API endpoints, and security infrastructure required for **Epic 1: Authentication & Profiles**.

**Goal:** Deliver a secure, high-performance asynchronous identity and profile management engine. This includes parent registration, session management, secure dashboard cross-switching via parental PIN authentication, and independent multi-profile management for children sharing a single physical device.

---

## 2. Tech Stack & Requirements Mapping

All backend systems must strictly conform to the technical boundaries outlined below:

* **Language:** Python 3.14+ (leveraging improved f-strings and performance traits).
* **Core Framework:** FastAPI (Asynchronous REST API, utilizing native `async`/`await` primitives for non-blocking I/O).
* **ORM & Data Link:** SQLModel (combining Pydantic validation schemas with SQLAlchemy runtime capabilities for unified type safety).
* **Database infrastructure:** PostgreSQL 17.
* **Database Migrations:** Alembic (for evolutionary, programmatic schema state changes).
* **Code Verification:** Pytest (for asynchronous unit and integration testing), Ruff (for linting and formatting compliance).

---

## 3. Architecture

### 3.1 Database Strategy & Multi-Profile Hierarchy

* **Engine Connection:** PostgreSQL 17 using `asyncpg` as the async database dialect driver.
* **Data Layer Isolation:** One `ParentAccount` can host multiple `ChildProfile` records.
* **Scalability Design:** This 1-to-N layout is explicitly isolated at the schema boundary to support structured multi-profile tiers or parent packages in future iterations without data refactoring.

### 3.2 Authentication, Cryptography & Session Strategy

* **Password and PIN Sealing:** Passwords and operational PIN strings must never exist as plaintext within the database. They must be salted and hashed asynchronously using a cryptographic library configuration (e.g., `passlib` with `bcrypt` or `argon2-cffi`).
* **Session Management:** Stateless, cryptographically signed JSON Web Tokens (JWT) using a strong, environment-injected SHA-256 secret key.
* **Token Distribution Engine:** Access tokens must be transmitted to the frontend via an HTTP-only, Secure cookie context. This systematically eliminates Cross-Site Scripting (XSS) extraction vectors.
* **Cross-Dashboard Security:** While children access their dashboard directly without credentials, elevating the context back to the parent dashboard requires state verification against the parent account's hashed secret PIN.

---

## 4. Feature Breakdown & Database Schemas (Epic 1)

### 4.1 Database Schemas (SQLModel models)

```python
from datetime import datetime
from uuid import UUID, uuid4
from pydantic import EmailStr
from sqlmodel import Field, SQLModel, Relationship


class ParentAccount(SQLModel, table=True):
    __tablename__: str = "parent_accounts"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    email: EmailStr = Field(unique=True, index=True, nullable=False)
    hashed_password: str = Field(nullable=False)
    parent_pin_hashed: str | None = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    children: list["ChildProfile"] = Relationship(back_populates="parent")


class ChildProfile(SQLModel, table=True):
    __tablename__: str = "child_profiles"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    parent_id: UUID = Field(foreign_key="parent_accounts.id", index=True, nullable=False)
    name: str = Field(nullable=False)
    avatar_placeholder: str = Field(nullable=False)
    balance: float = Field(default=0.0, nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    parent: ParentAccount = Relationship(back_populates="children")

```

---

### 4.2 API Endpoints Contract

#### 4.2.1 Parent Registration

* **Endpoint:** `POST /api/v1/auth/register`
* **Content-Type:** `application/json`

**Request Body:**

```json
{
  "email": "parent@example.com",
  "password": "SuperSecurePassword123!"
}

```

**Responses:**

* **`201 Created`** (Sets cookie: `access_token=JWT_STRING; HttpOnly; Secure; SameSite=Lax; Path=/`)

```json
{
  "status": "success",
  "message": "Account created successfully.",
  "user": {
    "id": "e3b0c442-98fc-1c14-9c83-0242ac120002",
    "email": "parent@example.com"
  }
}

```

* **`422 Unprocessable Entity`** (Validation failure on email structure or password strength rules).
* **`409 Conflict`** (Email identifier already active inside the system).

#### 4.2.2 Parent Login

* **Endpoint:** `POST /api/v1/auth/login`
* **Content-Type:** `application/json`

**Request Body:**

```json
{
  "email": "parent@example.com",
  "password": "SuperSecurePassword123!"
}

```

**Responses:**

* **`200 OK`** (Sets HTTP-only authentication cookie matching the structure above).

```json
{
  "status": "success",
  "message": "Authentication successful."
}

```

* **`401 Unauthorized`** (Invalid login credentials provided).

#### 4.2.3 Setup Parental PIN

* **Endpoint:** `POST /api/v1/auth/pin`
* **Security:** Required Active Parent Bearer/Cookie Session.
* **Content-Type:** `application/json`

**Request Body:**

```json
{
  "pin": "1234"
}

```

**Responses:**

* **`200 OK`**

```json
{
  "status": "success",
  "message": "Parental security PIN established."
}

```

* **`400 Bad Request`** (PIN fails format constraints such as length or character validation).

#### 4.2.4 Verify Parental PIN (Dashboard Cross-Switching)

* **Endpoint:** `POST /api/v1/auth/pin/verify`
* **Content-Type:** `application/json`

**Request Body:**

```json
{
  "pin": "1234"
}

```

**Responses:**

* **`200 OK`**

```json
{
  "status": "success",
  "authenticated": true
}

```

* **`401 Unauthorized`** (Invalid PIN payload sequence).

#### 4.2.5 Child Profile Creation

* **Endpoint:** `POST /api/v1/profiles/children`
* **Security:** Required Active Parent Session.
* **Content-Type:** `application/json`

**Request Body:**

```json
{
  "name": "Leo",
  "avatar_placeholder": "avatar_blue_monster"
}

```

**Responses:**

* **`201 Created`**

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "parent_id": "e3b0c442-98fc-1c14-9c83-0242ac120002",
  "name": "Leo",
  "avatar_placeholder": "avatar_blue_monster",
  "balance": 0.0
}

```

#### 4.2.6 Get Family Profiles

* **Endpoint:** `GET /api/v1/profiles/family`
* **Security:** Required Active Parent Session.

**Responses:**

* **`200 OK`**

```json
{
  "parent_id": "e3b0c442-98fc-1c14-9c83-0242ac120002",
  "children": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "name": "Leo",
      "avatar_placeholder": "avatar_blue_monster",
      "balance": 0.0
    }
  ]
}

```

---

### 4.3 Business Rules & Boundary Limits

#### Password Complexity Constraints

* Must span at least 8 individual characters.
* Must feature at least one uppercase alphabetic character `[A-Z]`.
* Must feature at least one lowercase alphabetic character `[a-z]`.
* Must feature at least one numerical digit `[0-9]`.

#### Parental PIN Rules

* Must measure exactly 4 characters in length.
* Must strictly consist of numerical sequences matching `^[0-9]{4}$`.

#### Child Profile Scope Constraints

* Minimum: 1 child profile creation encouraged for core application interactions.
* Maximum: Enforced maximum of 10 children profiles per parent entity to bound resource abuse on the sharing layer.

---

## 5. Development Workflow (Chunked Blueprint)

### **Chunk 0: Infrastructure Initialization & Database Configuration**

* Establish FastAPI boilerplate configuration using safe CORS definitions.
* Configure database driver layer via `SQLModel` engines using async execution wrappers.
* Initialize Alembic configuration folders mapping environment setups to target PostgreSQL databases.

### **Chunk 1: Authentication Engine & Cryptographic Foundation**

* Build modular token encoding components using PyJWT.
* Write operational password security hashing utility components with non-blocking properties.
* Write runtime Pydantic schema validation wrappers checking entry rules for emails, passwords, and security PIN strings.

### **Chunk 2: Registration & Core Sign-in Endpoints**

* Code the `/api/v1/auth/register` controller layer evaluating email constraints and schema integrity.
* Implement custom exception handlers mapping model data layer execution failures directly into `409 Conflict` structures.
* Construct the `/api/v1/auth/login` pipeline checking credentials and setting cookie values.

### **Chunk 3: Profiles Management & Switch Gateways**

* Write CRUD pathways processing child creation operations checking target threshold boundaries (Max 10 profiles check).
* Code security configuration endpoints accepting parental protection PIN strings.
* Build verification components protecting the parent dashboard context from unauthorized child access switches.

### **Chunk 4: Integration Testing & Verification Pipeline**

* Author automated API scenario sweeps inside `pytest` simulating user signups, structural failures, boundary overflows, and token access restrictions.
* Run internal Ruff passes ensuring strict architectural styling conformity.