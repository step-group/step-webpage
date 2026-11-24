# External Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** People outside the lab get an `external` role that can use only the equipment calendar, enforced on the server.

**Architecture:** A new enum value, a whitelist middleware mounted on `/api` that blocks externals (by their current database role) from everything except `/auth` and `/equipment`, notes hidden from externals in the calendar, and front-end menu and route guards.

**Tech Stack:** Express 4, `pg`, `jsonwebtoken`, Jest + Supertest; React 18, React Router 6 (all already in the repo).

**Spec:** `docs/superpowers/specs/2026-11-24-external-users-design.md`

## Global Constraints

- Role value is exactly `external` (UI label "Externo"). The whitelist is `['/auth', '/equipment']`, matched on whole path segments.
- The block is a 403 `{ error }` in Spanish; no token, an invalid token, or an unknown user passes through (the route returns its own 401).
- The middleware reads the role from the database, not the token.
- Members and admins must behave exactly as before; the existing suites must stay green.
- Externals book under the same rules (48-hour approval included); equipment creation, archiving and the pending list stay admin-only.
- No email, no per-equipment access, no new registration flow.
- Add the next migration as `015_...sql`; never edit an existing migration.

## Review Focus

- Every non-whitelisted prefix is closed for an external, including look-alikes such as `/api/equipmentx` and `/api/authx`, and admin routes.
- A member demoted to `external` with a token issued while they were a member is blocked immediately.
- Unauthenticated requests still get 401 (not 403) and a garbage token does not crash the server.
- An external never sees another user's `notes` in the range query but does see their own.
- Members and admins can still reach `/api/resources`, `/api/experiments` and the rest.

---

### Task 1: Role, middleware and API behavior

**Files:**
- Create: `api/migrations/015_external_role.sql`, `api/tests/external.test.js`
- Modify: `api/src/middleware/auth.js`, `api/src/app.js`, `api/src/routes/admin.js`, `api/src/routes/equipment.js`

**Interfaces:**
- Produces:
  - `restrictExternals(allowedPrefixes: string[]): express middleware` exported from `api/src/middleware/auth.js`.
  - `PATCH /api/admin/users/:id/role` accepts `'external'` in addition to `'admin'` and `'member'`.
  - `GET /api/equipment/:id/reservations` returns `notes: ''` for reservations the viewer does not own when the viewer's token role is `external`.

- [ ] **Step 1: Write the failing tests** in `api/tests/external.test.js` (same setup style as `equipment.test.js`: `truncateAll`, an admin, a member, an external created with `createUser({ role: 'external' })`, `afterAll(() => pool.end())`; insert equipment directly with `pool.query`). Each test is named and asserts exactly this:
  - `external can list equipment, book it and see it on the calendar`: GET `/api/equipment` returns 200, POST a reservation returns 201.
  - `external is refused everywhere outside the calendar`: for each of `/api/resources`, `/api/experiments`, `/api/templates`, `/api/publications`, `/api/datasets/1`, `/api/admin/users`, a GET returns 403.
  - `look-alike prefixes are refused`: GET `/api/equipmentx` and `/api/authx` return 403.
  - `external can still read their own profile`: GET `/api/auth/me` returns 200.
  - `external booking over 48 hours is pending`: status `pending`.
  - `external cannot create or archive equipment or list pending approvals`: POST `/api/equipment` 403, PATCH `/api/equipment/:id` 403, GET `/api/equipment/reservations/pending` 403.
  - `member and admin are unaffected`: GET `/api/resources` returns 200 for both.
  - `unauthenticated requests still get 401, and a garbage token does not crash`: GET `/api/resources` with no header returns 401; with `Authorization: Bearer garbage` returns 401.
  - `a member demoted to external is blocked immediately with the old token`: take the member's token, have the admin PATCH the member's role to `external` (200), then GET `/api/resources` with the old token returns 403.
  - `admin can set the role to external and an invalid role is rejected`: PATCH role `external` returns 200 and `role === 'external'`; role `banana` returns 400.
  - `external sees only their own notes`: a member books with `notes: 'secreto'`; the external's range query shows `notes === ''` for it; the external books with `notes: 'mío'` and sees `notes === 'mío'` on that one; the member sees `'secreto'`.

- [ ] **Step 2: Run `cd api && npx jest --runInBand --forceExit --testTimeout=8000 external` and confirm the suite fails** (the `external` enum value does not exist yet).

- [ ] **Step 3: Write the migration** `015_external_role.sql`: `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'external';`.

- [ ] **Step 4: Implement `restrictExternals(allowedPrefixes)`** in `api/src/middleware/auth.js`: read the Bearer token; on a missing or invalid token, call `next()`; otherwise look up `SELECT role FROM users WHERE id = $1` (require `../db` here) and, if the role is `external` and `req.path` is not exactly a prefix or a prefix followed by `/`, respond 403 `{ error: 'Acceso restringido: tu cuenta solo puede usar el calendario de equipos' }`; any other case calls `next()`; database errors go to `next(err)`. Mount it in `app.js` as `app.use('/api', restrictExternals(['/auth', '/equipment']))` before all routers.

- [ ] **Step 5: Accept `external` in `routes/admin.js`** (validation list and the Spanish error text). In `routes/equipment.js`, in the range-query handler, map the rows so that when `req.user.role === 'external'`, `notes` is `''` for rows whose `user_id !== req.user.id`.

- [ ] **Step 6: Run the new suite and confirm it passes**, then run `cd api && npm test` and confirm every suite passes.

- [ ] **Step 7: Commit**

```bash
git add api docs
git commit -m "feat(api): external role limited to the equipment calendar"
```

---

### Task 2: Front end for externals

**Files:**
- Modify: `app/src/layouts/AppLayout.jsx`, `app/src/App.jsx`, `app/src/pages/AdminUsers.jsx`

**Interfaces:**
- Consumes: the `external` role value returned by login and `GET /api/auth/me` as `user.role`.

- [ ] **Step 1: `AppLayout.jsx`:** when `user.role === 'external'`, the main menu shows only the Equipos entry, and the sidebar user row shows the role label "Externo" instead of "Miembro".

- [ ] **Step 2: `App.jsx`:** the `P` wrapper (used by every page except Equipos and Perfil) redirects an `external` user to `/app/equipment`. The Equipos routes and `/app/profile` use a wrapper that only requires a logged-in user. Login keeps navigating to `/app/dashboard`, which then redirects externals.

- [ ] **Step 3: `AdminUsers.jsx`:** add `<option value="external">Externo</option>` to the role selector and `external: 'externo'` to `ROLE_LABEL`.

- [ ] **Step 4: Verify:** `cd app && npm run build` passes. With the API and app running locally (run `npm run migrate` on the dev database first), check by HTTP through a real external account: login role is `external`, the calendar endpoints work, `/api/resources` returns 403. Then take a headless Edge screenshot of the page as an external user using a temporary helper page (deleted afterwards) and confirm the menu shows only Equipos. Report plainly anything that could not be verified.

- [ ] **Step 5: Commit**

```bash
git add app
git commit -m "feat(app): calendar-only experience for external users"
```
