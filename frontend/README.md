# EarnIt Frontend

EarnIt frontend is the React application for family onboarding, parent authentication, profile selection, and the first parent dashboard experience.

The code should stay simple: route-level pages own their screen behavior, shared components are extracted only when they remove real duplication, and backend contracts should be typed from the API instead of manually recreated.

## Stack

- **Runtime and package manager:** Bun
- **Build tool:** Vite
- **UI framework:** React 19
- **Language:** TypeScript with strict mode enabled
- **Routing:** React Router
- **Server state:** TanStack Query
- **Styling:** Tailwind CSS 4
- **UI primitives:** shadcn-style components in `src/components/ui`
- **Icons:** lucide-react
- **API transport:** native `fetch` through `src/lib/api.ts`

## Commands

Run commands from `projects/EarnIt/frontend`.

```bash
bun install
bun run dev
bun run lint
bun run build
bun run preview
```

The Vite dev server defaults to `http://localhost:5173`.

## Project Architecture

```text
src/
  components/
    ui/                  Shared shadcn-style primitives
    Layout.tsx           App shell
    Logo.tsx             EarnIt logo rendering
    Navbar.tsx           Public navigation
    ProtectedRoute.tsx   Route guard for auth and onboarding state
  context/
    AuthContext.tsx      Auth provider and session refresh behavior
    auth-context.ts      Auth types and context definition
    useAuth.ts           Safe auth hook
  lib/
    api.ts               Backend fetch wrapper and API error type
    utils.ts             Small shared utilities
  pages/
    authentication/      Login, registration, verification screens
    onboarding/          Family setup flow
    DashboardPage.tsx
    LandingPage.tsx
    ProfileSelectorPage.tsx
  App.tsx                Route tree and lazy page loading
  main.tsx               React, QueryClient, and AuthProvider bootstrap
```

## Routing

`src/App.tsx` owns the route tree.

- `/` is public.
- `/login`, `/register`, and `/verification` are public auth routes.
- `/profile` requires an authenticated family session.
- `/onboarding`, `/onboarding/step1`, `/onboarding/step2`, and `/onboarding/step3` require authentication and are blocked after onboarding is complete.
- `/dashboard` requires authentication and completed onboarding.

Route access belongs in `ProtectedRoute`; page components should not duplicate redirect rules.

## Auth And API Boundaries

`AuthProvider` loads the current family profile from `GET /api/v1/profiles/family` and exposes:

- `status`
- `isAuthenticated`
- `familyProfile`
- `login`
- `logout`
- `refreshSession`

Use `apiFetch` for backend calls. It:

- prefixes requests with `/api/v1`
- sends cookies by default
- handles JSON and empty responses
- raises `ApiError` for failed HTTP responses

Do not hand-write long-lived backend entity types in the frontend. The project guideline is contract-first development, so API shapes should come from generated OpenAPI types when the backend schema stabilizes.

## Onboarding Flow

The onboarding flow has three steps:

1. Family name and child count.
2. Child profile creation.
3. Parent PIN creation.

The backend owns `onboarding_completed`. The frontend reads that flag from the family profile and uses it for route guards and post-authentication redirects.

Temporary onboarding progress that does not belong on the backend is kept in `sessionStorage` and cleared when setup finishes.

## Profile Selection

Children can enter directly from `/profile`.

The Mom/Dad profile is protected by the parent PIN created during onboarding. The frontend verifies that PIN with `POST /api/v1/auth/verify-pin` before entering the dashboard.

## State Management

- Use **TanStack Query** for server mutations and request lifecycle state.
- Use React local state for form inputs and small page-only UI state.
- Add Zustand only for persistent client UI state that is shared across unrelated parts of the tree.
- Avoid storing server-owned data in global frontend state unless there is a clear product need.

## Styling

- Prefer Tailwind classes and the existing `src/components/ui` primitives.
- Keep layouts mobile-first and readable at small breakpoints.
- Use icons for common actions when they are clearer than text alone.
- Avoid inline `style` props.
- Keep component extraction practical: two pages sharing the same field or shell is enough; one-off UI can stay local.

## Quality Checklist

Before handing off frontend changes, run:

```bash
bun run lint
bun run build
```

For user-facing changes, manually check:

- unauthenticated redirects
- login and registration errors
- onboarding step navigation
- parent PIN verification
- mobile layout at narrow widths

## Testing Notes

There is no test script configured yet. When tests are added, prefer Jest with React Testing Library for route guards, auth forms, onboarding validation, and profile PIN behavior.

## Docker

The isolated frontend container is defined in `compose.yaml` and `ops/Dockerfile`. The full integrated stack is managed from the repository root through Docker Compose and NGINX.
