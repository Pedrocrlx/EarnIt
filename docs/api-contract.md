# EarnIt API Contract — Frontend Reference

> **Status:** Epic 1 endpoints (Auth & Profiles) — in progress.
> Update this document as each chunk ships.

---

## Base URL

| Environment | URL |
|---|---|
| Local (backend only) | `http://localhost:8000` |
| Local (full stack via Nginx) | `http://localhost:80` |

All Epic 1 routes are prefixed with `/api/v1`.

---

## Critical: How Authentication Works

**The backend uses HTTP-only cookies, not `Authorization` headers or `localStorage`.**

This means:

- The browser receives and stores tokens automatically — the frontend never reads or writes them.
- Every request to an authenticated route **must** include `credentials: 'include'` (fetch) or `withCredentials: true` (axios).
- If you forget `credentials: 'include'`, the cookie is not sent and the server returns `401` — even for a logged-in user.

```ts
// Every API call must look like this:
fetch('/api/v1/profiles/family', { credentials: 'include' })
```

### Two Cookie States

After registration the browser is in a narrow "pending verification" state, not a full session. The frontend should track which state it is in by reading the API response — never by inspecting the cookie (it's HttpOnly, so JavaScript cannot read it anyway).

| State | Cookie present | What it means |
|---|---|---|
| Not authenticated | none | Redirect to `/login` |
| Pending verification | `pending_verification_token` | Redirect to `/verify` |
| Fully authenticated | `access_token` | Normal app flow |

The `pending_verification_token` is scoped to `Path=/api/v1/auth/verify`, so the browser will only send it to that path. It cannot authenticate any other route.

### The Parental PIN Gate

`POST /auth/verify-pin` does **not** issue a new cookie. A `200` response is purely a signal to the frontend to render the parent dashboard. All parent routes are already protected by the full `access_token` session.

---

## Standard Error Shape

FastAPI returns errors in this envelope:

```json
{ "detail": "human-readable message" }
```

Some domain errors use a richer shape (documented per-endpoint below):

```json
{ "error": "machine_readable_code", "message": "human-readable message" }
```

Validation failures (`422`) return a list of field errors:

```json
{
  "detail": [
    { "loc": ["body", "password"], "msg": "Password must contain: one digit", "type": "value_error" }
  ]
}
```

---

## Endpoints

### `POST /api/v1/auth/register`

Create a new parent account. Issues a `pending_verification_token` cookie — not a full session.

**Request**
```json
{
  "email": "parent@example.com",
  "password": "SuperSecure1",
  "family_name": "Silva"
}
```
> `family_name` is optional.

**Password rules** (validated server-side, returns `422` if broken):
- At least 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit

**`201 Created`** — sets `pending_verification_token` cookie
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

| Status | Meaning |
|---|---|
| `422` | Email format invalid or password rules not met |
| `409` | Email already registered (even if still unverified) |

---

### `POST /api/v1/auth/verify`

Redeem the 8-character code from the verification email. Replaces the `pending_verification_token` cookie with a full `access_token`.

> **Auth required:** `pending_verification_token` cookie

**Request**
```json
{ "code": "K7H29XQF" }
```

**`200 OK`** — clears `pending_verification_token`, sets `access_token` cookie
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

| Status | Meaning |
|---|---|
| `400` | Code is wrong |
| `409` | Account already verified |
| `410` | Code has expired — call `/auth/verify/resend` instead |

---

### `POST /api/v1/auth/verify/resend`

Request a new verification code. Only allowed once the previous code's expiry window has passed.

> **Auth required:** `pending_verification_token` cookie

**`200 OK`**
```json
{
  "status": "success",
  "message": "A new verification code has been sent.",
  "expires_at": "2026-06-08T12:44:56Z"
}
```

**`429 Too Many Requests`** — current code is still valid, show a countdown
```json
{
  "status": "error",
  "message": "A verification code is still active. Please wait before requesting another.",
  "retry_after_seconds": 312
}
```

---

### `POST /api/v1/auth/login`

Authenticate with email and password. On success, issues the full `access_token` cookie.

**Request**
```json
{
  "email": "parent@example.com",
  "password": "SuperSecure1"
}
```

**`200 OK`** — sets `access_token` cookie
```json
{
  "status": "success",
  "message": "Authentication successful."
}
```

| Status | Body | Meaning |
|---|---|---|
| `401` | `{"detail": "..."}` | Wrong email or password |
| `403` | `{"error": "account_disabled", "message": "..."}` | Account deactivated |
| `403` | `{"error": "account_unverified", ..., "verification": {"expires_at": "..."}}` | Sets `pending_verification_token` — redirect to `/verify` |

> **Check order:** a disabled account that is also unverified returns `account_disabled`, never `account_unverified`.

---

### `POST /api/v1/auth/logout`

Clear the session cookie.

> **Auth required:** `access_token` cookie

**`200 OK`** — clears `access_token` cookie (`Max-Age=0`)
```json
{
  "status": "success",
  "message": "Logged out successfully."
}
```

| Status | Meaning |
|---|---|
| `401` | No valid session present |

---

### `POST /api/v1/auth/pin`

Set or update the parental PIN. This is a create-or-update — calling it again replaces the existing PIN.

> **Auth required:** `access_token` cookie

**Request**
```json
{ "pin": "1234" }
```
> PIN must be exactly 4 digits (`0–9`). Returns `400` otherwise.

**`200 OK`**
```json
{
  "status": "success",
  "message": "Parental security PIN established."
}
```

After this call succeeds, if at least one child profile also exists, `onboarding_completed` flips to `true` on the user record — the frontend can detect this on the next `GET /profiles/family` call.

---

### `POST /api/v1/auth/verify-pin`

Validate the PIN to unlock the parent dashboard. **No new cookie is issued.**

> **Auth required:** `access_token` cookie

**Request**
```json
{ "pin": "1234" }
```

**`200 OK`** — treat this as a green light to show the parent dashboard UI
```json
{
  "status": "success",
  "authenticated": true
}
```

| Status | Meaning |
|---|---|
| `401` | Wrong PIN |
| `428` | PIN has not been set yet |

---

### `POST /api/v1/profiles/children`

Add a child profile to the family.

> **Auth required:** `access_token` cookie

**Request**
```json
{
  "name": "Leo",
  "birth_date": "2017-04-12",
  "avatar_url": "https://cdn.earnit.app/avatars/blue_monster.png"
}
```
> `birth_date` and `avatar_url` are optional.

**`201 Created`**
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

**`409 Conflict`** — cap reached
```json
{
  "error": "children_cap_reached",
  "message": "Maximum number of child profiles reached."
}
```
> The cap is 10 children per account, counting active and deactivated profiles.

---

### `PATCH /api/v1/profiles/children/{child_id}`

Soft-deactivate a child profile. The record is kept and still counts toward the cap.

> **Auth required:** `access_token` cookie

**`200 OK`**
```json
{
  "status": "success",
  "message": "Child profile deactivated.",
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "is_active": false
}
```

| Status | Meaning |
|---|---|
| `404` | Child not found or belongs to another user |
| `409` | Child is already inactive |

---

### `GET /api/v1/profiles/family`

Fetch the authenticated user's profile and all their child profiles.

> **Auth required:** `access_token` cookie

**`200 OK`**
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

## Dev-Only Endpoints

These exist to aid local development and are not part of the production API.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/healthz` | Returns `{"status": "ok"}` — use for Docker health checks |
| `POST` | `/test-email` | Sends a test email through Mailpit SMTP. Open `http://localhost:8025` to read it. |

---

## Onboarding Flow

The `onboarding_completed` flag on the user record is managed entirely by the server. The frontend can use it to decide whether to show the onboarding wizard or go straight to the dashboard.

```
onboarding_completed = true  when:  PIN is set  AND  at least one child exists
```

It is set automatically after `POST /auth/pin` or `POST /profiles/children` — whichever is called last. It never reverts.
