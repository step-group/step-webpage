# Equipment Reservations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let lab members book shared equipment like an Outlook event (start datetime to end datetime), with one calendar tab per equipment.

**Architecture:** Two new tables (`equipment`, `reservations`) behind a new Express router `/api/equipment`. Overlap safety comes from locking the equipment row in a transaction and checking for overlap before writing. The React app gets an "Equipos" page with tabs and a `react-big-calendar` calendar, following the existing page and CSS Module conventions.

**Tech Stack:** Express 4, `pg`, Jest + Supertest (API); React 18, React Router 6, CSS Modules, `lucide-react`, `react-big-calendar` and `date-fns` (new).

**Spec:** `docs/superpowers/specs/2026-11-24-equipment-reservations-design.md`

## Global Constraints

- A booking is one continuous block from `starts_at` to `ends_at` (not a daily window). Both are `timestamptz`.
- Back-to-back is allowed: overlap means `starts_at < other.ends_at AND ends_at > other.starts_at`.
- Any approved member can book. Only the creator or an admin can edit or cancel a booking. Only admins add, edit or archive equipment.
- An overlap returns HTTP 409 with `{ error }` naming the holder.
- UI text and API error messages are in Spanish, like the rest of the app.
- No recurring bookings, no approval step, no emails. Do not modify inventory, experiments or publications code.
- Add the next migration as `013_...sql`; never edit an existing migration.
- The API mounts at `/api/equipment`. The UI routes are `/app/equipment` and `/app/equipment/:id`.

## Review Focus

- Missing or unparseable `starts_at` / `ends_at` returns 400, not 500.
- `ends_at` equal to or before `starts_at` returns 400 (also enforced by a DB CHECK).
- Editing a booking so it still overlaps only its own old time slot succeeds (it must not conflict with itself).
- Booking archived (inactive) equipment is rejected (404), and archived equipment does not appear in the list.
- The range query returns a multi-day booking that began before `from` but ends inside the range.

---

### Task 1: Database and API

**Files:**
- Create: `api/migrations/013_equipment_reservations.sql`
- Create: `api/src/routes/equipment.js`
- Create: `api/tests/equipment.test.js`
- Modify: `api/src/app.js` (require and mount the router)
- Modify: `api/tests/helpers.js` (add `equipment, reservations` to the `TRUNCATE` list)

**Interfaces:**
- Produces (HTTP, all require a Bearer token):
  - `GET /api/equipment` returns `[{ id, name, description, location }]`, active only, ordered by name.
  - `POST /api/equipment` (admin) body `{ name, description?, location? }` returns 201 and the row. A missing name returns 400.
  - `PATCH /api/equipment/:id` (admin) body any of `{ name, description, location, active }` returns the row.
  - `GET /api/equipment/:id/reservations?from=ISO&to=ISO` returns `[{ id, equipment_id, user_id, user_name, title, notes, starts_at, ends_at }]` for reservations overlapping the range, ordered by `starts_at`.
  - `POST /api/equipment/:id/reservations` body `{ title, notes?, starts_at, ends_at }` returns 201 and the row.
  - `PATCH /api/equipment/reservations/:rid` same body fields, all optional, returns the row.
  - `DELETE /api/equipment/reservations/:rid` returns 204.

- [ ] **Step 1: Check a test database exists.** Run `cd api && npm install` and confirm `api/.env.test` points at a Postgres database. If there is no local Postgres, stop and ask the user how they want to run the tests. Do not point tests at a deployed database.

- [ ] **Step 2: Write the failing tests** in `api/tests/equipment.test.js` (same setup style as `resources.test.js`: `truncateAll`, an admin, two members, `afterAll(() => pool.end())`). Each test is named and asserts exactly this:
  - `member cannot create equipment` returns 403; `admin creates equipment` returns 201; creating without `name` returns 400.
  - `books a multi-day block (2026-11-24T20:00Z to 2026-11-25T23:00Z)` returns 201.
  - `overlap is rejected with 409 naming the holder`: the error contains the first user's name.
  - `back-to-back booking is allowed`: new start equals the previous end, returns 201.
  - `rejects end <= start` returns 400 for both equal and earlier. `rejects missing or invalid dates` returns 400 for `{}` and `starts_at: 'banana'`.
  - `editing a booking within its own slot does not conflict with itself` returns 200. Moving it onto another booking returns 409.
  - `only owner or admin can edit or delete`: another member gets 403 on PATCH and DELETE; the owner and an admin succeed (DELETE returns 204).
  - `archived equipment is hidden and cannot be booked`: after `PATCH {active:false}` the list omits it and POST reservation returns 404.
  - `range query includes a booking that started before from but ends inside the range`, and excludes one entirely outside it.

- [ ] **Step 3: Run `cd api && npm test -- equipment` and confirm the suite fails** (route and tables do not exist yet).

- [ ] **Step 4: Write the migration** `013_equipment_reservations.sql` with `equipment(id SERIAL PK, name VARCHAR(150) NOT NULL, description TEXT NOT NULL DEFAULT '', location VARCHAR(150) NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())` and `reservations(id SERIAL PK, equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(200) NOT NULL, notes TEXT NOT NULL DEFAULT '', starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK (ends_at > starts_at))` plus `CREATE INDEX ON reservations (equipment_id, starts_at)`.

- [ ] **Step 5: Implement `api/src/routes/equipment.js`** following `routes/templates.js` (`requireAuth` / `requireAdmin`, Spanish errors, `try/catch` returning 500). One helper `parseRange(body)` returns `{ starts, ends }` as `Date`s or an error string (400). Create and update run in a transaction that first does `SELECT id FROM equipment WHERE id=$1 AND active FOR UPDATE` (no row returns 404), then runs the overlap query (excluding the booking's own id on update), and returns 409 on a hit. Mount in `app.js` with `app.use('/api/equipment', equipmentRoutes)`.

- [ ] **Step 6: Run `cd api && npm test` and confirm all suites pass** (the new one and the existing ones).

- [ ] **Step 7: Commit**

```bash
git add api docs
git commit -m "feat(api): equipment and reservations with overlap protection"
```

---

### Task 2: Calendar page in the app

**Files:**
- Modify: `app/package.json` (add `react-big-calendar`, `date-fns`)
- Modify: `app/src/api/client.js` (add `equipment` section)
- Modify: `app/src/App.jsx` (two routes), `app/src/layouts/AppLayout.jsx` (NAV entry `{ to: '/app/equipment', label: 'Equipos', Icon: CalendarDays }`)
- Create: `app/src/pages/equipment/EquipmentPage.jsx`, `ReservationModal.jsx`, `Equipment.module.css`

**Interfaces:**
- Consumes: the HTTP contract from Task 1.
- Produces in `api/client.js`: `api.equipment.list()`, `.create(body)`, `.update(id, body)`, `.reservations(id, {from, to})`, `.reserve(id, body)`, `.updateReservation(rid, body)`, `.deleteReservation(rid)` (uses `requestEmpty`), matching the existing style.

- [ ] **Step 1: Install** `cd app && npm install react-big-calendar date-fns` and confirm `npm run build` still passes.

- [ ] **Step 2: Add the `equipment` methods to `client.js`** exactly as listed in Interfaces.

- [ ] **Step 3: `EquipmentPage.jsx`** (default export, wrapped in `AppLayout`, reads `:id` from the route). It renders a tab per equipment from `api.equipment.list()` (clicking a tab navigates to `/app/equipment/:id`; no id goes to the first tab; an empty list shows "No hay equipos reservables" and, for admins, the add-equipment form). The calendar uses `dateFnsLocalizer` with the `es` locale, `defaultView='week'`, `views=['day','week','month']`, `selectable`, and `step=30`. On range change it calls `api.equipment.reservations` for the visible range, and shows `title — user_name` on each event. Dragging a slot opens `ReservationModal` prefilled with that start and end. Clicking an event opens the same modal for editing.

- [ ] **Step 4: `ReservationModal.jsx`** has fields title, notes, start and end (`datetime-local` inputs, converted with `new Date(value).toISOString()` on submit). It has Save, Cancel, and Delete (shown only to the owner or an admin on existing bookings, using `ConfirmModal`). The error from a 409 or 400 is shown inline in the modal. Members who do not own the booking see it read-only.

- [ ] **Step 5: Style** in `Equipment.module.css` using the existing CSS variables (`--color-primary`, `--color-border`, `--radius`) and the button classes' look from `Publications.module.css`. Import `react-big-calendar/lib/css/react-big-calendar.css` in the page and override event color to `--color-primary`.

- [ ] **Step 6: Wire routes and nav** in `App.jsx` and `AppLayout.jsx`, and confirm `npm run build` passes.

- [ ] **Step 7: Verify in the browser.** Run API and app locally (see the READMEs). Check that the example works: book the microwave from 24/11/2026 17:00 to 25/11/2026 20:00, see the block span two days in week and month views, try an overlapping booking and see the 409 message, and edit and cancel as owner. Report anything that could not be verified.

- [ ] **Step 8: Commit**

```bash
git add app
git commit -m "feat(app): equipment calendar page with reservations"
```

---

### Task 3: Seed example equipment and docs

**Files:**
- Modify: `api/src/seed.js` (insert example equipment if none exists)
- Modify: `api/README.md` (add `/api/equipment` to the endpoints table), `app/README.md` (add `/app/equipment` to the routes, the new dependency, and the `pages/equipment/` folder)

**Interfaces:**
- Consumes: the `equipment` table from Task 1.

- [ ] **Step 1: In `seed.js`, add an idempotent block** that inserts "Microondas" (location "Lab STEP") only when the `equipment` table is empty. Match the existing seed style (skip if present).

- [ ] **Step 2: Run `cd api && npm run seed` twice** and confirm that only one row exists afterwards (`SELECT count(*) FROM equipment` gives 1).

- [ ] **Step 3: Update both READMEs** as listed.

- [ ] **Step 4: Commit**

```bash
git add api app
git commit -m "feat: seed example equipment and document reservations"
```
