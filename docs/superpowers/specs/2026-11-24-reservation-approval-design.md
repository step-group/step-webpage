# Admin approval for long reservations — design

Date: 2026-11-24. Status: calls proposed in conversation and accepted (the user dropped email notifications and said they will coordinate approvals over WhatsApp). Size: small feature, so this is the short design. Builds on `2026-11-24-equipment-reservations-design.md`.

## Intent and why

Nobody should hold shared equipment for more than two whole days without an admin agreeing. A longer booking is created as **pending** and waits for an admin to approve or reject it. Admins and requesters talk over WhatsApp, so the platform sends no email and shows the state in the calendar.

## Goals

- A member's booking longer than 48 hours (end minus start) is created as `pending`; 48 hours or less is `confirmed` immediately. The user's example (24/11 17:00 to 25/11 20:00, 27 hours) is confirmed.
- Admins see a list of pending requests and can approve or reject each one (reject with an optional reason).
- Pending bookings are visibly different on the calendar and say so in the booking window.

## Non-goals and anti-goals

- No email, no WhatsApp integration, no sidebar badge, no notification of any kind.
- A pending request must never allow a double booking: it holds its slot.
- A member must never be able to turn a long booking into a confirmed one by editing it.
- Do not add the usage log (parked for later).

## Decisions

- Threshold: duration strictly greater than 48 hours needs approval (`MAX_AUTO_HOURS = 48` constant in the API).
- An admin's own bookings are always `confirmed`. An admin who edits a booking leaves it `confirmed`.
- Pending and confirmed bookings both count for overlap checks (a pending one holds its slot). Rejected ones do not.
- A member editing a booking re-evaluates status only if the start or end changed: longer than 48 hours becomes `pending`, 48 hours or less becomes `confirmed`. Editing only title or notes never changes status.
- Any admin can approve or reject. Rejecting keeps the row (`status = 'rejected'`, with the reason) so a record exists, but it is excluded from the calendar and from overlap checks.
- Existing bookings become `confirmed` in the migration.

## Approaches considered

1. A `status` column on `reservations` with `decided_by`, `decided_at`, `decision_note`. Chosen: smallest change and keeps one source of truth for the calendar and overlaps.
2. A separate `reservation_requests` table. Duplicates the overlap logic and splits the calendar data across two tables.

## Design

**Database** (`api/migrations/014_reservation_status.sql`): add `status` (`confirmed` | `pending` | `rejected`, default `confirmed`, with a CHECK), `decided_by` (users, `ON DELETE SET NULL`), `decided_at`, `decision_note`.

**API** (`api/src/routes/equipment.js`)
- Create and update compute status as described above and return `status` on every reservation.
- Overlap check and range query use `status IN ('confirmed','pending')`; the range query also returns `status`.
- `GET /api/equipment/reservations/pending` (admin): pending requests across all equipment, each with equipment name, requester name, title, notes, start, end. Declared before the `/:id/...` routes.
- `POST /api/equipment/reservations/:rid/approve` (admin): pending to confirmed, stamps `decided_by`/`decided_at`; 404 if not found, 409 if it is not pending.
- `POST /api/equipment/reservations/:rid/reject` (admin), body `{ note? }`: pending to rejected; same 404 and 409.

**Frontend** (`app/`)
- Calendar events with `status === 'pending'` are drawn amber with "(pendiente)" in the title.
- The booking window shows a "Pendiente de aprobación" banner for pending bookings, and a live hint under the time fields when a non-admin picks more than 48 hours.
- After a member saves a booking that comes back pending, the page shows a notice that it needs admin approval (to be coordinated over WhatsApp).
- Admins get a "Pendientes (N)" button in the page header opening a panel with Aprobar and Rechazar (reason field) per request, loaded from the pending endpoint.

**Tests** (`api/tests/equipment.test.js`): exactly 48 hours is confirmed and 48 hours plus a minute is pending for a member; an admin's long booking is confirmed; a pending booking blocks overlaps; editing a confirmed booking to over 48 hours makes it pending, and editing only the title does not change status; approve and reject permissions (member gets 403), 409 when not pending; a rejected booking frees the slot and is excluded from the range query.

## Left to the builder

Exact colors and wording, how the pending panel is laid out, and the style of the rejection reason field.
