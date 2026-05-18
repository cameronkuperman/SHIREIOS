# Backend Needed — Shift Setup, Waiter Roster & Waitlist Quotes

This document tracks the backend work required by the mobile changes in the
"Seat button + Next Up + Shift Setup" round. The mobile app degrades gracefully
where these endpoints are missing, but the features below are only fully live
once the backend ships them.

## 1. New REST endpoints

All endpoints live under the existing `/locations/:id` namespace and use the
same Supabase bearer-token auth the rest of the host API uses (the mobile
client attaches it via `apiClient.interceptors.request` in
`src/services/api/client.ts`).

### `GET /locations/:id/waiters`

Returns the restaurant's active waiter roster so the host can pick who is
working a given shift.

- Query: `SELECT id, name, role, tier, is_active FROM waiters WHERE restaurant_id = :id AND is_active = true ORDER BY name`
- Response: `{ "waiters": [{ "id": "uuid", "name": "Jenna", "role": "server" }] }`
  - A bare array `[{ ... }]` is also accepted by the client.
- Mobile consumer: `fetchWaiters()` in `src/features/routing/api.ts`, surfaced
  through the `useWaiters()` hook and the `ShiftSetupSheet` component.

### `POST /locations/:id/waiters`

Creates a persistent waiter for the restaurant (used by the "Add waiter" flow
in shift setup).

- Body: `{ "name": "Jenna", "role": "server" }` (`role` optional, default `server`)
- Insert into `public.waiters` with `restaurant_id = :id`, `is_active = true`.
- Response: `{ "waiter": { "id": "uuid", "name": "Jenna", "role": "server" } }`
  (a bare object is also accepted).
- Mobile consumer: `createWaiter()` in `src/features/routing/api.ts`.

### `PATCH /locations/:id/waiters/:waiterId` (optional, V2)

Update `name`, `role`, or `is_active`. Used later for archiving a waiter
without deleting their history. Not required for this round.

## 2. Waitlist quoted wait support

The mobile waitlist now treats the quoted wait as a central host workflow:
hosts pick a quick quote when adding a party, every row shows `Quoted` beside
actual time waited, and quick edit can adjust the quoted minutes later.

Existing waitlist endpoints should accept and return `quotedWaitMinutes`:

- `POST /locations/:id/waitlist` body includes
  `{ "quotedWaitMinutes": 30 }` or `null` when the host leaves the quote unset.
- `PATCH /locations/:id/waitlist/:waitlistEntryId` accepts
  `{ "quotedWaitMinutes": 45 }` or `null` to clear the quote.
- `GET /locations/:id/waitlist` and all waitlist action responses should return
  `quotedWaitMinutes` on each entry. The mobile contract already expects this
  field and falls back to `TBD` only when it is `null`.

If the backend stores a broader quote range later, keep this field as the
host-facing midpoint/primary quote for V1 compatibility, then add separate
`quotedWaitMinMinutes` / `quotedWaitMaxMinutes` fields in a follow-up contract.

## 3. Routing payload extension

The existing `PUT /locations/:id/routing` endpoint accepts
`WaiterRoutingUpdatePayload`. This round adds a new value to `mode`:

- `mode` was `'manual_rotation'`; it is now `'manual_rotation' | 'section'`.
- The backend handler must accept and persist `'section'`. No schema migration
  is needed — `mode` is stored as text on the routing record.

When the host picks roster waiters in shift setup, the mobile app adds them to
`routing.waiters` / `activeWaiterIds` / `rotationOrder` and persists through
this same endpoint. Roster waiter IDs are real `waiters.id` UUIDs (not the
`temp-...` IDs used for ad-hoc additions), so the backend can safely join
routing waiters back to the `waiters` table.

## 4. Schema usage (no migrations required)

The following existing tables back these features:

- `waiters` — source of truth for the roster (`GET`/`POST` above).
- `sections` — V1 derives section names from the floor map, so no endpoint is
  strictly required. If a `GET /locations/:id/sections` is cheap to add it
  would let hosts pre-create sections that have no tables yet. **Optional.**
- `waitlist_entries.quoted_wait_minutes` / equivalent — source of truth for the
  quoted wait shown to hosts and sent in waitlist guest messaging.
- `shifts` — not written in V1. V2 should insert a `shifts` row on clock-in and
  close it on clock-out, linking `waiter_id` + `section_id`.
- `schedule_shifts`, `staff_metrics_daily`, `demand_forecasts` — intended data
  sources for the shift-summary hour grid. V1 builds the grid from reservation
  data only; wiring real projected/served covers is V2.

## 5. Auth + RLS

- All new endpoints sit behind the existing Supabase bearer token.
- RLS on the new `waiters` endpoints must scope rows to the host's restaurant.
  Reuse the policy already on `waiters` if one exists; otherwise mirror the
  policy used for `tables`.

## 6. Error contracts

- `GET /locations/:id/waiters`: the mobile client treats a `404` as "no roster
  yet" and shows an empty list (see `fetchWaiters`). Once the endpoint exists it
  should return `200` with `[]` rather than `404` when the roster is empty.
- `POST /locations/:id/waiters`: on `4xx`, return
  `{ "error": { "code": "...", "message": "..." } }`. The mobile app surfaces
  `message` in an alert. On failure the app falls back to a session-only
  temporary waiter so shift setup is never blocked.
- `POST`/`PATCH /locations/:id/waitlist`: validate `quotedWaitMinutes` as a
  positive integer number of minutes or `null`. On validation failure, return
  `{ "error": { "code": "VALIDATION_ERROR", "message": "Quoted wait must be a positive number of minutes." } }`.

## 7. Open questions for backend

- **Duplicate waiter names:** `POST /waiters` should probably dedupe — if
  `(restaurant_id, lower(name))` already exists, return the existing row
  instead of inserting a second one.
- **Attribution:** do we want to record which host user added a waiter? If so,
  add a `created_by_user_id` column to `waiters`. This is a soft schema change
  and is not required for the mobile feature to work — flag separately.
- **Reservation table suggestion:** the mobile app currently mocks a
  `suggestedTableId` on the first few upcoming reservations (see
  `withMockTableSuggestions` in `src/features/host/hooks.ts`). To make this real,
  the reservation payload needs a `suggestedTableId` field populated by whatever
  table-recommendation logic the backend runs. The mobile `Reservation` type
  already carries the optional `suggestedTableId` field.
