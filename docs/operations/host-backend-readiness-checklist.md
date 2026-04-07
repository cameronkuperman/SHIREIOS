# Host Backend Readiness Checklist

Use this checklist before cutting the Phase 1 host frontend over to production
backend services.

## Identity And Access

- Supabase email/password auth is enabled in every target environment.
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are provisioned
  for the mobile app.
- Backend validates Supabase JWTs on every protected host endpoint.
- `GET /me` and `GET /me/locations` are implemented and return location-scoped
  permissions.
- `POST /locations` is implemented and creates membership, floor-map defaults,
  and initial routing state.
- Users with access to multiple locations can switch locations without leaking
  data across stores.

## Bootstrap And Floor

- `GET /locations/:locationId/bootstrap` returns `session`, `location`,
  `floorId`, and `floorMap`.
- `GET /locations/:locationId/routing` returns the canonical day-level waiter
  routing state.
- `PUT /locations/:locationId/routing` persists frontend waiter-routing edits.
- `GET /locations/:locationId/floors/:floorId/snapshot` returns stable
  `snapshotAt` and `tablesById` fields.
- `WS /ws/locations/:locationId/floors/:floorId` accepts authenticated
  connections and auto-subscribes the client on connect.
- Websocket auth supports `access_token=<jwt>` query auth.
- Snapshot and websocket sequence semantics are documented and stable.
- Floor maps are available for every launch location.
- Routing does not depend on POS-imported staff, sections, or server mappings.

## Waitlist

- `GET /locations/:locationId/waitlist` is implemented.
- `POST /locations/:locationId/waitlist` is implemented.
- `PATCH /locations/:locationId/waitlist/:id` is implemented.
- `POST /locations/:locationId/waitlist/:id/actions/:action` supports:
  - `arrive`
  - `remove`
  - `mark_no_show`
- Waitlist payloads include:
  - guest fields
  - quote time
  - canonical status
  - timestamps for arrival, seating, removal, and no-show when applicable
- Backend does not emit `notified` in Phase 1 unless it also includes
  `notifiedAt`.

## Realtime Queue Sync

- `waitlist.updated` is emitted after waitlist create, patch, and action flows.
- `waitlist.updated` is also emitted after a successful `seat_party` that
  consumes a waitlist entry.
- `waitlist.updated` carries the full canonical waitlist entry payload.
- `routing.updated` is emitted after waiter roster, assignment, next-up, or
  seat-driven routing changes.

## Table Commands

- Backend accepts all six frontend table command types over websocket.
- Successful `seat_party` with `party.source = 'waitlist'` atomically updates
  both table state and waitlist state.
- Seating validates `waiterId` against active routing state.
- Successful seats persist waiter ownership on the visit and update routing
  history / next-up state.
- Successful command results include stable `commandId` on the emitted success
  event.
- If backend emits `table.batch_updated` for a command result, that event also
  includes `commandId`.
- Failed commands emit `command.rejected` with:
  - `commandId`
  - `tableId`
  - `error.code`
  - `error.message`
  - optional `error.retryable`
- Double-seat conflicts are handled canonically server-side.
- No-section floors still support routing via table assignments and next-up
  fallback.

## Audit And Support

- Host mutations record actor, timestamp, location, and entity ID.
- Logs can correlate websocket `commandId` with backend actions.
- Backend exposes enough data to debug stale snapshot and websocket failure
  cases.
- Backend exposes current waiter coverage and per-waiter shift/day routing
  history.

## Release Validation

- One host device can log in, pick a location, and fetch bootstrap
  successfully.
- Two host devices can connect to the same floor and stay in sync.
- Waitlist add/edit/arrive/remove/no-show flows work end-to-end.
- Seating from waitlist updates both floor state and waitlist state.
- Walk-in seating works without creating a waitlist entry.
- Waiter routing edits stay synced across two host devices.
- Floors without sections still seat correctly with table overrides or next-up
  fallback.
- Block/unblock/clear/mark-clean actions work with CV-backed floor data.
- Offline/reconnect restores canonical floor and waitlist state without
  duplicates.
- No reservation endpoints or notify flows are required for the Phase 1 host
  release.
