# Equipment reservations — design

Date: 2026-11-24. Status: approved in conversation ("Go for it"). Size: a small feature, so this is the short design.

## Intent and why

Lab members share equipment such as the microwave. They need to book it the way they would book an event in Outlook: a start date and time and an end date and time. Examples: 24/11/2026 17:00 to 25/11/2026 20:00, or two hours in one day. Each reservable equipment gets its own tab with a calendar, so everyone can see when it is free.

## Goals

- A new "Equipos" section in the intranet with one tab per equipment and an Outlook-style calendar (day, week and month views).
- Create a booking by dragging on the calendar or with a form. Edit and cancel are also supported.
- Overlapping bookings on the same equipment are rejected, with a message saying who holds it.
- Admins manage the list of reservable equipment.

## Non-goals and anti-goals

- No recurring bookings, no approval workflow, no email notifications.
- No double-booking, ever, even when two people click at the same moment.
- Do not touch the inventory, experiments or publications code.

## Decisions (from the conversation)

- A booking is one continuous block from a start datetime to an end datetime (not a daily window).
- Any approved member can book. The creator or an admin can edit or cancel a booking. Admins add, edit and archive equipment.
- Back-to-back bookings are allowed: end = 17:00 and next start = 17:00 do not conflict.
- A booking has a title, optional notes, a start and an end.
- Times are stored as `timestamptz` and shown in the viewer's local time.
- UI text is in Spanish, matching the rest of the app.

## Approaches considered

1. `react-big-calendar`. Chosen. Outlook-like views and drag-to-select, one new dependency, styled to match the app.
2. FullCalendar. Too heavy for this need.
3. Hand-built week grid. No dependency, but drag selection, overlap layout and a month view are a lot of code to maintain.

Conflict safety: lock the equipment row inside a transaction (`SELECT ... FOR UPDATE`), then check for overlap before inserting or updating. This needs no Postgres extension, unlike an exclusion constraint.

## Design

**Database** (`api/migrations/013_equipment_reservations.sql`)
- `equipment(id, name, description, location, active, created_by, created_at)`
- `reservations(id, equipment_id, user_id, title, notes, starts_at, ends_at, created_at)` with `CHECK (ends_at > starts_at)` and an index on `(equipment_id, starts_at)`.

**API** (`api/src/routes/equipment.js`, mounted at `/api/equipment`)
- `GET /` list active equipment. `POST /`, `PATCH /:id` for admins (`requireAdmin`).
- `GET /:id/reservations?from=&to=` reservations that overlap the range, with the booker's name.
- `POST /:id/reservations`, `PATCH /reservations/:rid`, `DELETE /reservations/:rid`. Overlap returns 409 with the holder's name. Edit and delete are allowed for the owner or an admin.

**Frontend** (`app/`)
- A new "Equipos" nav item in `AppLayout.jsx`, routes `/app/equipment` and `/app/equipment/:id`, and methods in `api/client.js`.
- `pages/equipment/EquipmentPage.jsx`: a tab per equipment, the calendar, and a modal for creating or editing a booking. Admins also get a small form to add equipment.

**Tests:** Jest and Supertest in `api/tests/equipment.test.js` covering overlap, back-to-back, permissions and validation.

## Left to the builder

Calendar styling details, the modal layout, how to seed example equipment (the microwave) in `seed.js`, and the exact validation messages.
