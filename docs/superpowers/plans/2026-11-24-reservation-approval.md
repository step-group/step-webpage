# Reservation Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bookings longer than 48 hours by a member are created as pending and need an admin to approve or reject them.

**Architecture:** Add a `status` column to `reservations`. The existing equipment router computes status on create and on time edits, excludes rejected rows from overlaps and the calendar, and gains three admin endpoints (pending list, approve, reject). The existing calendar page shows pending bookings differently and gives admins a pending panel.

**Tech Stack:** Express 4, `pg`, Jest + Supertest; React 18, `react-big-calendar`, CSS Modules (all already in the repo).

**Spec:** `docs/superpowers/specs/2026-11-24-reservation-approval-design.md`

## Global Constraints

- Threshold: duration strictly greater than 48 hours (`MAX_AUTO_HOURS = 48`, a constant in `api/src/routes/equipment.js`) is `pending` for a member; 48 hours or less is `confirmed`.
- An admin's bookings are always `confirmed`; an admin who changes a booking's start or end leaves it `confirmed`.
- Status is recomputed on update only if `starts_at` or `ends_at` actually changed; editing title or notes never changes status.
- Pending and confirmed both count for overlap checks and the range query; rejected never do.
- No email, notification or WhatsApp code of any kind. UI text and API errors are in Spanish.
- Add the next migration as `014_...sql`; never edit an existing migration.
- Do not touch inventory, experiments or publications code, and do not add the usage log.

## Review Focus

- Exactly 48:00 hours is `confirmed`, and 48 hours plus one minute is `pending`.
- A member editing only the title or notes of a pending (or confirmed) booking does not change its status.
- A member shortening then re-lengthening a booking cannot end up `confirmed` above 48 hours: the edit that makes it longer makes it `pending`.
- Approving or rejecting a booking that is not pending returns 409, and an unknown id returns 404.
- Editing (PATCH) a rejected booking returns 409, and a rejected booking does not block the slot or appear in the range query.

---

### Task 1: Status column and API rules

**Files:**
- Create: `api/migrations/014_reservation_status.sql`
- Modify: `api/src/routes/equipment.js`
- Modify: `api/tests/equipment.test.js` (add a `describe('Reservation approval', ...)` block; reuse the file's existing `newEquipment`, `book`, `auth`, tokens)

**Interfaces:**
- Produces:
  - Every reservation JSON object now includes `status` (`'confirmed' | 'pending' | 'rejected'`); the range query returns only `confirmed` and `pending`.
  - `GET /api/equipment/reservations/pending` (admin) returns `[{ id, equipment_id, equipment_name, user_id, user_name, title, notes, starts_at, ends_at }]`, ordered by `starts_at`.
  - `POST /api/equipment/reservations/:rid/approve` (admin) returns the updated reservation (status `confirmed`).
  - `POST /api/equipment/reservations/:rid/reject` (admin), body `{ note? }`, returns the updated reservation (status `rejected`).
  - Both decision routes: 404 if the id is unknown, 409 `{ error }` if the status is not `pending`, 403 for members.

- [ ] **Step 1: Write the failing tests** in the new `describe('Reservation approval', ...)` block. Use a helper `hours(n)` building a start of `2026-12-01T00:00:00Z` and an end n hours later. Each test is named and asserts exactly this:
  - `member booking of exactly 48 hours is confirmed` returns 201 and `body.status === 'confirmed'`.
  - `member booking of 48 hours and 1 minute is pending` returns 201 and `body.status === 'pending'`.
  - `admin booking over 48 hours is confirmed` (a 5-day booking made with `adminToken`).
  - `a pending booking holds its slot`: another member's overlapping POST returns 409.
  - `editing only the title keeps status`: a pending booking edited with `{ title }` is still `pending`, and a confirmed one is still `confirmed`.
  - `lengthening a confirmed booking past 48 hours makes it pending`: PATCH `ends_at` to 49 hours returns `status === 'pending'`; shortening a pending one back to 24 hours returns `confirmed`.
  - `admin editing a pending booking's times makes it confirmed`.
  - `member cannot approve or reject` returns 403 for both routes; `GET /reservations/pending` as a member returns 403.
  - `admin sees the pending request and approves it`: the pending list contains it (with `equipment_name` and `user_name`), approve returns `status === 'confirmed'`, and the list no longer contains it.
  - `approving or rejecting a non-pending booking returns 409`, and an unknown id returns 404.
  - `rejecting frees the slot and hides the booking`: after reject with `{ note: 'No disponible' }`, a new overlapping booking by another member returns 201, the range query does not include the rejected one, and a PATCH of the rejected booking by its owner returns 409.

- [ ] **Step 2: Run `cd api && npx jest --runInBand --forceExit --testTimeout=8000 equipment -t "Reservation approval"` and confirm the new tests fail** (status undefined, routes return 404).

- [ ] **Step 3: Write the migration** `014_reservation_status.sql`: `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','pending','rejected'))`, plus `decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL`, `decided_at TIMESTAMPTZ`, `decision_note TEXT NOT NULL DEFAULT ''`.

- [ ] **Step 4: Implement in `api/src/routes/equipment.js`:**
  - `MAX_AUTO_HOURS = 48` and `statusFor(starts: Date, ends: Date, isAdmin: boolean): 'confirmed' | 'pending'`.
  - Add `status` to `RESERVATION_COLUMNS`.
  - `findConflict` and the range query filter `status IN ('confirmed','pending')`.
  - Create sets `status` with `statusFor` (admins always confirmed).
  - Update: return 409 `{ error: 'La reserva fue rechazada' }` if the existing row is rejected; recompute status only when `starts_at` or `ends_at` changed (admin gives `confirmed`, member uses `statusFor`).
  - New routes `GET /reservations/pending`, `POST /reservations/:rid/approve`, `POST /reservations/:rid/reject`, all `requireAdmin`. Approve and reject do a single `UPDATE ... WHERE id = $1 AND status = 'pending' RETURNING ...` setting `decided_by`, `decided_at` and (reject only) `decision_note`; when it returns no row, a second `SELECT` distinguishes 404 from 409.

- [ ] **Step 5: Run the new tests and confirm they pass**, then run `cd api && npm test` and confirm every suite passes.

- [ ] **Step 6: Commit**

```bash
git add api docs
git commit -m "feat(api): admin approval for reservations longer than 48 hours"
```

---

### Task 2: Calendar and admin panel

**Files:**
- Modify: `app/src/api/client.js`, `app/src/pages/equipment/EquipmentPage.jsx`, `app/src/pages/equipment/ReservationModal.jsx`, `app/src/pages/equipment/Equipment.module.css`

**Interfaces:**
- Consumes: the HTTP contract from Task 1.
- Produces in `api.equipment`: `pending()`, `approve(rid)`, `reject(rid, note)`. `ReservationModal`'s `onChanged` is now called with the saved reservation (or `undefined` after a delete).

- [ ] **Step 1: Add the three client methods** matching the existing style (`reject` sends `{ note }`).

- [ ] **Step 2: Calendar:** in `EquipmentPage.jsx`, events whose `resource.status === 'pending'` get an amber background and `title` suffixed with ` (pendiente)`. Rejected bookings never arrive from the API. In `ReservationModal.jsx`, show an amber "Pendiente de aprobación de un administrador" banner for a pending booking, and under the time fields a hint "Más de 2 días: necesitará aprobación de un administrador" when a non-admin's end minus start is greater than 48 hours.

- [ ] **Step 3: Notice after saving:** the page keeps a `notice` string. When `onChanged(saved)` receives `saved.status === 'pending'`, it sets "Tu reserva dura más de 2 días y quedó pendiente de aprobación de un administrador. Avísales por WhatsApp.", shown above the tabs and cleared on the next save or tab change.

- [ ] **Step 4: Admin pending panel:** a "Pendientes (N)" button in the header actions (admins only; N loaded with `api.equipment.pending()` on mount and refreshed after every decision or save). It opens a panel listing each request (equipment, requester, title, start and end in local time) with **Aprobar**, and **Rechazar** that reveals an optional reason field and a confirm button. After a decision the list and calendar reload. Errors show in the page's existing `error` line.

- [ ] **Step 5: Verify:** `cd app && npm run build` passes. With the API and app running locally, check by HTTP through the Vite proxy: a member's 3-day booking comes back `pending`, the admin's pending list contains it, approve makes the range query return it as `confirmed`. Say plainly if the browser check could not be done.

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "feat(app): pending bookings on the calendar and admin approval panel"
```
