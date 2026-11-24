# External users with calendar-only access — design

Date: 2026-11-24. Status: approved in conversation (the user approved the "Externo" category and that externals see all equipment). Size: small feature, so this is the short design. Builds on the equipment reservation designs.

## Intent and why

People from outside the lab use instruments in the group's three spaces and need to book them in the calendar. They must not see or touch inventory, experiments, templates, datasets, publications or user administration.

## Goals

- A new role `external`. An approved external user can log in, see every equipment, view the calendar and make, edit and cancel their own bookings.
- Everything outside the calendar is refused for externals **on the server**, not just hidden in the menu.
- Externals land on the calendar and see only the Equipos entry in the menu.

## Non-goals and anti-goals

- No per-equipment or per-location access (externals see all equipment, as decided).
- Externals never see other people's booking notes; the notes, if any, stay visible on their own bookings. Titles, names and times are visible.
- No new registration flow: externals use the existing Register page and admin approval; an admin marks them Externo under Usuarios.
- Do not weaken anything for members or admins; their behavior must not change.

## Decisions

- New enum value `external` in `user_role` (migration `015`).
- A middleware `restrictExternals(['/auth', '/equipment'])` mounted on `/api` before every router. It is a **whitelist**: any path other than `/auth...` and `/equipment...` (matched on whole path segments, so `/equipmentx` is not allowed) returns 403 for an external user, so any route added later is closed by default.
- The middleware reads the user's **current role from the database** (one primary-key lookup) rather than trusting the role inside the token. A user demoted to Externo loses access to inventory and the rest immediately, even if they still hold a token from before. A request with no token, an invalid token, or a user that no longer exists passes through untouched so the route's own 401 is returned.
- Externals book under the same rules, including admin approval for bookings over 48 hours. Equipment creation, archiving and the pending-approvals list stay admin-only (already enforced).
- In the range query, `notes` is blanked unless the viewer is the booking's owner or is not external.
- `PATCH /api/admin/users/:id/role` accepts `external`. The Usuarios role selector gets an "Externo" option and the confirmation text a label for it.
- Front end: an external user's menu shows only Equipos; every page other than Equipos and Perfil redirects an external to `/app/equipment` (this includes `/app/dashboard`, where login lands).
- Known limitation: a member promoted from Externo keeps the old token's role until they log in again (the safe direction: they just see fewer notes), and admin checks inside routes still use the token's role as before.

## Approaches considered

1. Whitelist middleware plus a role value (chosen): small, closes new routes by default, easy to test.
2. Add a role check to every existing route: many edits, and any future route would be open by default.
3. A separate calendar-only app and API: duplicates auth and the calendar, and doubles deployment.

## Design

**Database:** `api/migrations/015_external_role.sql`: `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'external';` (no statement in the file uses the new value, so it is safe inside the migration transaction on Postgres 12 and later).

**API:** `restrictExternals` in `api/src/middleware/auth.js`, mounted in `api/src/app.js` as `app.use('/api', restrictExternals(['/auth', '/equipment']))` before the routers; the role whitelist in `api/src/routes/admin.js`; notes filtering in `api/src/routes/equipment.js`.

**Frontend:** `AppLayout.jsx` menu filter, route guard in `App.jsx`, role option and label in `AdminUsers.jsx`.

**Tests:** new `api/tests/external.test.js`.

## Left to the builder

Wording of the 403 message and of the Externo label, and how the guard component is named.
