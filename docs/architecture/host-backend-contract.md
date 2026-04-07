# Host Frontend Backend Contract: Phase 1

This document defines the Phase 1 backend contract for the host mobile cutover.
It intentionally narrows scope to the production launch path now implemented in
the frontend.

## Scope

Phase 1 includes:

- Supabase bearer auth
- `GET /api/v1/me`
- `GET /api/v1/me/locations`
- `POST /api/v1/locations`
- `GET /api/v1/locations/{locationId}/bootstrap`
- `GET /api/v1/locations/{locationId}/routing`
- `PUT /api/v1/locations/{locationId}/routing`
- `GET /api/v1/locations/{locationId}/floors/{floorId}/snapshot`
- `WS /ws/locations/{locationId}/floors/{floorId}`
- waitlist CRUD
- waitlist actions `arrive`, `remove`, `mark_no_show`
- table websocket commands:
  - `seat_party`
  - `seat_walk_in`
  - `clear_table`
  - `mark_clean`
  - `block_table`
  - `unblock_table`

Phase 1 does not include:

- reservations
- waitlist `notify`
- SMS delivery or `messageDelivery`
- device-level backend support tracing
- POS-imported staff, sections, or table/server mappings
- permanent staff management beyond the current shift/day routing state

## Identity

- `locationId` is the backend `restaurant.id`.
- Backend-managed memberships determine which locations a Supabase user can access.
- `GET /api/v1/me` returns:
  - `session.user.id`
  - `session.user.email`
  - `session.user.fullName`
  - `session.user.role`
  - `session.organization.id`
  - `session.organization.name`
  - `session.permissions[]`
- `GET /api/v1/me/locations` returns:
  - `id`
  - `organizationId`
  - `name`
  - `timezone`
  - `floorId`
  - optional `isDefault`
  - `permissions[]`

## Bootstrap And Floor

- `POST /api/v1/locations` must create:
  - the location
  - the caller's host membership
  - initial floor-map state
  - initial day-level routing state
- `GET /api/v1/locations/{locationId}/bootstrap` returns:
  - `session`
  - `location`
  - `floorId`
  - `floorMap`
- `GET /api/v1/locations/{locationId}/floors/{floorId}/snapshot` returns:
  - `floorId`
  - `mapVersion`
  - `snapshotAt`
  - `sequence`
  - `tablesById`
- Frontend adapts `snapshotAt` to its internal `generatedAt` field and
  `tablesById` to `tables[]`. Backend does not need to rename these fields in
  Phase 1 as long as they stay stable.

## Realtime

- Websocket path: `WS /ws/locations/{locationId}/floors/{floorId}`
- Opening that websocket auto-subscribes the client to the floor. No subscribe
  frame is required.
- Auth:
  - support `Authorization: Bearer <jwt>` when available
  - support `access_token=<jwt>` query auth for React Native websocket clients
- Outbound messages:
  - `floor.snapshot`
  - `table.updated`
  - `table.batch_updated`
  - `waitlist.updated`
  - `routing.updated`
  - `command.rejected`
  - `connection.ping`
- Sequence behavior:
  - monotonic per floor
  - reconnect is snapshot-first
  - Postgres is canonical; Redis is optional and additive only

## Waitlist

Routes:

- `GET /api/v1/locations/{locationId}/waitlist`
- `POST /api/v1/locations/{locationId}/waitlist`
- `PATCH /api/v1/locations/{locationId}/waitlist/{id}`
- `POST /api/v1/locations/{locationId}/waitlist/{id}/actions/{action}`

Supported actions in Phase 1:

- `arrive`
- `remove`
- `mark_no_show`

Phase 1 waitlist status model:

- `waiting`
- `arrived`
- `seated`
- `removed`
- `no_show`

If backend must emit `notified` for legacy reasons, it must also include
`notifiedAt`, but the Phase 1 frontend does not expose a notify action.

Waitlist payload shape includes:

- `id`
- `guest.id`
- `guest.name`
- `guest.phone`
- `partySize`
- `seatingPreference`
- `status`
- `notes`
- `source`
- `joinedAt`
- `quotedWaitMinutes`
- optional `arrivedAt`
- optional `notifiedAt`
- `seatedAt`
- `removedAt`
- `noShowAt`
- `assignedTableId`
- `createdAt`
- `updatedAt`

`waitlist.updated` emits the full canonical waitlist entry after create, patch,
action, or seat-side effects from the table command path.

## Waiter Routing

Routing is backend-owned, location-scoped, and day-level. It does not depend on
POS imports.

Routes:

- `GET /api/v1/locations/{locationId}/routing`
- `PUT /api/v1/locations/{locationId}/routing`

Routing state must support:

- today's active waiters
- temporary/manual shift waiters
- section assignments when sections exist
- per-table waiter assignments
- next-up / rotation fallback when sections do not exist
- current waiter coverage
- shift/day routing history for fairness

Response shape:

- `mode = 'manual_rotation'`
- `waiters[]`
  - `id`
  - `name`
  - `isTemporary`
  - `status`
  - `isActive`
  - `assignedSectionIds[]`
  - `assignedTableIds[]`
  - `currentTableIds[]`
  - `servedTableIds[]`
  - `liveTables`
  - `servedSeatingCount`
  - `lastAssignedAt`
- `activeWaiterIds[]`
- `sectionAssignments`
- `tableAssignments`
- `rotationOrder[]`
- `nextWaiterId`
- `updatedAt`

`PUT /routing` persists the editable routing state:

- waiter list for the current shift/day
- active waiters
- section assignments
- table assignments
- rotation order
- next waiter

Backend remains authoritative for:

- current waiter on each table
- visit waiter ownership after seating
- per-waiter shift history
- fair next-up advancement after successful seats

`routing.updated` must emit the full canonical routing state after:

- waiter roster changes
- active waiter changes
- section/table assignment changes
- next-up changes
- successful seats that affect routing history or next-up state

## Table Commands

Supported websocket commands:

- `seat_party`
- `seat_walk_in`
- `clear_table`
- `mark_clean`
- `block_table`
- `unblock_table`

Seat command notes:

- For waitlist seating, frontend sends one `seat_party` command where:
  - `party.id` is the waitlist entry ID
  - `party.source = 'waitlist'`
- Backend must atomically:
  - validate the waitlist entry
  - validate the target table
  - validate `waiterId` against current routing / active waiter state when provided
  - seat the table
  - update the waitlist entry to `seated`
  - set `assignedTableId` and `seatedAt`
  - store waiter ownership on the visit/table state
  - update routing history and next-up state
  - emit canonical table update event
  - emit `waitlist.updated`
  - emit `routing.updated` when routing state changes

Success correlation:

- Successful command results must include `commandId` on the success event the
  frontend receives.
- If backend emits `table.batch_updated` for command results, that event must
  also include optional `commandId`.

## Error Contract

`command.rejected` must include:

- `commandId`
- `tableId`
- `error.code`
- `error.message`
- optional `error.retryable`

Stable backend codes in Phase 1:

- `TABLE_UNAVAILABLE`
- `TABLE_OCCUPIED`
- `TABLE_BLOCKED`
- `TABLE_CAPACITY_EXCEEDED`
- `WAITER_NOT_FOUND`
- `WAITER_NOT_ACTIVE`
- `ROUTING_CONFIG_INVALID`
- `PERMISSION_DENIED`
- `STALE_COMMAND`
- `NOT_FOUND`
- `VALIDATION_ERROR`

## Override Precedence

- CV is authoritative for sensed table state.
- Host override is authoritative for manual commands until backend clears or
  supersedes it.
- Backend must define exactly when:
  - a host block overrides CV clean/dirty state
  - a manual clean/clear command resets CV-driven state
  - a later CV event is allowed to replace a host override
