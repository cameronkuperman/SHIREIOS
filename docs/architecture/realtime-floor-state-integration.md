# Realtime Floor-State Integration (ML / Backend → Host UI)

Status: design + audit. Companion doc to [docs/architecture/realtime-floor-state.md](realtime-floor-state.md). This doc maps each spec requirement to existing mobile code, calls out gaps, proposes fixes, and lists acceptance tests.

Scope: how the host iPad app (Expo + React Native) consumes ML/backend-owned table state. ML/backend owns auth, table state, recommendations, and the WebSocket. The host UI never polls for live updates.

---

## 1. Architectural summary

```
┌────────────────────────────┐         ┌───────────────────────┐
│  Auth (Supabase / API)     │         │ ML / Backend          │
│  - issues JWT              │         │ - owns table state    │
└────────────┬───────────────┘         │ - owns recommendations│
             │ access_token             │ - owns WS endpoint    │
             ▼                          └─────────┬─────────────┘
        useAuth().session                         │
             │                                    │ ws + http
             ▼                                    ▼
┌──────────────────────────────────────────────────────────────┐
│ FloorRealtimeProvider  (apps/mobile/src/features/floor)      │
│   1. fetchFloorSnapshot(locationId, floorId)  → HTTP         │
│   2. open WebSocket  → ws subscribe + replay + live          │
│   3. apply messages to Zustand floor store                   │
│   4. send commands w/ requestId; reconcile via table.updated │
│   5. reconnect w/ backoff, preserving cursor                 │
└──────────────────────────────────────────────────────────────┘
             │
             ▼
        useFloorTablesByRoom / useQuickSeatSuggestions /
        useTableDetails / useFloorActions / useFloorConnectionState
```

Key files (existing):

| Concern | File |
|---|---|
| HTTP snapshot fetch | [shire/apps/mobile/src/features/floor/api.ts](../../shire/apps/mobile/src/features/floor/api.ts) |
| WebSocket transport | [shire/apps/mobile/src/features/floor/transport.ts](../../shire/apps/mobile/src/features/floor/transport.ts) |
| Lifecycle / orchestration | [shire/apps/mobile/src/features/floor/provider.tsx](../../shire/apps/mobile/src/features/floor/provider.tsx) |
| Reducers + selectors | [shire/apps/mobile/src/features/floor/state.ts](../../shire/apps/mobile/src/features/floor/state.ts) |
| Zustand store | [shire/apps/mobile/src/features/floor/store.ts](../../shire/apps/mobile/src/features/floor/store.ts) |
| Wire-format adapters | [shire/apps/mobile/src/features/floor/contracts.ts](../../shire/apps/mobile/src/features/floor/contracts.ts) |
| Outbound command builders | [shire/apps/mobile/src/features/floor/commands.ts](../../shire/apps/mobile/src/features/floor/commands.ts) |
| Action dispatch (UI → WS) | [shire/apps/mobile/src/features/floor/actions.ts](../../shire/apps/mobile/src/features/floor/actions.ts) |
| Message types | [shire/packages/shared/src/types/table.ts](../../shire/packages/shared/src/types/table.ts) |

---

## 2. Spec → Implementation map

Legend: ✅ shipped · ⚠️ partial / different shape · ❌ missing

### 2.1 On page load

| Spec | Status | Where |
|---|---|---|
| GET snapshot for current restaurant | ✅ | [api.ts:8](../../shire/apps/mobile/src/features/floor/api.ts#L8) `fetchFloorSnapshot(locationId, floorId)` → `GET /locations/:locationId/floors/:floorId/snapshot` |
| Render current table states | ✅ | `useFloorTablesByRoom`, `useTableDetails`, `useFloorConnectionState` (all in [store.ts](../../shire/apps/mobile/src/features/floor/store.ts)) |
| Render recommendations | ⚠️ | `useQuickSeatSuggestions` derives client-side from snapshot. Spec says ML owns recommendations — **clarify if ML emits a separate `recommendations.updated` event** or if the derived list is sufficient. |
| Store snapshot cursor | ✅ | `lastAppliedSequence` persisted in MMKV via `useFloorStore` ([store.ts:51-171](../../shire/apps/mobile/src/features/floor/store.ts#L51-L171)). |

> Note: the unit of "restaurant" in the URL is `locationId`. Confirm 1:1 with the ML `restaurant_id` term.

### 2.2 Open WebSocket

| Spec | Status | Where / Action |
|---|---|---|
| Authenticate using existing JWT | ✅ | `?access_token=<jwt>` on WS URL ([transport.ts:11-28](../../shire/apps/mobile/src/features/floor/transport.ts#L11-L28)). Token comes from `useAuth().session?.access_token` ([provider.tsx:82](../../shire/apps/mobile/src/features/floor/provider.tsx#L82)). |
| Send `subscribe` with restaurant_id + cursor | ❌ | The shared types define `SubscribeFloorMessage` ([table.ts:238-241](../../shire/packages/shared/src/types/table.ts#L238-L241)) but `FloorRealtimeTransport.connect()` never sends one — server today subscribes implicitly from the URL path. **Fix**: emit `{ type: 'subscribe', floorId, sinceSequence }` on `onopen`. Requires backend to (a) accept the message and (b) replay events `> sinceSequence`. |
| Apply replayed events then live events | ✅ | `applyFloorStreamMessageState` is sequence-gated; it ignores `sequence <= lastAppliedSequence` ([state.ts:379, 399, 422, 439](../../shire/apps/mobile/src/features/floor/state.ts#L379)). Replay vs live is invisible to the client by design. |

### 2.3 Handle events

| Event | Status | Where |
|---|---|---|
| `table_state.updated` (single table) | ✅ | `table.updated` → updates one table, advances sequence, clears matching pending command if `source !== 'ml'` ([state.ts:378-396](../../shire/apps/mobile/src/features/floor/state.ts#L378-L396)). |
| Batched updates | ✅ | `table.batch_updated` ([state.ts:398-419](../../shire/apps/mobile/src/features/floor/state.ts#L398-L419)). |
| `table_state.snapshot_ready` (server says reload) | ❌ | Not handled. Today, server can re-broadcast a `floor.snapshot` message and the client will overwrite state ([state.ts:376](../../shire/apps/mobile/src/features/floor/state.ts#L376)). **Fix**: add a `floor.cursor_expired` (or rename `snapshot_ready`) event that triggers `loadSnapshot()` without dropping the socket. |
| Heartbeat | ✅ | Server sends `connection.ping`; client replies `connection.pong` immediately on receipt ([provider.tsx:208-211](../../shire/apps/mobile/src/features/floor/provider.tsx#L208-L211), [transport.ts:102-107](../../shire/apps/mobile/src/features/floor/transport.ts#L102-L107)). |
| Error display / log | ✅ | `setSyncError` + `setConnectionState('error')` flow into `useFloorConnectionState`, surfaced in the host status chip. |

### 2.4 Commands (UI → backend)

| Spec | Status | Where |
|---|---|---|
| Send command messages with `request_id` | ✅ | Every command carries `commandId` ([commands.ts:3-5](../../shire/apps/mobile/src/features/floor/commands.ts#L3-L5)) sent over WS as `{ type: 'command', command }` ([transport.ts:95-100](../../shire/apps/mobile/src/features/floor/transport.ts#L95-L100)). |
| Wait for ack / error | ⚠️ | No explicit `command.ack`. Implicit ack = `table.updated` carrying the same `commandId` (clears pending entry). Reject = `command.rejected{commandId, error}`. **Risk**: a no-op command (e.g. `mark_clean` on already-clean) may not produce a `table.updated`, so the optimistic overlay would never clear. **Fix**: either backend always emits `table.updated` for accepted commands (preferred), or add an explicit `command.ack{commandId}` event handled identically. |
| Pending UI for manual overrides / mark clean / mark dirty | ✅ | `queuePendingCommand` writes optimistic state with `override.source = 'host'` + adds entry to `pendingCommands` ([state.ts:340-369](../../shire/apps/mobile/src/features/floor/state.ts#L340-L369)). `FloorTableViewModel.isPending` is true while the command is in flight ([state.ts:50, 583](../../shire/apps/mobile/src/features/floor/state.ts#L50)). |
| Reconcile with later `table.updated` | ✅ | Canonical (non-ML) update with the matching `commandId` removes the pending entry; ML updates do *not* clear pending (so the host action keeps its optimistic state until the host-sourced canonical event arrives). |
| Roll back on reject | ✅ | `rejectPendingCommandState` restores `previousTable` and surfaces a friendly message via `formatCommandRejectedMessage` ([state.ts:87-119](../../shire/apps/mobile/src/features/floor/state.ts#L87-L119)). |

### 2.5 Reconnect

| Spec | Status | Where |
|---|---|---|
| Reconnect with last seen cursor | ⚠️ | Reconnect today **always** runs `loadSnapshot()` first, then opens a new socket ([provider.tsx:163-176](../../shire/apps/mobile/src/features/floor/provider.tsx#L163-L176)). Correct, but not optimal — wastes a snapshot fetch when only a few events were missed. **Optimization**: open socket first, send `subscribe{ sinceSequence }`, only refetch snapshot if backend responds with `cursor_expired`. |
| If cursor expired → refetch snapshot | ⚠️ | Currently always refetches; safe but loses the cursor optimization. Tied to the same fix as 2.3 / 2.5. |
| No polling loop | ✅ | The only timer in this feature is the exponential-backoff reconnect (`scheduleReconnect`, [provider.tsx:146-161](../../shire/apps/mobile/src/features/floor/provider.tsx#L146-L161)). Cap `min(2^n · 1s, 15s) + jitter`. No interval polling anywhere. |

---

## 3. Socket message handlers — canonical contract

```ts
// Inbound (server → client) — apps/mobile/src/features/floor/contracts.ts adapts these
type Inbound =
  | { type: 'floor.snapshot';  floorId: string; sequence: number; snapshot: FloorSnapshot }
  | { type: 'table.updated';   floorId: string; sequence: number; table: TableLiveState;
      commandId?: string | null; source: 'host' | 'ml' }
  | { type: 'table.batch_updated'; floorId: string; sequence: number; tables: TableLiveState[];
      commandId?: string | null; source: 'host' | 'ml' }
  | { type: 'command.rejected'; floorId: string; sequence: number; commandId: string;
      tableId: string; error?: BusinessRuleError; reason?: string }
  | { type: 'waitlist.updated'; floorId: string; sequence: number; entry: WaitlistEntry; ... }
  | { type: 'routing.updated'; locationId: string; routing: WaiterRoutingState }
  | { type: 'connection.ping'; timestamp: string }
  // PROPOSED additions:
  | { type: 'command.ack'; commandId: string; sequence: number }       // optional, see 2.4
  | { type: 'cursor.expired'; reason: string }                          // see 2.3 / 2.5

// Outbound (client → server)
type Outbound =
  | { type: 'subscribe'; floorId: string; sinceSequence?: number }     // PROPOSED to be sent
  | { type: 'command'; command: TableCommand }
  | { type: 'connection.pong'; timestamp: string }
```

### Per-message handler (current behavior)

| Message | Action in store |
|---|---|
| `floor.snapshot` | `applyFloorSnapshotState` → replace `tablesById`, set `lastAppliedSequence`, clear `pendingCommands`, clear `syncError`. Skipped if `floorId` mismatch or sequence stale. |
| `table.updated` | Sequence-gate; merge one table; advance sequence; if `source==='host'` remove pending commands for that table. |
| `table.batch_updated` | Same, batched. |
| `command.rejected` | Look up pending entry; restore `previousTable`; `syncError = formatCommandRejectedMessage(...)`. |
| `waitlist.updated` | Advance sequence only — waitlist state lives in a separate query cache; `provider.tsx` writes `upsertWaitlistEntry` into RQ. |
| `routing.updated` | Forwarded to `useWaiterRoutingStore` + RQ cache. Not a floor table mutation. |
| `connection.ping` | Reply `connection.pong{timestamp}`. No store mutation. |
| `cursor.expired` *(new)* | Trigger `loadSnapshot()`; don't drop socket. |
| `command.ack` *(new, optional)* | Treat as no-op visually but clear pending entry by `commandId`. |

### Sequence rules (do not change without backend coordination)

- `lastAppliedSequence` advances only on snapshot / table.updated / table.batch_updated / command.rejected / waitlist.updated.
- A message with `sequence <= lastAppliedSequence` is ignored (idempotent replay).
- A snapshot with `sequence < lastAppliedSequence` is ignored too — backend must always send a snapshot whose sequence ≥ all previous events it covers.

---

## 4. State store updates

The Zustand store already encodes the right invariants. Summary:

```ts
type FloorStoreState = {
  // identity / cursor
  floorId: string;
  mapVersion: string;
  lastSnapshotAt: string | null;
  lastAppliedSequence: number;             // ← the cursor used on reconnect

  // canonical state
  tablesById: Record<string, TableLiveState>;

  // optimistic overlay (cleared by canonical updates or rollback)
  pendingCommands: Record<commandId, { command, tableId, previousTable }>;

  // connection
  connectionState: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
  syncError: string | null;
};
```

Persistence (MMKV) is partial: only the canonical fields and cursor persist; `pendingCommands` / `connectionState` / `syncError` are reset on cold start ([store.ts:135-170](../../shire/apps/mobile/src/features/floor/store.ts#L135-L170)). That preserves the cursor across app launches but drops in-flight commands — desired behavior.

---

## 5. Reconnect behavior

### Current (works, conservative)

```
on disconnect / error:
  attempt += 1
  delay = min(2^(attempt-1) · 1s, 15s) + rand(0..250ms)
  state = 'reconnecting'
  setTimeout(connect, delay)

connect():
  state = 'connecting' | 'reconnecting'
  loadSnapshot()           ← unconditional HTTP refetch
  open WebSocket
  on open: state = 'connected', attempt = 0
```

### Proposed (cursor-resume, snapshot only on demand)

```
connect():
  open WebSocket
  on open: send { type: 'subscribe', floorId, sinceSequence: lastAppliedSequence }
  if server replies with cursor.expired or floor.snapshot for cold-start:
    apply snapshot, continue
  else:
    server replays events > sinceSequence, then live stream

on cold start / no cursor:
  send subscribe with sinceSequence=0 → server returns floor.snapshot first
```

This is purely additive — the existing `floor.snapshot` handler already handles the cold-start path, so the change is:
1. Stop calling `loadSnapshot()` unconditionally inside `connect()`.
2. Emit `subscribe` on `onopen`.
3. Handle `cursor.expired` → call `loadSnapshot()` without dropping the socket.

Backoff and jitter unchanged. Gate behind backend readiness (feature flag or capability handshake).

---

## 6. UI acceptance tests

Test runner: Jest + React Testing Library / RN; reducer tests already live in [features/floor/__tests__/state.test.ts](../../shire/apps/mobile/src/features/floor/__tests__/state.test.ts). New tests slot into the same suite.

### 6.1 Reducer / state-store tests (pure, deterministic)

Existing (✅, [state.test.ts](../../shire/apps/mobile/src/features/floor/__tests__/state.test.ts)):
- hydrates a snapshot
- ignores stale ws updates by sequence
- clears pending command when canonical `table.updated{commandId}` arrives
- keeps pending command when ML update arrives for same table
- rolls back optimistic state on `command.rejected`
- maps stable rejection codes to friendlier copy
- rolls back even if backend rejection uses a different table id
- advances cursor on `waitlist.updated` without mutating tables

To add:
- **AT-S1**: applying snapshot with sequence equal to `lastAppliedSequence` is a no-op (idempotent re-subscribe).
- **AT-S2**: applying replayed `table.updated` followed by live `table.updated` produces the same final state regardless of order, given strictly increasing sequences.
- **AT-S3**: `cursor.expired` event triggers `loadSnapshot` once and the next snapshot supersedes prior pending overlay (overlay cleared, syncError cleared).
- **AT-S4**: explicit `command.ack` (if added) clears the pending entry without mutating `tablesById`.

### 6.2 Transport tests (pure, mocked WebSocket)

To add:
- **AT-T1**: on `onopen`, transport sends one `{type:'subscribe',floorId,sinceSequence}` message.
- **AT-T2**: command sent before `OPEN` throws and pending command is rejected with the error message ([actions.ts:21-31](../../shire/apps/mobile/src/features/floor/actions.ts#L21-L31) already does this; lock it in).
- **AT-T3**: ping received → exactly one pong sent with the same timestamp.
- **AT-T4**: malformed payload → `onError` fires, store gets `setSyncError`, socket stays open.

### 6.3 Provider integration tests (RTL with `MockWebSocket`)

To add:
- **AT-P1 (golden path)**: mount provider → snapshot fetched → WS opens → connectionState transitions `idle → connecting → connected`.
- **AT-P2 (live update)**: server pushes `table.updated` for table 2 (sensed=occupied) → `useFloorTablesByRoom` reflects occupied within one tick.
- **AT-P3 (host command + ack)**: dispatch `seatWalkIn(2,...)` → table 2 immediately shows `isPending=true`, status=occupied (optimistic) → server emits `table.updated{commandId, source:'host'}` → `isPending=false`, party rendered.
- **AT-P4 (host command rejected)**: dispatch `blockTable(5)` → optimistic reserved → server emits `command.rejected{commandId, error.code:'TABLE_OCCUPIED'}` → table reverts, `syncError` shows "That table is already occupied."
- **AT-P5 (ML update during pending)**: with a host command pending on table 2, server emits `table.updated{source:'ml'}` for table 2 → table 2 updates, **pending entry stays** (host overlay preserved until matching host event).
- **AT-P6 (heartbeat)**: server emits `connection.ping{ts}` → client emits `connection.pong{ts}` within 100ms.
- **AT-P7 (drop + reconnect)**: socket close → connectionState='reconnecting' with backoff > 0 → next `connect()` re-opens, snapshot refetch tolerated, prior table state preserved from store cache until snapshot arrives.
- **AT-P8 (cursor resume — proposed)**: socket reopens, transport sends `subscribe{sinceSequence:N}`, server replays events `> N`, no snapshot HTTP call observed.
- **AT-P9 (cursor expired — proposed)**: server replies `cursor.expired` → snapshot HTTP call fires once, socket stays open, store updates.
- **AT-P10 (auth lost)**: `useAuth().session` becomes null → provider tears down socket and resets volatile state ([provider.tsx:62-67](../../shire/apps/mobile/src/features/floor/provider.tsx#L62-L67)).
- **AT-P11 (workday inactive)**: `isWorkdayActive=false` → provider does not open socket; turning it back on opens one without remount.
- **AT-P12 (no polling)**: across 2 minutes of mocked time with no events, exactly zero HTTP calls fire after the initial snapshot.

### 6.4 Visible UI assertions (host screen)

- **AT-U1**: while `connectionState='reconnecting'`, status chip in [shire/apps/mobile/src/app/(host)/index.tsx](../../shire/apps/mobile/src/app/(host)/index.tsx) shows "Reconnecting..." (or current copy) and seat-action buttons remain enabled but show pending if pressed.
- **AT-U2**: command pending → table tile in [components/Table.tsx] renders the pending dot/spinner; on ack disappears; on reject reverts and a toast/banner shows the friendly message.
- **AT-U3**: `mark_clean` / `mark_dirty` while disconnected → action returns `{ok:false}` with `syncError = 'Floor connection unavailable...'` ([actions.ts:14-17](../../shire/apps/mobile/src/features/floor/actions.ts#L14-L17)) — already in place.

---

## 7. What changed / what I did

### 7.1 Audit (pass 1)

Confirmed the existing realtime stack already covers most of the spec: snapshot bootstrap, sequence-gated replay, optimistic overlay with rollback, exponential-backoff reconnect, no polling, heartbeat, friendly rejection-message mapping.

### 7.2 Integration (pass 2 — landed)

Pure additive client changes. Backend can ignore the new messages without breaking existing behavior; existing flow stays unchanged until backend opts in.

| File | Change |
|---|---|
| [shared/types/table.ts](../../shire/packages/shared/src/types/table.ts) | `SubscribeFloorMessage.sinceSequence?: number`; new `CursorExpiredMessage` and `CommandAckMessage`; both added to `FloorStreamMessage` and `BackendFloorStreamMessage`. |
| [floor/transport.ts](../../shire/apps/mobile/src/features/floor/transport.ts) | New `sendSubscribe(sinceSequence)` method — emits `{type:'subscribe', floorId, sinceSequence?}`. |
| [floor/state.ts](../../shire/apps/mobile/src/features/floor/state.ts) | New `acknowledgePendingCommandState` helper. `applyFloorStreamMessageState` now handles `command.ack` (drops the matching pending entry without mutating `tablesById`) and `cursor.expired` (reducer no-op; provider handles the side-effect). |
| [floor/contracts.ts](../../shire/apps/mobile/src/features/floor/contracts.ts) | `adaptRealtimeMessage` now narrows `command.ack` and `cursor.expired` payloads. |
| [floor/provider.tsx](../../shire/apps/mobile/src/features/floor/provider.tsx) | On socket open: emits `subscribe` carrying the persisted `lastAppliedSequence`. On `cursor.expired`: calls `loadSnapshot()` without dropping the socket. On `command.ack`: confirms the pending seat overlay (mirroring the `table.updated{commandId}` path). |
| [floor/__tests__/state.test.ts](../../shire/apps/mobile/src/features/floor/__tests__/state.test.ts) | Added: `command.ack` clears pending entry without mutating tables; `command.ack` for a different floor is ignored; `cursor.expired` is a reducer no-op. |

Out of scope on purpose (kept for a follow-up once backend confirms protocol):

- Removing the unconditional `loadSnapshot()` call from `connect()` in favour of pure cursor-resume on reconnect. Today the client still HTTP-fetches on every connect; the new `subscribe{sinceSequence}` lets the backend skip the duplicate replay when it's ready, but the client still has the snapshot as a safety net.
- Transport / provider integration tests (Section 6.2 / 6.3). Reducer-level tests for the new events are in.
- Recommendations event — still derived client-side; no behavior change pending product decision.

### 7.3 Verification

- `npx tsc --noEmit` → exit 0.
- `npx jest` → 52/52 tests pass (3 new).
- `npx eslint` on touched files → clean (the 6 remaining errors in `contracts.ts` / `provider.tsx` are pre-existing prettier issues outside the diff range).

---

## 8. Open questions for ML / backend

Need answers before changing client code:

1. **Subscribe message shape.** Will the backend accept `{ type: 'subscribe', floorId, sinceSequence }` on the existing `/ws/locations/:locationId/floors/:floorId` endpoint? Or is the subscription strictly URL-derived today? If the latter, where does cursor live in the path/query?
2. **Restaurant vs location.** Spec uses `restaurant_id`; mobile uses `locationId` (the multi-tenant scope) plus `floorId` (a floor inside the location). Are these 1:1, or should subscribe carry both?
3. **Cursor expiration.** What's the retention window for replay? When is a `sinceSequence` "too old"? Will the backend surface that explicitly (`cursor.expired`) or just respond with a fresh `floor.snapshot`? Either works for us — we just need to know which.
4. **Command ack semantics.** When the host sends an accepted no-op command (e.g. `mark_clean` on an already-clean table), does the backend always emit a `table.updated{commandId}`? If not, can it emit `command.ack{commandId}` instead so we can clear the optimistic overlay?
5. **Recommendations.** Spec says ML owns recommendations. Today the host derives quick-seat suggestions client-side from the snapshot via `useQuickSeatSuggestions`. Will ML push a `recommendations.updated` event with a ranked list, or is the derived list sufficient for v1?
6. **Heartbeat cadence + timeout.** What's the server ping interval? At what missed-pong count should the client force a reconnect? Today we have no client-side dead-peer detection — we rely on the socket's own close.
7. **Auth lifetime.** When the JWT expires mid-session, does the server close the socket with a specific code, or silently stop sending? The client currently has no token-refresh-on-WS path.
8. **ML vs host source labelling.** Today `source: 'host' | 'ml'` controls whether pending commands clear. Will all backend-originated state changes that aren't user-initiated be tagged `'ml'`? (e.g. POS-driven, sensor-driven, manager dashboard from another device.)

Let me know which of the above are settled and I'll wire the client changes + tests in a follow-up PR.
