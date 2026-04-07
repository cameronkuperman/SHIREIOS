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

The reservation list route should support:

- `date`
- `status`
- `search`

`search` should match at least guest name and normalized phone.

The app currently uses a day-book pattern, so server-side filtering matters for:

- same-day speed
- search performance on mobile
- keeping list payloads bounded

## Reservation Payload Shape

The mobile app expects each reservation to include:

- `id`
- `guestId`
- `guest.name`
- `guest.phone`
- `guestName`
- `guestPhone`
- `partySize`
- `date` or `serviceDate`
- `timeSlot` or `reservationTime`
- `seatingPreference`
- `status`
- `source` or `channel`
- `notes`
- `specialRequests`
- `internalNotes`
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
- optional `messageDelivery`

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

- `timeSlot` or `reservationTime`
- `available`
- `reason`
- `servicePeriodId`
- `servicePeriodName`
- `canOverridePacing`

This allows host bookings to surface pacing failures while still offering a
staff-only override path when the backend permits it.

## Floor Seating Handoff

The mobile app now sends `seat_party` commands for both:

- `party.source = 'waitlist'`
- `party.source = 'reservations'`

For reservation seating, backend behavior should mirror waitlist seating in
terms of command correlation and canonical state updates.

Required behavior:

- validate the reservation
- validate the target table
- validate waiter ownership rules when `waiterId` is supplied
- create or link the visit
- attach `reservation_id` to that visit
- mark the reservation seated canonically
- emit a success event with `commandId`

## Realtime And Cache Synchronization

The mobile app can function with query invalidation plus polling, but a stronger
contract is preferred.

Minimum acceptable behavior:

- successful reservation create, update, and action flows return the full
  canonical reservation payload
- successful reservation seating emits `table.updated` or `table.batch_updated`
  with `commandId`

Preferred behavior:

- add a `reservation.updated` event with the full canonical reservation payload
- include enough visit metadata in floor updates to confirm reservation linkage

## Nice-To-Have Additions

These are not required for the current mobile release but would remove
workarounds:

- `GET /api/v1/locations/{location_id}/reservations/{reservation_id}`
- date-range reservation listing for richer calendar density views
- explicit seatable-state hints for reservations near service time
- reservation settings mutation routes if manager controls move into mobile
