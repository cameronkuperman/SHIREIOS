# Realtime Floor State

## Overview

The host floor experience now uses a persistent local store plus a websocket stream instead of a UI-local React context.

## Architecture

- `floor map` is separate from the websocket stream and defines rooms, rows, table geometry, capacity, and server assignment.
- `live floor state` is server-authoritative and is hydrated from:
  1. persisted MMKV cache
  2. HTTP snapshot bootstrap
  3. websocket delta updates
- Host actions apply a short optimistic overlay locally, but the next canonical server update wins.

## Mobile Implementation

- Zustand + MMKV store persists `tablesById`, `mapVersion`, `lastSnapshotAt`, and `lastAppliedSequence`.
- Volatile state tracks connection status, pending commands, and sync errors.
- Selectors drive the floor map, quick-seat strip, seat-party list, and table popover from the same source of truth.

## Realtime Protocol

Inbound events:

- `floor.snapshot`
- `table.updated`
- `table.batch_updated`
- `command.rejected`
- `connection.ping`

Outbound commands:

- `seat_party`
- `seat_walk_in`
- `clear_table`
- `mark_clean`
- `block_table`
- `unblock_table`

## Mock Server

- Workspace app: `shire/apps/mock-floor-server`
- HTTP snapshot endpoint: `GET /api/floors/:floorId/snapshot`
- Websocket endpoint: `ws://host:port/ws/floors/:floorId`
- Includes deterministic scenario playback plus periodic AI-like state changes so the mobile flow can be built before the real backend is ready.
