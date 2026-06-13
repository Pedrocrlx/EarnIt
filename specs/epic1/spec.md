# Backend Functional Specification: Epic 1 - Authentication & Profiles (`spec.md`)

## 1. Overview

EarnIt is an allowance management and gamification web application designed as an educational tool primarily for children aged 7 to 10 and their parents. This specification covers the complete backend architectural design, database schemas, API endpoints, and security infrastructure required for **Epic 1: Authentication & Profiles**.

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
* **Email Dispatch:** `fastapi-mail` (async SMTP wrapper) for transactional emails such as verification code delivery.

---

## 3. Architecture

### 3.1 Database Strategy & Multi-Profile Hierarchy

* **Engine Connection:** PostgreSQL 17 using `asyncpg` as the async database dialect driver.
* **Data Layer Isolation:** One `User` (parent) record can host multiple `Child` records, linked through the `children.user_id` foreign key — mirroring a Netflix-style account where the parent profile gates access to the control panel via PIN while children get their own lightweight profiles.
* **Stateless Verification Codes:** Email verification codes are **not** persisted (no `email_verifications` table, no extra columns). A code is an HMAC over `user_id + purpose + anchor`, where the anchor is the user's `updated_at` timestamp — so the code is fully derived from data already on the `users` row and can be recomputed and checked at verify-time. Expiry, resend-cooldown, and purpose-isolation are all handled by the service layer (`app/services/verification/` — a global `core` engine plus one orchestration module per purpose, e.g. `account`); see §4.4 (Email Verification Rules).

### 3.2 Authentication, Cryptography & Session Strategy

* **Secrets Sealing:** Passwords and PINs must never exist as plaintext in the database — both are salted and hashed asynchronously (e.g., `passlib` with `bcrypt` or `argon2-cffi`). Email verification codes are never stored at all (stateless HMAC, see §4.4 Email Verification Rules) and are never logged or echoed back by the API after issuance.
* **Session Management:** Stateless, cryptographically signed JWTs using a strong, environment-injected secret key.
* **Token Distribution:** All tokens are delivered via HTTP-only, Secure cookies, eliminating XSS extraction vectors. Full sessions use `Path=/`; pending-verification sessions use a narrowly-scoped `Path=/api/v1/auth/verify` cookie so they cannot authenticate any other route.
* **Cross-Dashboard Security:** Elevating from a child's view back to the parent dashboard requires verification against `parent_pin_hash` — children access their own view without credentials.
* **Pending-Verification Sessions:** Registration issues a short-lived `pending_verification_token` cookie instead of a full session. The real `access_token` session is only issued once `users.email_verified_at` is stamped.
* **JWT Payload Structure:** Both token types share the same signing key but carry a `scope` claim that route guards enforce server-side:
  * Full session: `{ "sub": "<user_uuid>", "scope": "full", "exp": <timestamp> }`
  * Pending-verification: `{ "sub": "<user_uuid>", "scope": "verify", "exp": <timestamp> }`
* **Parental PIN Gate:** The PIN gate is a **UX-layer lock**, not a server-side privilege escalation. All parent API actions (`POST /profiles/children`, `POST /auth/pin`, `GET /profiles/family`, etc.) are already protected by the full `access_token` session. `POST /auth/verify-pin` simply validates the hash so the frontend can decide whether to render the parent dashboard — no new server-side token or scope is issued on success.
* **Account Existence & Activity Check:** Every authenticated request must confirm — after JWT decode — that the `users` row exists and `is_active = true`. A missing row (e.g., purged by the limbo sweep) returns `401 Unauthorized`, which signals the client to discard the session cookie. An inactive row (`is_active = false`) returns `403 account_disabled`. This check is applied as middleware to all routes that require a session.

---

## 4. Feature Breakdown & Database Schemas (Epic 1)

### 4.1 Database Schemas (SQLModel models)

```python
from datetime import date, datetime, timezone
from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel, Relationship


class User(SQLModel, table=True):
    __tablename__: str = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    email: str = Field(max_length=320, unique=True, index=True, nullable=False)
    password_hash: str = Field(max_length=255, nullable=False)
    parent_pin_hash: str | None = Field(default=None, max_length=255, nullable=True)
    pin_set_at: datetime | None = Field(default=None, nullable=True)
    family_name: str | None = Field(default=None, max_length=150, nullable=True)
    is_active: bool = Field(default=True, nullable=False)
    onboarding_completed: bool = Field(default=False, nullable=False)
    # null while account is in "limbo"; stamped on successful code redemption — login is refused until set
    email_verified_at: datetime | None = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

    children: list["Child"] = Relationship(back_populates="user")


class Child(SQLModel, table=True):
    __tablename__: str = "children"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)
    name: str = Field(max_length=100, nullable=False)
    birth_date: date | None = Field(default=None, nullable=True)
    avatar_url: str | None = Field(default=None, nullable=True)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

    user: User = Relationship(back_populates="children")

```

> **No `EmailVerification` table.** Verification codes are stateless and computed on demand by the service layer (see §4.4 (Email Verification Rules)). The only persistent state involved is the `users.updated_at` anchor and `users.email_verified_at` — both already on the `User` model above.

> **Schema notes:**
>
> * `id` and `user_id` columns are implemented as `UUID` primary/foreign keys (generated client-side via `uuid4`) rather than the `bigserial` integers shown in the diagram — this keeps identifiers non-sequential and non-enumerable across the public API surface, matching the platform's existing convention. Request/response payloads below carry UUID strings.
> * `parent_pin_hash` and `pin_set_at` together back the parental gate: both are `NULL` until the parent configures their PIN during onboarding. `pin_set_at` records when the PIN was last set and updates on any subsequent change.
> * `is_active` on both `users` and `children` enables soft-deactivation without destructive deletes.
> * `onboarding_completed` is flipped to `true` automatically by the server — not by a client call — once `parent_pin_hash IS NOT NULL` **and** at least one `children` row exists for the user (see §4.4 Onboarding Completion Rule).
> * `family_name` identifies the family unit for display purposes (e.g. *Família Silva*); only the last name is collected for MVP — first-name personalisation is deferred post-MVP.
> * `children` intentionally has no `balance` column — balance is derived from a transaction ledger outside this epic's scope.
> * `email_verified_at` implements the "limbo" flow: `NULL` means unverified (limbo), a timestamp means verified. The verification code itself is stateless — derived from `updated_at` rather than stored (see §4.4 (Email Verification Rules)).

---

### 4.2 API Endpoints Contract

#### 4.2.1 Parent Registration

* **Endpoint:** `POST /api/v1/auth/register`
* **Content-Type:** `application/json`

**Request Body:**

```json
{
  "email": "parent@example.com",
  "password": "SuperSecurePassword123!",
  "family_name": "Silva"
}

```

> `family_name` is optional at registration (nullable on `users.family_name`). Profile editing is out of MVP scope — what is set here is what persists.

**Responses:**

* **`201 Created`** (Sets cookie: `pending_verification_token=JWT_STRING; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/verify` — a narrowly-scoped, short-lived token; **not** a full session)

```json
{
  "status": "pending_verification",
  "message": "Account created. Check your email for a verification code.",
  "user": {
    "id": "e3b0c442-98fc-1c14-9c83-0242ac120002",
    "email": "parent@example.com",
    "family_name": "Silva",
    "email_verified_at": null,
    "onboarding_completed": false
  },
  "verification": {
    "expires_at": "2026-06-08T12:44:56Z"
  }
}

```

* **`422 Unprocessable Entity`** (Validation failure on email structure or password strength rules).
* **`409 Conflict`** (Email is already registered — this includes accounts still in the unverified limbo state. The address is not freed until the scheduled sweep purges the expired record after `ACCOUNT_LIMBO_PURGE_HOURS`).

#### 4.2.2 Verify Account (Email Verification)

* **Endpoint:** `POST /api/v1/auth/verify`
* **Security:** Required Pending-Verification Session (`pending_verification_token` cookie issued at registration).
* **Content-Type:** `application/json`

**Request Body:**

```json
{
  "code": "K7H29XQF"
}

```

**Responses:**

* **`200 OK`** (Consumes the code, stamps `email_verified_at`, and replaces the `pending_verification_token` cookie with a full `access_token=JWT_STRING; HttpOnly; Secure; SameSite=Lax; Path=/` session)

```json
{
  "status": "success",
  "message": "Account verified successfully.",
  "user": {
    "id": "e3b0c442-98fc-1c14-9c83-0242ac120002",
    "email": "parent@example.com",
    "family_name": "Silva",
    "email_verified_at": "2026-06-08T12:34:56Z",
    "onboarding_completed": false
  }
}

```

* **`400 Bad Request`** (Submitted code does not match the active hashed record).
* **`410 Gone`** (Code has expired — client should call the resend endpoint instead).
* **`409 Conflict`** (Account is already verified).

#### 4.2.3 Resend Verification Code

* **Endpoint:** `POST /api/v1/auth/verify/resend`
* **Security:** Required Pending-Verification Session.

**Responses:**

* **`200 OK`** (Issued only once the previous code's `expires_at` has elapsed; inserts a new row with a fresh expiry window — the prior row is left expired and swept by the purge job)

```json
{
  "status": "success",
  "message": "A new verification code has been sent.",
  "expires_at": "2026-06-08T12:44:56Z"
}

```

* **`429 Too Many Requests`** (Current code is still within its validity window)

```json
{
  "status": "error",
  "message": "A verification code is still active. Please wait before requesting another.",
  "retry_after_seconds": 312
}

```

#### 4.2.4 Parent Login

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

* **`200 OK`** (Sets cookie: `access_token=JWT_STRING; HttpOnly; Secure; SameSite=Lax; Path=/`)

```json
{
  "status": "success",
  "message": "Authentication successful."
}

```

* **`401 Unauthorized`** (Invalid login credentials provided).
* **`403 Forbidden`** (Credentials valid but `is_active = false` — account has been disabled)

```json
{
  "error": "account_disabled",
  "message": "This account has been disabled."
}

```

* **`403 Forbidden`** (Credentials valid but `email_verified_at` is still `NULL` — re-issues a fresh `pending_verification_token` cookie and routes the client back into the verification flow instead of granting a full session)

```json
{
  "error": "account_unverified",
  "message": "Please verify your account before continuing.",
  "verification": {
    "expires_at": "2026-06-08T12:44:56Z"
  }
}

```

> **Check ordering:** within the login handler, `is_active` is evaluated before `email_verified_at`. An account that is both disabled and unverified returns `403 account_disabled` — the unverified path is never reached.
>
> Exiting the verification flow does not alter account state. Every subsequent login re-evaluates `email_verified_at` and is redirected back to `/auth/verify` until a valid code is redeemed.

#### 4.2.5 Logout

* **Endpoint:** `POST /api/v1/auth/logout`
* **Security:** Required Active Parent Session.

**Responses:**

* **`200 OK`** (Clears the `access_token` cookie by setting it with `Max-Age=0`; the client is effectively unauthenticated)

```json
{
  "status": "success",
  "message": "Logged out successfully."
}

```

* **`401 Unauthorized`** (No valid session present).

#### 4.2.6 Setup Parental PIN

* **Endpoint:** `POST /api/v1/auth/pin`
* **Security:** Required Active Parent Session.
* **Content-Type:** `application/json`

> This endpoint is create-or-update (upsert): if a PIN is already configured it is replaced. This covers both the initial onboarding setup and any subsequent PIN change.

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

#### 4.2.7 Verify Parental PIN (Dashboard Cross-Switching)

* **Endpoint:** `POST /api/v1/auth/verify-pin`
* **Security:** Required Active Parent Session.
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

* **`401 Unauthorized`** (Submitted PIN does not match the stored hash).
* **`428 Precondition Required`** (No PIN has been configured yet — `parent_pin_hash IS NULL`).

> See §3.2 — the PIN gate is a UX-layer lock. A `200` here signals the frontend to render the parent dashboard; no new server-side token or scope is issued.

#### 4.2.8 Child Profile Creation

* **Endpoint:** `POST /api/v1/profiles/children`
* **Security:** Required Active Parent Session.
* **Content-Type:** `application/json`

**Request Body:**

```json
{
  "name": "Leo",
  "birth_date": "2017-04-12",
  "avatar_url": "https://cdn.earnit.app/avatars/blue_monster.png"
}

```

> `birth_date` and `avatar_url` are optional (nullable on `children`); the placeholder-avatar concept is replaced by a stored asset URL.

**Responses:**

* **`201 Created`**

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "user_id": "e3b0c442-98fc-1c14-9c83-0242ac120002",
  "name": "Leo",
  "birth_date": "2017-04-12",
  "avatar_url": "https://cdn.earnit.app/avatars/blue_monster.png",
  "is_active": true
}

```

* **`409 Conflict`** (Parent already has `MAX_CHILDREN_PER_USER` child rows — active or inactive)

```json
{
  "error": "children_cap_reached",
  "message": "Maximum number of child profiles reached."
}

```

#### 4.2.9 Deactivate Child Profile

* **Endpoint:** `PATCH /api/v1/profiles/children/{child_id}`
* **Security:** Required Active Parent Session.

> Soft-deactivation only — the `children` row is retained and continues to count toward `MAX_CHILDREN_PER_USER`. Re-activation is out of MVP scope.

**Responses:**

* **`200 OK`**

```json
{
  "status": "success",
  "message": "Child profile deactivated.",
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "is_active": false
}

```

* **`404 Not Found`** (Child does not exist or does not belong to the authenticated user).
* **`409 Conflict`** (Child profile is already inactive).

#### 4.2.10 Get Family Profiles

* **Endpoint:** `GET /api/v1/profiles/family`
* **Security:** Required Active Parent Session.

**Responses:**

* **`200 OK`**

```json
{
  "id": "e3b0c442-98fc-1c14-9c83-0242ac120002",
  "family_name": "Silva",
  "onboarding_completed": true,
  "children": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "name": "Leo",
      "birth_date": "2017-04-12",
      "avatar_url": "https://cdn.earnit.app/avatars/blue_monster.png",
      "is_active": true
    }
  ]
}

```

---

### 4.3 Configuration & Defaults

All tuneable values live in a central `config.py` module and may be overridden via environment variables. §4.4 references these names instead of raw literals so that a single-line change propagates everywhere.

```python
# config.py

# --- Password ---
PASSWORD_MIN_LENGTH: int = 12                 # minimum character count for account passwords
PASSWORD_SPECIAL_CHARS: str = "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?"  # accepted special characters

# --- Email Verification ---
VERIFICATION_CODE_CHARSET: str = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # alphanumeric, ambiguous chars excluded (0/O, 1/I/L)
VERIFICATION_CODE_LENGTH: int = 8             # character count of the generated code
VERIFICATION_CODE_EXPIRY_MINUTES: int = 10    # global code lifetime — account verification, password reset, PIN reset
ACCOUNT_LIMBO_PURGE_HOURS: int = 24           # hours from users.created_at after which unverified accounts are purged

# --- Session Lifetimes ---
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30         # full authenticated session (30 days)
PENDING_VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # scoped token lifetime — matches the limbo window

# --- Profiles ---
MAX_CHILDREN_PER_USER: int = 10               # hard cap on child profiles per parent account

# --- Parental PIN ---
PARENT_PIN_LENGTH: int = 4                    # digit count; validation pattern: ^[0-9]{PARENT_PIN_LENGTH}$
```

---

### 4.4 Business Rules & Boundary Limits

#### Password Complexity Constraints

* Must span at least `PASSWORD_MIN_LENGTH` (default: `12`) characters.
* Must feature at least one uppercase alphabetic character `[A-Z]`.
* Must feature at least one lowercase alphabetic character `[a-z]`.
* Must feature at least one numerical digit `[0-9]`.
* Must feature at least one special character from `PASSWORD_SPECIAL_CHARS`.

#### Parental PIN Rules

* Must measure exactly `PARENT_PIN_LENGTH` (default: `4`) characters in length.
* Must strictly consist of numerical sequences matching `^[0-9]{PARENT_PIN_LENGTH}$`.

#### Child Profile Scope Constraints

* Minimum: 1 child profile creation encouraged for core application interactions.
* Maximum: Enforced maximum of `MAX_CHILDREN_PER_USER` (default: `10`) children profiles per parent account, counted against **all** rows regardless of `is_active` status — deactivating a child does not free a slot.

#### Onboarding Completion Rule

`onboarding_completed` is set to `true` automatically by the server — never via a dedicated client endpoint. The trigger fires after `POST /auth/pin` and `POST /profiles/children` complete successfully, and evaluates:

> `parent_pin_hash IS NOT NULL` **AND** `COUNT(children WHERE user_id = current_user) >= 1`

Once both conditions are satisfied the flag is flipped and never reverts. Onboarding is a one-time flow; subsequent profile or PIN changes do not affect it. Note that `onboarding_completed = true` records that onboarding *occurred* — it is not a live assertion that active children currently exist.

#### Email Verification Rules

* **Code composition:** Derived deterministically as `HMAC(SECRET_KEY, user_id:purpose:anchor)`, folded onto `VERIFICATION_CODE_CHARSET` — an alphanumeric set with visually ambiguous characters removed (no `0`/`O`, `1`/`I`/`L`). The anchor is `users.updated_at`.
* **Code length:** Fixed at `VERIFICATION_CODE_LENGTH` (default: `8`) characters, balancing brute-force resistance against manual entry ergonomics.
* **Storage:** None. The code is never persisted — it is recomputed from the user row and compared (constant-time) at verify-time. Plaintext exists solely in the outbound email; never logged or returned by the API. Because it is HMAC-keyed by `SECRET_KEY`, it cannot be forged without the server secret.
* **Entry window:** A code is valid for `VERIFICATION_CODE_EXPIRY_MINUTES` (default: `10`) minutes from its anchor; once `NOW() - updated_at` exceeds the window the code is rejected with `410 Gone`.
* **Purpose isolation:** the `purpose` discriminator (`'account_verification'` | `'password_reset'` | `'pin_reset'`) is baked into the HMAC, so a code minted for one flow never validates against another — no cross-flow submission.
* **Resend cooldown:** `POST /auth/verify/resend` is rejected with `429 Too Many Requests` while the current window is still open. Resending rotates the anchor (`updated_at = NOW()`), which yields a fresh code and a fresh window — at most one live code exists per account at any time.
* **Implicit consumption:** there is no `consumed_at` flag. Redemption moves the anchor — account verification stamps `email_verified_at` and bumps `updated_at`; a reset bumps `updated_at` — so the just-used code stops matching and cannot be replayed.
* **Limbo purge window:** Accounts where `email_verified_at IS NULL` for more than `ACCOUNT_LIMBO_PURGE_HOURS` (default: `24`) hours past `users.created_at` are purged by a scheduled sweep, freeing the email address for re-registration.
* **Login gate:** Valid credentials against an unverified account never establish a full session — every login attempt re-checks `email_verified_at` and re-enters the verification flow regardless of how many times the user previously exited it.

---

## 5. Development Workflow (Chunked Blueprint)

### **Chunk 0: Infrastructure Initialization & Database Configuration**

* Establish FastAPI boilerplate configuration using safe CORS definitions.
* Configure database driver layer via `SQLModel` engines using async execution wrappers.
* Initialize Alembic configuration folders mapping environment setups to target PostgreSQL databases; generate and review the initial migration for `users` and `children` — confirm the diff matches the SQLModel definitions before applying.
* Configure `fastapi-mail` connection (SMTP credentials via environment variables, connection pool, and base email template for the verification code email).
* Wire up a scheduled background task runner (e.g., APScheduler or Celery beat) and implement the limbo purge job — a recurring sweep that hard-deletes `users` rows where `email_verified_at IS NULL` and `created_at < NOW() - ACCOUNT_LIMBO_PURGE_HOURS`. (Verification codes are stateless, so there is nothing else to sweep.)
* **Tests:** purge sweep deletes accounts past `ACCOUNT_LIMBO_PURGE_HOURS`; accounts within the window are untouched; verified accounts are never purged regardless of age.

### **Chunk 1: Cryptographic & Auth Utilities**

* Build modular token encoding components using PyJWT.
* Write operational password security hashing utility components with non-blocking properties.
* Write runtime Pydantic schema validation wrappers checking entry rules for emails, passwords, and security PIN strings.
* Implement the stateless verification-code service (`app/services/verification/`): a global `core` engine — deterministic HMAC generation drawing from `VERIFICATION_CODE_CHARSET`, plus constant-time comparison, expiry, and resend-cooldown helpers — with per-purpose orchestration modules (`account`, later `password_reset` / `pin_reset`) owning each flow's email template and pre/post rules. No persistence, no hashing of stored codes.
* Write account existence and activity guard middleware — applied to all authenticated routes — that returns `401` when the `users` row is missing (purged account) and `403 account_disabled` when `is_active = false`.

### **Chunk 2: Registration & Email Verification**

* Code the `POST /api/v1/auth/register` controller — evaluate email constraints and schema integrity, create the account in an unverified ("limbo") state, derive and dispatch a verification code via `fastapi-mail`, and issue a narrowly-scoped `pending_verification_token` cookie.
* Implement custom exception handlers mapping database uniqueness failures to `409 Conflict` responses.
* Build `POST /api/v1/auth/verify` — recompute the `'account_verification'` code from the user's anchor, compare it constant-time, stamp `email_verified_at` on success (which also rotates the anchor), and replace the `pending_verification_token` cookie with a full `access_token` session.
* Build `POST /api/v1/auth/verify/resend` — reject with `429` while the current window is open; otherwise rotate the anchor and dispatch a fresh code.
* **Tests:** duplicate email (active) → `409`; duplicate email (limbo) → `409`; valid registration → `201` + `pending_verification_token`; correct code → `200` + `access_token`; wrong code → `400`; expired code → `410`; already-verified account → `409`; resend before window elapses → `429` with `retry_after_seconds`; resend after expiry → `200` with fresh `expires_at`.

### **Chunk 3: Login & Logout**

* Construct `POST /api/v1/auth/login` — verify credentials, check `is_active` before `email_verified_at`, route disabled accounts to `403 account_disabled`, route unverified accounts to `403 account_unverified` with a fresh `pending_verification_token` cookie, and issue a full `access_token` session on success.
* Implement `POST /api/v1/auth/logout` — clear the `access_token` cookie by responding with `Max-Age=0`.
* **Tests:** wrong password → `401`; valid credentials, `is_active = false` → `403 account_disabled`; valid credentials, `email_verified_at IS NULL` → `403 account_unverified` + fresh `pending_verification_token`; valid verified credentials → `200` + `access_token`; valid session logout → `200`, cookie cleared; no session logout → `401`; authenticated request with purged `users` row → `401`; authenticated request with `is_active = false` → `403 account_disabled`.

### **Chunk 4: Parental PIN**

* Implement `POST /api/v1/auth/pin` — upsert `parent_pin_hash`, stamp `pin_set_at`, and evaluate the onboarding completion trigger (`parent_pin_hash IS NOT NULL AND children count >= 1`); flip `users.onboarding_completed` if both conditions are met.
* Implement `POST /api/v1/auth/verify-pin` — compare the submitted PIN against `parent_pin_hash` and return the scoped confirmation response used by the frontend to unlock the parent dashboard.
* **Tests:** setup with no prior PIN → `200`; update existing PIN → `200`; invalid PIN format → `400`; verify correct PIN → `200`; verify wrong PIN → `401`; verify before PIN is set → `428`.

### **Chunk 5: Child Profiles & Family View**

* Implement `POST /api/v1/profiles/children` — validate the `MAX_CHILDREN_PER_USER` cap (all rows, regardless of `is_active`), create the `Child` record, and evaluate the onboarding completion trigger; flip `users.onboarding_completed` if both conditions are met.
* Implement `PATCH /api/v1/profiles/children/{child_id}` — validate ownership, confirm the child is not already inactive, and set `is_active = false`.
* Implement `GET /api/v1/profiles/family` — return the authenticated user's profile alongside all associated `children` rows.
* **Tests:** child creation up to `MAX_CHILDREN_PER_USER` → `201`; exceeding cap → `409 children_cap_reached`; `onboarding_completed` flips to `true` only after both PIN and first child exist; `GET /profiles/family` returns correct parent fields and children list; deactivate active child → `200 is_active: false`; deactivate already-inactive child → `409`; deactivate child belonging to another user → `404`; deactivated child still counts toward cap.

### **Chunk 6: Linting Pass**

* Run Ruff across all modules, enforcing strict linting and formatting conformity.

### **Chunk 7: Forgot Password**

* Implement `POST /api/v1/auth/forgot-password` — look up the account by email; if it exists and `is_active`, rotate the anchor (`updated_at = NOW()`) and dispatch a `'password_reset'` code via `fastapi-mail`. Regardless of whether the email matches an account, return the identical `200` response — never reveal account existence.
* Implement `POST /api/v1/auth/forgot-password/verify` — recompute the `'password_reset'` code from the user's anchor and compare it constant-time. Collapse every failure mode (unknown email, expired window, wrong code) into the same `400 {"detail": "Invalid or expired code."}` — distinct outcomes here would leak account existence. On success, issue a narrowly-scoped `password_reset_token` cookie (path-restricted to `/api/v1/auth/reset-password`, lifetime `VERIFICATION_CODE_EXPIRY_MINUTES`).
* Implement `POST /api/v1/auth/reset-password` — requires the `password_reset_token` cookie (scope `password_reset`); set `password_hash` to the new (policy-validated) password, bump `updated_at` (closing the reset code's window), clear the cookie.
* **Tests:** `forgot-password` for a known verified account → `200` + one `password_reset` email; unknown email → `200`, no email, identical response body; disabled account → `200`, no email, identical response body; `forgot-password/verify` with correct code → `200` + `password_reset_token` cookie; wrong code, expired code, and unknown email → `400` with identical body; `reset-password` with valid cookie + strong password → `200`, old password rejected by `/login`, new password accepted; without cookie → `401`; weak new password → `422`.