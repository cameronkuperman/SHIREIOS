# Host Mobile Reservations Contract

This document captures the minimum backend expectations for the Shire host mobile
reservations experience.

## Goal

Support a host-grade reservation workflow in the mobile app where reservations
are first-class peers to waitlist and floor operations.

## Required Host Routes

- `GET /api/v1/locations/{location_id}/reservations`
- `POST /api/v1/locations/{location_id}/reservations`
- `PATCH /api/v1/locations/{location_id}/reservations/{reservation_id}`
- `POST /api/v1/locations/{location_id}/reservations/{reservation_id}/actions/{action}`
- `GET /api/v1/locations/{location_id}/availability`
- `GET /api/v1/locations/{location_id}/reservation-settings`

## Mobile Query Expectations

Use the existing `/api/v1` routes.

For reservation list, mobile calls:

- `GET /api/v1/locations/{location_id}/reservations`

Supported query params:

- `date`
- `status`
- `search`

`search` should match at least guest name and normalized phone.

List responses should be wrapped as:

```json
{ "reservations": [...] }
```

The app currently uses a day-book pattern, so server-side filtering matters for:

- same-day speed
- search performance on mobile
- keeping list payloads bounded

## Reservation Payload Shape

Mobile should prefer these fields on each reservation:

- `id`
- `guestName`
- `guestPhone`
- `partySize`
- `date`
- `timeSlot`
- `seatingPreference`
- `status`
- `source` or `channel`
- `notes`
- `internalNotes`
- `linkedVisitId`
- `assignedTableId`
- `pacingOverrideApplied`
- `createdAt`
- `updatedAt`
- optional lifecycle timestamps:
  - `confirmedAt`
  - `checkedInAt`
  - `seatedAt`
  - `completedAt`
  - `canceledAt`
  - `noShowAt`

The mobile app still safely reads these older fallback fields while backend
payloads converge:

- `guestId`
- `guest.name`
- `guest.phone`
- `serviceDate`
- `reservationTime`
- `specialRequests`
- `notesInternal`

Status values the mobile app is aligned to:

- `booked`
- `confirmed`
- `checked_in`
- `seated`
- `completed`
- `canceled`
- `no_show`

## Availability Payload Shape

The mobile app expects availability to be rules-based and slot-oriented.

Top-level fields:

- `date`
- `partySize`
- `channel`
- `timezone`
- `slots[]`

Each slot should include:

- `timeSlot`
- `available`
- `reason`
- `servicePeriodId`
- `servicePeriodName`
- `canOverridePacing`

This allows host bookings to surface pacing failures while still offering a
staff-only override path when the backend permits it.

## Actions

Reservation actions continue to use:

- `POST /api/v1/locations/{location_id}/reservations/{reservation_id}/actions/{action}`

Supported canonical statuses remain:

- `booked`
- `confirmed`
- `checked_in`
- `seated`
- `completed`
- `canceled`
- `no_show`

Mobile can now send:

- `arrive`

Backend may still return reservation status `checked_in` for that action.

## Floor Seating Handoff

For reservations, mobile should send the seat action over HTTP, not as the
primary websocket write path.

The floor websocket remains the confirmation path after the reservation seat
action succeeds.

Required behavior for reservation seating:

- accept an HTTP seat action payload with:
  - `tableId`
  - `waiterId` when routing requires it
  - `commandId`
- validate the reservation
- validate the target table
- validate waiter ownership rules when `waiterId` is supplied
- create or link the visit
- attach `reservation_id` to that visit
- mark the reservation seated canonically
- emit floor success state with `commandId`

## Realtime And Cache Synchronization

The mobile app can function with query invalidation plus polling, but a stronger
contract is preferred.

Minimum acceptable behavior:

- successful reservation create, update, and action flows return the full
  canonical reservation payload
- successful reservation seating emits `table.updated` or `table.batch_updated`
  with `commandId`
- floor updates include `currentReservationId` and `currentVisitId` when a
  reservation has been seated

Preferred behavior:

- add a `reservation.updated` event with the full canonical reservation payload
- include enough visit metadata in floor updates to confirm reservation linkage

Mobile matches reservation seating confirmation by:

- `commandId`
- `table.currentReservationId`
- `table.currentVisitId`

## Nice-To-Have Additions

These are not required for the current mobile release but would remove
workarounds:

- `GET /api/v1/locations/{location_id}/reservations/{reservation_id}`
- date-range reservation listing for richer calendar density views
- explicit seatable-state hints for reservations near service time
- reservation settings mutation routes if manager controls move into mobile

## Current Mobile Constraints

The mobile app should not depend on `messageDelivery` yet. It is still not
implemented backend-side and should be treated as absent.
