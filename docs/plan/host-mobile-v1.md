# Shire Host Mobile v1 — Master Plan

**Scope:** Build a complete OpenTable-grade host iPad/phone app on top of the existing Shire backend. Covers a messaging inbox, message templates, waitlist notify, reservations archive/restore + calendar view, blackouts CRUD, a settings hub, and a documented CCTV/Supabase-Realtime contingency.

**Audience:**
- **Frontend (Shire mobile, this repo):** the implementation owner. Codex/Claude will execute the phases below; some tactical decisions are intentionally left to implementor discretion (flagged inline).
- **Backend:** contract reference (Section 2). Anything in Section 2 marked **NEW** or **CONFIRM** is a backend dependency that gates the corresponding frontend phase.

**Repo paths reference:**
- Mobile app root: `shire/apps/mobile`
- Shared types: `shire/packages/shared/src/types`
- Existing host docs: `docs/architecture/host-backend-contract.md`, `docs/architecture/host-mobile-reservations-contract.md`, `docs/architecture/realtime-floor-state.md`, `docs/architecture/realtime-floor-state-integration.md`
- Backend repo (sibling): `~/Documents/Restuarant_ML-Backend` (referenced for CCTV/Realtime decisions only)

---

## 0. Decisions Ledger

| # | Decision | Choice |
|---|---|---|
| Q1 | Build order | Phases A → E below; ordered for least-risk first. |
| Q2 | Table state transport | **Backend WS is canonical** for state + commands + linkage + ephemeral signals. Supabase Realtime is **not** built in v1 — kept as a future contingency if WS fails to scale on Railway. |
| Q3 | Inbox placement | **4th tab "Inbox"** with unread badge + inline message affordances from TablePopover, WaitlistCard, ReservationEditor (matches OpenTable's footer-icon pattern). |
| Q4 | iPad inbox layout | Adaptive: split-view on iPad landscape ≥900pt; stacked nav on portrait/phone. |
| Q5 | Inbox entry points | Tab **AND** inline buttons (single shared thread component). |
| Q6 | Polling cadence | List **15s** foreground / **30s** background. Open thread **5s** foreground. Refetch on tab focus + app foreground. Stop polling after **5min** background; refetch on resume. Hook abstracted for future push/SSE swap. |
| Q7 | Template interpolation | **Server-side** when sending via `templateId`/`templateKey`. Client renders preview for the composer; if host edits the preview, send the rendered `body` (no templateId). |
| Q8 | Composer send | **Optimistic.** Append local pending with `status: 'queued'`, replace with returned `message`, mark `failed` with retry on error. |
| Q9 | Waitlist notify UX | Primary "Notify ready" one-tap (uses `waitlist_notify` seeded default). "⋯" opens sheet with alternate templates, freeform body, and internal note. |
| Q10 | Inbox filters | Segmented control: **All** / **Unread** / **Waitlist** / **Reservations** / **Archived**. Search bar above. |
| Q11 | Delivery error rendering | **Inline badge under the message bubble** with `errorMessage` + Retry for `failed`/`not_sent`. No retry for `opted_out`. No toast. |
| Q12 | Push notifications | **Deferred to v2.** v1 = foreground polling + tab badge. Plan v2 hook clearly. In-app haptic on inbound while foregrounded is OK if cheap. |
| Q13 | Reservation archive UX | Swipe-to-archive on terminal-status rows + Archive button in ReservationEditor footer when status terminal. Sheet captures optional `reason`. No affordance for non-terminal rows. |
| Q14 | Show archived | "Show archived" toggle in reservation list header. Archived rows dimmed with pill + Restore action. |
| Q15 | Blackouts + Settings | New **Settings hub** opened from a gear icon in the host header (modal stack, mirrors `reservation-modal`). Sections: Blackouts, Message templates, Reservation settings, Floor builder entry, Sign out / switch location. |
| Q16 | Reservations date scoping | **Calendar view** with month density dots. Needs backend density endpoint (see §2.7). Tapping a date pushes day-book. |
| Q17 | Realtime migration safety | N/A — Realtime not built in v1. Captured as a contingency-only block in §2.8. |
| Q18 | WS event handling | Unchanged from today. WS owns canonical state. |
| Q19 | Linkage fields | WS owns linkage (`currentReservationId`, `currentWaitlistEntryId`). |
| Q20 | Handoff docs | **Consolidated into this single plan.** Backend reads §2. |
| Q21 | Routing structure | Inbox under `(host)/inbox`. Settings under root `/settings` modal stack. Reservations becomes a folder with calendar `index` + day-book `[date]`. |
| Q22 | State management | React Query for server cache + mutations. Zustand for ephemeral UI (composer drafts). |
| Q23 | Shared types | Add to `@shire/shared/types/`: `message.ts`, `messageTemplate.ts`, `blackout.ts`. Extend `reservation.ts` with archive fields. Implementor discretion on internal organization. |
| Q24 | Test scope | Parity with existing modules: `contracts.test.ts`, `api.test.ts`, store tests where stores exist. No E2E in v1. |
| FU1 | Push v1 | Deferred (see Q12). |
| FU2 | Composer to arbitrary phone | Allowed. The `messages/send` endpoint accepts `phone` directly. Composer "New conversation" flow lets the host paste an E.164 number. |
| FU3 | Background polling cap | Stop polling after 5min background. Refetch on app foreground. |
| FU4 | Unknown guest treatment | Show `phoneLast4` on conversation cards; full E.164 in thread header. When `guestId === null`, display name = "Unknown" or the phone last4. |

---

## 1. Backend Contract

**Reading guide for backend:** anything marked **NEW** must be implemented before the phase that depends on it can ship. Anything marked **CONFIRM** already exists per the handoff doc but the frontend wants explicit confirmation of payload shape. **EXTEND** = existing endpoint needs a field/param added.

Global rules (already in place):
- Base URL: `https://web-production-5c5b4.up.railway.app/api/v1` (production). Mobile reads from `EXPO_PUBLIC_API_URL` and auto-prefixes `/api/v1`.
- Auth: `Authorization: Bearer <supabase_jwt>` on every host route.
- All REST request/response fields are `camelCase`.
- `locationId` is the restaurant id.
- Floor WebSocket: `wss://web-production-5c5b4.up.railway.app/ws/locations/{locationId}/floors/{floorId}?access_token=<jwt>`.

### 1.1 Identity & Bootstrap (CONFIRM)

Frontend uses these on startup:

```
GET /api/v1/me
GET /api/v1/me/locations
GET /api/v1/locations/{locationId}/bootstrap
GET /api/v1/locations/{locationId}/floors/{floorId}/snapshot
```

No changes needed. Confirm `bootstrap` returns `{ session, location, floorId, floorMap }`.

### 1.2 Reservations (mix: existing + NEW archive/restore)

Existing (CONFIRM):

```
GET    /api/v1/locations/{locationId}/reservations?date=YYYY-MM-DD&status=&search=&includeArchived=false
POST   /api/v1/locations/{locationId}/reservations
PATCH  /api/v1/locations/{locationId}/reservations/{reservationId}
POST   /api/v1/locations/{locationId}/reservations/{reservationId}/actions/{action}
GET    /api/v1/locations/{locationId}/availability
GET    /api/v1/locations/{locationId}/reservation-settings
```

Supported actions include the existing canonical statuses plus `arrive` (backend may return `checked_in`).

**EXTEND** every reservation response to include:

```json
{
  "archivedAt": "datetime|null",
  "archivedByUserId": "string|null",
  "archiveReason": "string|null"
}
```

**NEW**:

```
POST /api/v1/locations/{locationId}/reservations/{reservationId}/archive
POST /api/v1/locations/{locationId}/reservations/{reservationId}/restore
```

Archive request body:

```json
{ "reason": "duplicate cleanup (optional)" }
```

Both return the full canonical reservation payload.

Archive rules (backend enforces):
- Only `completed`, `canceled`, `no_show` reservations are archivable.
- Active reservations must be canceled first.
- Default `GET /reservations` lists hide archived rows; `?includeArchived=true` shows them.
- Archive/restore emit `reservation.updated` (or equivalent `table.updated` payload when relevant) over the floor WS.

### 1.3 Reservation Density (NEW — gates Phase C calendar)

```
GET /api/v1/locations/{locationId}/reservations/density?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&includeArchived=false
```

Response:

```json
{
  "dateFrom": "2026-05-01",
  "dateTo": "2026-05-31",
  "days": [
    {
      "date": "2026-05-15",
      "reservationCount": 14,
      "coversTotal": 38,
      "hasBlackout": false,
      "status": {
        "booked": 5,
        "confirmed": 4,
        "checkedIn": 2,
        "seated": 2,
        "completed": 1,
        "canceled": 0,
        "noShow": 0
      }
    }
  ]
}
```

Rules:
- Cap at **62 days** per request; reject larger with `VALIDATION_ERROR`.
- Honor `includeArchived` (default false).
- `date` strings are in the location's timezone.
- `coversTotal` = sum of `partySize` for non-canceled, non-noShow reservations that day.
- `hasBlackout` is true if any active blackout overlaps that calendar day.

Acceptable fallback (only if dedicated endpoint blocks shipping): extend `GET /reservations` to accept `?dateFrom=&dateTo=`; frontend will bucket client-side. **Strictly less preferred** because of payload size.

### 1.4 Blackouts (NEW for archive/restore + CONFIRM the rest)

```
GET    /api/v1/locations/{locationId}/reservation-blackouts?includeArchived=false
POST   /api/v1/locations/{locationId}/reservation-blackouts
PATCH  /api/v1/locations/{locationId}/reservation-blackouts/{blackoutId}
POST   /api/v1/locations/{locationId}/reservation-blackouts/{blackoutId}/archive    NEW
POST   /api/v1/locations/{locationId}/reservation-blackouts/{blackoutId}/restore    NEW
```

Archive request body:

```json
{ "reason": "old private event (optional)" }
```

**EXTEND** every blackout response to include:

```json
{
  "archivedAt": "datetime|null",
  "archivedByUserId": "string|null",
  "archiveReason": "string|null"
}
```

Rules:
- Archive sets blackout inactive (no longer blocks availability).
- Restore reactivates.
- Default list hides archived; `?includeArchived=true` shows them.
- No recurring blackouts in v1 (single date or date range only). If backend already supports recurrence, frontend will not expose it in v1 — feel free to leave the field.

Frontend expects each blackout to carry at minimum:

```json
{
  "id": "uuid",
  "locationId": "uuid",
  "name": "Wedding rehearsal — Smith party",
  "startsAt": "2026-05-20T17:00:00Z",
  "endsAt": "2026-05-20T22:00:00Z",
  "allDay": false,
  "reason": "private event (optional, internal)",
  "active": true,
  "createdAt": "...",
  "updatedAt": "...",
  "archivedAt": "datetime|null",
  "archivedByUserId": "string|null",
  "archiveReason": "string|null"
}
```

### 1.5 Messaging (NEW)

#### Conversations list

```
GET /api/v1/locations/{locationId}/messages/conversations?limit=50&search=&includeArchived=false
```

Response:

```json
{
  "conversations": [
    {
      "id": "uuid",
      "guestId": "uuid|null",
      "displayName": "Taylor Guest",
      "phoneE164": "+15551212112",
      "phoneLast4": "1212",
      "activeReservationId": "uuid|null",
      "activeWaitlistId": "uuid|null",
      "lastMessagePreview": "Your table is ready",
      "lastMessageAt": "2026-05-15T...",
      "unreadCount": 2,
      "archivedAt": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

#### Conversation detail

```
GET /api/v1/locations/{locationId}/messages/conversations/{conversationId}?limit=100
```

Response:

```json
{
  "conversation": { "...": "same shape as list" },
  "messages": [
    {
      "id": "uuid",
      "conversationId": "uuid",
      "guestId": "uuid|null",
      "reservationId": "uuid|null",
      "waitlistId": "uuid|null",
      "direction": "inbound|outbound",
      "channel": "sms",
      "body": "text",
      "templateId": "uuid|null",
      "templateKey": "waitlist_ready|null",
      "status": "queued|sent|delivered|read|received|failed|not_sent|opted_out",
      "provider": "sendblue|twilio|null",
      "providerMessageId": "string|null",
      "errorMessage": "string|null",
      "actorUserId": "host-user|null",
      "readAt": "datetime|null",
      "sentAt": "datetime|null",
      "deliveredAt": "datetime|null",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

#### Send

```
POST /api/v1/locations/{locationId}/messages/send
```

Body: exactly **one** of `conversationId | reservationId | waitlistId | guestId | phone` plus exactly one of `templateId | templateKey | body` (or `body` alongside a template for editable preview override).

```json
{
  "conversationId": "uuid optional",
  "reservationId": "uuid optional",
  "waitlistId": "uuid optional",
  "guestId": "uuid optional",
  "phone": "+15551212112 optional",
  "templateId": "uuid optional",
  "templateKey": "waitlist_ready optional",
  "body": "Freeform host text optional"
}
```

Response:

```json
{
  "conversation": { "...": "conversation" },
  "message": { "...": "message" }
}
```

If the SMS provider rejects delivery, the request **still succeeds** with `message.status` of `not_sent` / `failed` / `opted_out` and `message.errorMessage` populated. The frontend renders this inline (Q11).

#### Mark read

```
POST /api/v1/locations/{locationId}/messages/conversations/{conversationId}/read
```

Response:

```json
{ "conversationId": "uuid", "unreadCount": 0 }
```

#### Backend confirmations needed

- [ ] Confirm `messageDelivery` field on reservations is fully removed/deprecated — the older `host-mobile-reservations-contract.md` said the mobile app should not depend on it. The new contract above supersedes that line.
- [ ] Confirm message status values: do `received`, `read`, `delivered` ever flow back without provider support? Mobile treats unknown values as `sent` for badge rendering.
- [ ] Confirm "send to arbitrary phone" is allowed — the host composer offers a "New conversation" flow that paste-accepts an E.164.

### 1.6 Message Templates (NEW)

```
GET   /api/v1/locations/{locationId}/message-templates
POST  /api/v1/locations/{locationId}/message-templates
PATCH /api/v1/locations/{locationId}/message-templates/{templateId}
```

Backend seeds defaults on first GET. Template shape:

```json
{
  "id": "uuid",
  "key": "waitlist_notify",
  "name": "Waitlist notify",
  "category": "waitlist|reservation|host",
  "body": "{restaurantName}: Your table is ready.",
  "channel": "sms",
  "active": true,
  "systemDefault": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

Create body:

```json
{
  "key": "custom_late_table",
  "name": "Late table apology",
  "category": "host",
  "body": "Sorry for the delay, we will text you as soon as your table is ready.",
  "channel": "sms",
  "active": true
}
```

Patch body (any subset):

```json
{
  "name": "Updated name",
  "category": "waitlist",
  "body": "Updated body",
  "active": true
}
```

Supported placeholders (server-side interpolation when sending via `templateId`/`templateKey`):
- `{restaurantName}`
- `{partySize}`
- `{reservationLabel}`
- `{messageBody}`

Frontend renders the same placeholders for preview purposes only.

#### Backend confirmations

- [ ] Document what each placeholder resolves to and when (`{partySize}` from active reservation? waitlist entry? both?).
- [ ] Confirm that PATCH `body` re-renders preview correctly without re-saving placeholder-as-literal.
- [ ] Are `systemDefault` templates deletable / archivable? Frontend assumes **no**: hides destructive actions on system defaults.
- [ ] Confirm `key` uniqueness scope (per location? global?). Frontend assumes per-location.

### 1.7 Waitlist Notify (NEW action endpoint)

```
POST /api/v1/locations/{locationId}/waitlist/{entryId}/actions/notify
```

Body:

```json
{
  "templateId": "uuid optional",
  "templateKey": "waitlist_ready optional",
  "messageBody": "Freeform text optional",
  "notes": "Internal/action note optional",
  "commandId": "client-id optional"
}
```

Default template if none provided: **`waitlist_notify`** (seeded).

Response: updated `HostWaitlistEntry`.

Side effects:
- Sets `notifiedAt` on the waitlist entry.
- Emits `waitlist.updated` on the floor WS.
- The actual SMS row appears in the messaging thread for that guest (queryable via the messaging endpoints above).

### 1.8 Realtime — Backend WS (CONFIRM)

Frontend uses the existing floor WS at:

```
wss://web-production-5c5b4.up.railway.app/ws/locations/{locationId}/floors/{floorId}?access_token=<jwt>
```

WS carries (no v1 changes):
- `table.updated` / `table.batch_updated` with canonical state (`state`, `state_confidence`, `state_updated_at`) **plus linkage** (`currentVisitId`, `currentReservationId`, `currentWaitlistEntryId`) and `commandId` for command ack.
- `reservation.updated` (preferred) carrying full reservation payload after create/edit/seat/archive.
- `waitlist.updated` after CRUD or notify.
- Ephemeral signals: `camera.offline`, `camera.online`, `ml.low_confidence`, `frame.stale`, `host.alert`, `floor.alert`. These do **not** mutate canonical table state in the frontend store.

**No** WS event for messaging in v1. Frontend polls (Q6).

#### Backend confirmations / risks

- [ ] **Multi-instance Railway risk:** if backend ever scales to >1 instance, the in-memory WS broadcast misses clients on other instances unless backend adds shared pub/sub (Redis / Supabase Realtime broadcast / etc). Please confirm current instance count and document the scale-out plan.
- [ ] Confirm WS reconnect token refresh: frontend's axios refreshes on 401; WS uses query-string `access_token` — does the WS server accept a re-handshake when the old token expires?

### 1.9 CCTV / Supabase Realtime (CONTINGENCY — NOT shipped in v1)

The repo already has `docs/architecture/realtime-floor-state.md` and the sibling backend has `HOST_CCTV_TABLE_STATE_HANDOFF.md`, `REALTIME_TABLE_STATE_LAYER.md`, and migration `0024_host_tables_realtime_rls.sql`. v1 deliberately does **not** consume Supabase Realtime — backend WS is canonical.

**Triggers that would make us turn it on later:**
- Backend goes multi-instance without shared pub/sub.
- WS proves unreliable on lossy mobile networks.
- Backend wants a single source of canonical state outside the WS process.

When that day comes, this section becomes a separate plan. v1 is silent on it.

### 1.10 Out of scope for backend in v1

- Push notifications / FCM-APNs message routing (deferred per Q12).
- Recurring blackouts.
- WS event for messaging.
- Supabase Realtime publication on `tables` (contingency only).
- Conversation archive endpoint — backend list supports `includeArchived` but no `archive` mutation is required for v1 (the Archived filter just shows what backend marks archived via internal logic, if any).

### 1.11 Error envelope (CONFIRM)

All endpoints use:

```json
{
  "detail": {
    "code": "NOT_FOUND|VALIDATION_ERROR|PERMISSION_DENIED|INVALID_STATUS|...",
    "message": "Human readable message"
  }
}
```

Send failures are NOT this — they return `200` with `message.status` reflecting the failure.

### 1.12 Backend checklist (single list)

- [ ] EXTEND reservation payload with `archivedAt`, `archivedByUserId`, `archiveReason`.
- [ ] NEW: `POST /reservations/{id}/archive`, `POST /reservations/{id}/restore`.
- [ ] NEW: `GET /reservations/density?dateFrom=&dateTo=&includeArchived=`.
- [ ] EXTEND blackout payload with `archivedAt`, `archivedByUserId`, `archiveReason`.
- [ ] NEW: `POST /reservation-blackouts/{id}/archive`, `POST /reservation-blackouts/{id}/restore`.
- [ ] NEW: messaging endpoints in §1.5.
- [ ] NEW: template endpoints in §1.6.
- [ ] NEW: waitlist notify action in §1.7.
- [ ] CONFIRM WS payloads carry linkage fields.
- [ ] CONFIRM single-instance assumption or document scale-out.
- [ ] Confirm/remove the deprecated `messageDelivery` reference in `docs/architecture/host-mobile-reservations-contract.md` line 203–204.

---

## 2. Frontend Architecture

### 2.1 State ownership

| Concern | Lives in | Notes |
|---|---|---|
| Server data (conversations, threads, templates, reservations, blackouts) | **React Query** | Query keys in §2.5. |
| Floor table state, pending commands, sync errors | **Zustand** (`features/floor/store`) | Existing. Backend WS = canonical writer. |
| Auth session, current location, hydration flag | **Zustand** (`features/auth/store`) | Existing. |
| Workday | **Zustand** (`features/workday/store`) | Existing. |
| Composer drafts (per-thread) | **Zustand** (new: `features/messaging/composerStore`) | Persists draft text across thread switches; cleared on send success. |
| Unread count badge | **Selector over React Query** | `sum(conversations[].unreadCount)`. No separate store. |
| Settings hub navigation state | **Local component state** | No persistence. |

### 2.2 Transport

- HTTP via `apiClient` (`shire/apps/mobile/src/services/api/client.ts`) — already attaches Supabase JWT + refreshes on 401.
- Floor WS via existing `FloorRealtimeProvider` / `features/floor/transport` — no changes in v1.
- Supabase client via `services/supabase/client.ts` — auth only in v1.

### 2.3 Routing / file tree

New structure (additions in **bold**):

```
shire/apps/mobile/src/app/
├── _layout.tsx                                  (extend Stack with /settings)
├── (auth)/...                                   (unchanged)
├── (host)/
│   ├── _layout.tsx                              (extend NativeTabs to add Inbox; add gear icon in header)
│   ├── index.tsx                                (floor plan, unchanged)
│   ├── waitlist.tsx                             (edit: WaitlistCard gets Notify button)
│   ├── seat.tsx                                 (unchanged)
│   ├── reservations/                            (CONVERT from .tsx to folder)
│   │   ├── _layout.tsx                          (Stack)
│   │   ├── index.tsx                            (Calendar view — month density)
│   │   └── [date].tsx                           (Day book — existing reservations.tsx body)
│   └── inbox/                                   NEW
│       ├── _layout.tsx                          (Stack with adaptive split-view)
│       ├── index.tsx                            (Conversation list + filters + search)
│       ├── [conversationId].tsx                 (Thread + composer)
│       └── new.tsx                              (New conversation: phone E.164 paste)
├── reservation-modal/...                        (unchanged)
├── workday.tsx                                  (unchanged)
├── shift/...                                    (unchanged)
├── floor-builder/...                            (unchanged)
└── settings/                                    NEW (mirrors reservation-modal pattern)
    ├── _layout.tsx                              (Stack, fullScreenModal at root)
    ├── index.tsx                                (Settings hub home)
    ├── blackouts/
    │   ├── index.tsx                            (List + archived toggle)
    │   ├── new.tsx                              (Create blackout)
    │   └── [id].tsx                             (Edit + archive)
    ├── templates/
    │   ├── index.tsx                            (List by category)
    │   ├── new.tsx                              (Create template)
    │   └── [id].tsx                             (Edit / activate / deactivate)
    └── reservation-settings/
        └── index.tsx                            (Read-only view for v1)
```

Root layout (`src/app/_layout.tsx`) gets a new `Stack.Screen name="settings"` with `presentation: 'fullScreenModal'`.

### 2.4 Type contracts (`@shire/shared`)

New files in `shire/packages/shared/src/types/`:

#### `message.ts`

```ts
export type MessageDirection = 'inbound' | 'outbound';
export type MessageChannel = 'sms';
export type MessageProvider = 'sendblue' | 'twilio' | null;
export type MessageStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'received'
  | 'failed'
  | 'not_sent'
  | 'opted_out';

export interface Conversation {
  id: string;
  guestId: string | null;
  displayName: string;
  phoneE164: string;
  phoneLast4: string;
  activeReservationId: string | null;
  activeWaitlistId: string | null;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  guestId: string | null;
  reservationId: string | null;
  waitlistId: string | null;
  direction: MessageDirection;
  channel: MessageChannel;
  body: string;
  templateId: string | null;
  templateKey: string | null;
  status: MessageStatus;
  provider: MessageProvider;
  providerMessageId: string | null;
  errorMessage: string | null;
  actorUserId: string | null;
  readAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageRequest {
  conversationId?: string;
  reservationId?: string;
  waitlistId?: string;
  guestId?: string;
  phone?: string;
  templateId?: string;
  templateKey?: string;
  body?: string;
}

export interface SendMessageResponse {
  conversation: Conversation;
  message: Message;
}
```

#### `messageTemplate.ts`

```ts
export type MessageTemplateCategory = 'waitlist' | 'reservation' | 'host';

export interface MessageTemplate {
  id: string;
  key: string;
  name: string;
  category: MessageTemplateCategory;
  body: string;
  channel: 'sms';
  active: boolean;
  systemDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageTemplateRequest {
  key: string;
  name: string;
  category: MessageTemplateCategory;
  body: string;
  channel?: 'sms';
  active?: boolean;
}

export type UpdateMessageTemplateRequest = Partial<
  Pick<MessageTemplate, 'name' | 'category' | 'body' | 'active'>
>;
```

#### `blackout.ts`

```ts
export interface ReservationBlackout {
  id: string;
  locationId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  archivedByUserId: string | null;
  archiveReason: string | null;
}

export interface CreateBlackoutRequest {
  name: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  reason?: string;
  active?: boolean;
}

export type UpdateBlackoutRequest = Partial<CreateBlackoutRequest>;
export interface ArchiveBlackoutRequest { reason?: string }
```

#### Extend `reservation.ts`

Add to the existing reservation interface:

```ts
archivedAt: string | null;
archivedByUserId: string | null;
archiveReason: string | null;
```

Plus an `ArchiveReservationRequest = { reason?: string }`.

#### Reservation density (new type, lives in `reservation.ts`)

```ts
export interface ReservationDensityDay {
  date: string;
  reservationCount: number;
  coversTotal: number;
  hasBlackout: boolean;
  status: {
    booked: number;
    confirmed: number;
    checkedIn: number;
    seated: number;
    completed: number;
    canceled: number;
    noShow: number;
  };
}

export interface ReservationDensityResponse {
  dateFrom: string;
  dateTo: string;
  days: ReservationDensityDay[];
}
```

#### Re-exports

Add all of the above to `shire/packages/shared/src/types/index.ts`.

> Codex discretion: organize sub-types (request/response wrappers) however reads cleanest. Add `assertExhaustive` helpers if useful for `MessageStatus` switch handlers. Keep DTO shapes verbatim with the backend — adapter functions in feature modules convert DTO ↔ view model.

### 2.5 React Query keys

Centralize in `shire/apps/mobile/src/services/api/queryKeys.ts` (existing file — extend):

```ts
export const queryKeys = {
  // ...existing keys
  messaging: {
    conversations: (locationId: string, filters?: { search?: string; includeArchived?: boolean }) =>
      ['messaging', 'conversations', locationId, filters] as const,
    conversation: (locationId: string, conversationId: string) =>
      ['messaging', 'conversation', locationId, conversationId] as const,
    templates: (locationId: string) =>
      ['messaging', 'templates', locationId] as const,
  },
  blackouts: {
    list: (locationId: string, includeArchived: boolean) =>
      ['blackouts', locationId, { includeArchived }] as const,
    detail: (locationId: string, blackoutId: string) =>
      ['blackouts', locationId, blackoutId] as const,
  },
  reservations: {
    // existing
    density: (locationId: string, dateFrom: string, dateTo: string, includeArchived: boolean) =>
      ['reservations', 'density', locationId, dateFrom, dateTo, { includeArchived }] as const,
  },
};
```

### 2.6 Polling cadence

Wrap `useQuery` calls in a small `usePolling(query, { foregroundMs, backgroundMs })` helper at `shire/apps/mobile/src/lib/usePolling.ts`:

- Tracks `AppState` (`active` vs `background`/`inactive`).
- Tracks tab focus (Expo Router `useFocusEffect`).
- Refetches on `AppState` → `active`.
- Sets `refetchInterval` per state.
- After 5min in `background`, sets `refetchInterval: false` (stops polling).
- Inbox list: `{ foregroundMs: 15_000, backgroundMs: 30_000 }`.
- Thread detail: `{ foregroundMs: 5_000, backgroundMs: 30_000 }` (only when the thread route is focused).
- Templates list: no polling — refetch on tab focus only.
- Conversations list also refetches **after every successful send** and **after mark-read**.

The helper is the one swap point for future push/SSE — replacing it with event-driven invalidation later does not touch screen code.

### 2.7 Design system + dark mode + iPad adaptive

- All colors via `useTheme()` per `CLAUDE.md`. New screens must obey light/dark.
- Spacing/typography tokens from `src/theme/*` only.
- No `BlurView` from `expo-blur`. Use `GlassSurface`.
- iPad adaptive breakpoint: width ≥ **900pt** = split-view. Helper: `src/lib/useAdaptiveLayout.ts` (new) returning `'split' | 'stack'`. Wraps `useWindowDimensions`. Used by Inbox primarily, available to anyone.
- Status colors stay: available (green), occupied (blue), dirty (red), reserved (orange).

### 2.8 Inbox iPad split-view mechanics

- `(host)/inbox/_layout.tsx` reads `useAdaptiveLayout()`.
- On `'split'`: render a horizontal `View` with the list (fixed ~360pt left) and an `<Outlet/>`-equivalent right pane. Tapping a conversation `router.push`es `[conversationId]` and keeps the list visible.
- On `'stack'`: standard `Stack` push.
- Selected-conversation highlight on the left pane in both modes (only visible in split).

### 2.9 Error / empty / loading conventions

- **Loading**: top-of-list spinner overlay over skeleton rows. Existing pattern in `WaitlistCard`/`ReservationCard` — reuse skeleton shapes.
- **Empty**: centered icon + headline + sub + primary CTA. Example: Inbox empty → "No messages yet" / "Start a conversation" / button → `inbox/new`.
- **Error**: inline error banner at top of screen with "Try again" button. Domain error `code` mapped via `features/host/errors.ts` (existing) — extend with messaging codes.

---

## 3. Phased Plan

Each phase has: Goal · Backend deps · Files to add/edit · Tasks · Definition of done.

### Phase A — Foundations (no UI surface yet)

**Goal:** types, query keys, helpers, settings hub shell. Lays groundwork without breaking anything.

**Backend deps:** None.

**Files**
- `shire/packages/shared/src/types/message.ts` (NEW)
- `shire/packages/shared/src/types/messageTemplate.ts` (NEW)
- `shire/packages/shared/src/types/blackout.ts` (NEW)
- `shire/packages/shared/src/types/reservation.ts` (EDIT: archive fields + density types)
- `shire/packages/shared/src/types/index.ts` (EDIT: re-exports)
- `shire/apps/mobile/src/lib/useAdaptiveLayout.ts` (NEW)
- `shire/apps/mobile/src/lib/usePolling.ts` (NEW)
- `shire/apps/mobile/src/services/api/queryKeys.ts` (EDIT: add `messaging`, `blackouts`, `reservations.density` keys)
- `shire/apps/mobile/src/features/host/errors.ts` (EDIT: add messaging codes)
- `shire/apps/mobile/src/app/_layout.tsx` (EDIT: register `settings` stack screen with `presentation: 'fullScreenModal'`)
- `shire/apps/mobile/src/app/settings/_layout.tsx` (NEW)
- `shire/apps/mobile/src/app/settings/index.tsx` (NEW — placeholder hub: blackouts / templates / reservation settings / floor builder / sign out)
- `shire/apps/mobile/src/app/(host)/_layout.tsx` (EDIT: header right gear icon → `router.push('/settings')`)

**Tasks**
1. Add types, run `tsc --noEmit` from `shire/apps/mobile` and the shared package.
2. Add helpers, with unit tests where useful (`usePolling.test.ts` for AppState transitions).
3. Wire the gear icon and Settings hub home screen. Each section row stub-links to its sub-screen (which won't exist yet — phases B–D add them).
4. Verify no existing screen regresses (Floor, Queue, Seat, Reservations day-book still work).

**DoD**
- `pnpm typecheck` (or `npm run typecheck`) clean.
- `pnpm test` (jest) green.
- Gear icon visible on iPad + phone; tapping opens an empty settings hub modal.

### Phase B — Messaging Inbox + Templates + Waitlist Notify

**Goal:** ship the new high-value surface end-to-end. Inbox tab, threads, composer, templates settings, inline notify on waitlist.

**Backend deps (must be live before this phase ships):**
- §1.5 messaging endpoints.
- §1.6 templates endpoints.
- §1.7 waitlist notify action.

**Files**

Feature module: `shire/apps/mobile/src/features/messaging/`
- `api.ts` — axios calls for conversations list, conversation detail, send, mark-read, templates list, create template, update template.
- `contracts.ts` — DTO ↔ view-model adapters; tests in `contracts.test.ts`.
- `hooks.ts` — React Query hooks: `useConversations`, `useConversation`, `useTemplates`, `useSendMessage` (mutation with optimistic update), `useMarkRead`, `useCreateTemplate`, `useUpdateTemplate`, `useWaitlistNotify`.
- `composerStore.ts` — Zustand store mapping `conversationId → draftText`.
- `templateRenderer.ts` — pure function `renderPreview(template, context) → string`. Substitutes `{restaurantName}`, `{partySize}`, `{reservationLabel}`, `{messageBody}` for client-side preview only.
- `unreadSelectors.ts` — selectors deriving total unread + per-conversation unread from React Query cache.
- Tests: `api.test.ts`, `contracts.test.ts`, `templateRenderer.test.ts`, `composerStore.test.ts`.

Routes:
- `shire/apps/mobile/src/app/(host)/_layout.tsx` (EDIT: add Inbox `NativeTabs.Trigger` with unread badge bound to `useTotalUnread()`).
- `shire/apps/mobile/src/app/(host)/inbox/_layout.tsx` (NEW: adaptive split or stack).
- `shire/apps/mobile/src/app/(host)/inbox/index.tsx` (NEW: list + filters + search + new-conversation button).
- `shire/apps/mobile/src/app/(host)/inbox/[conversationId].tsx` (NEW: thread + composer).
- `shire/apps/mobile/src/app/(host)/inbox/new.tsx` (NEW: paste E.164 → send first message → push to conversation).
- `shire/apps/mobile/src/app/settings/templates/index.tsx` (NEW).
- `shire/apps/mobile/src/app/settings/templates/new.tsx` (NEW).
- `shire/apps/mobile/src/app/settings/templates/[id].tsx` (NEW).

Components: `shire/apps/mobile/src/components/`
- `ConversationListItem.tsx` (NEW) — row with avatar/initials, displayName or `phoneLast4`, last message preview, unread badge, timestamp.
- `InboxFilters.tsx` (NEW) — segmented control: All / Unread / Waitlist / Reservations / Archived.
- `MessageBubble.tsx` (NEW) — inbound vs outbound styling; renders inline delivery error badge + retry button.
- `Composer.tsx` (NEW) — multiline input, template picker bottom sheet, send button. Reads/writes `composerStore`.
- `TemplatePickerSheet.tsx` (NEW) — modal sheet listing active templates by category; preview rendered via `renderPreview`.
- `TemplateForm.tsx` (NEW) — used by templates/new + templates/[id].
- Edit `WaitlistCard.tsx` — add primary "Notify ready" button + "⋯" overflow opening `WaitlistNotifySheet`.
- `WaitlistNotifySheet.tsx` (NEW) — template chooser + freeform body + internal note + send.
- Edit `TablePopover.tsx` — add "Message guest" row that links to the thread for the current visit's guest (deep-links into inbox).
- Edit `ReservationEditor.tsx` — add "Message guest" button in header / footer (same deep-link).

**Tasks (granular)**

1. **API + contracts** (`features/messaging/api.ts`, `contracts.ts`, tests). Mocked axios tests for happy + error paths (including `status: 'opted_out'` response).
2. **Hooks**:
   - `useConversations(locationId, filters)` — uses `usePolling` with 15s/30s.
   - `useConversation(locationId, conversationId)` — `usePolling` with 5s foreground only when route focused. Auto-fires `useMarkRead` on mount + when new inbound arrives.
   - `useSendMessage` — `useMutation`. On `mutate`: append optimistic message with `id = 'tmp_${uuid}'`, `status: 'queued'` to thread cache via `queryClient.setQueryData`. On `onSuccess`: replace optimistic by id. On `onError`: mark optimistic `status: 'failed'`, keep in cache. Invalidate conversations list (for badge / lastMessagePreview).
   - `useMarkRead` — POST endpoint; on success, update conversation in cache to `unreadCount: 0`.
3. **Composer behavior**:
   - Draft persisted to `composerStore` keyed by `conversationId`.
   - Sending with a `templateId` selected and unchanged preview → send `{ templateId }` only.
   - Sending with body edited → send `{ body }` only.
   - Retry on failed message: re-call `useSendMessage` with same payload, replace the failed optimistic in cache on success.
4. **Inbox list screen**:
   - Search input → debounced 300ms → updates query key.
   - Filters: All / Unread (`unreadCount > 0`) / Waitlist (`activeWaitlistId != null`) / Reservations (`activeReservationId != null`) / Archived (`?includeArchived=true`).
   - Right-edge "New" button → push `inbox/new`.
   - Empty / loading / error states per §2.9.
5. **Thread screen**:
   - Top bar: avatar + displayName + phone (full E.164) + `activeReservationId/activeWaitlistId` chips that deep-link.
   - List inverted (most recent at bottom). Auto-scrolls to bottom on new message.
   - Composer pinned to bottom with keyboard avoidance.
   - When `conversation.guestId == null`, show "Unknown guest" label and the phone last4 prominently; full E.164 in header.
6. **New conversation screen**:
   - Phone input that accepts E.164 only (validate `+` prefix + length).
   - Optional template pick or freeform body.
   - On send: navigate to returned `conversation.id`.
7. **Waitlist notify**:
   - `WaitlistCard` primary "Notify ready" button calls `useWaitlistNotify` with no extra params → backend uses `waitlist_notify` default → optimistic `notifiedAt` set in the waitlist cache.
   - Overflow opens `WaitlistNotifySheet`: template picker (filtered to category=waitlist), freeform body, internal note. Send via the same hook.
   - Toast on send + delivery-warning if returned `message.status` is non-success.
8. **Templates settings screens**:
   - List grouped by category. Inactive templates dim. `systemDefault` templates marked with a pill and lock destructive actions.
   - Create / edit form: name, key (locked on edit), category, body (multiline), active toggle. Preview pane below body shows `renderPreview` against a fake context.
9. **Tests**:
   - `api.test.ts`: happy path for each call; error envelope handling.
   - `contracts.test.ts`: DTO ↔ view-model.
   - `templateRenderer.test.ts`: placeholder substitution.
   - `composerStore.test.ts`: draft persists across thread switches.
   - One hook test verifying optimistic message append + rollback on error.

**DoD**
- Send + receive (via polling) verified against backend staging.
- Optimistic send shows queued bubble within 50ms.
- Failed send shows inline retry; retry replaces the failed bubble on success.
- Waitlist "Notify ready" one-tap sets `notifiedAt` and threads the message into the inbox.
- iPad split view: list on left, thread on right, deep links work.
- Phone stacked view: tapping a conversation pushes a screen.
- Unread badge on Inbox tab matches `sum(unreadCount)`.
- Templates list shows seeded defaults on first open of a clean account.

### Phase C — Reservations: Archive/Restore + Calendar

**Goal:** day-book becomes a date-pushed leaf of a calendar root. Terminal reservations gain archive/restore. "Show archived" toggle on the day-book.

**Backend deps:**
- §1.2 archive/restore endpoints + `archivedAt` etc.
- §1.3 density endpoint.

**Files**
- Move current `(host)/reservations.tsx` → `(host)/reservations/[date].tsx` (day-book body unchanged except for new toggle + archive affordances).
- New `(host)/reservations/index.tsx` (Calendar view).
- New `(host)/reservations/_layout.tsx` (Stack).
- `features/host/api.ts` (EDIT): add `archiveReservation`, `restoreReservation`, `fetchReservationDensity`.
- `features/host/reservationStore.ts` (EDIT if needed) or new `features/reservations/calendarStore.ts` for selected month state.
- `features/reservations/hooks.ts` (NEW): `useReservationDensity`, `useArchiveReservation`, `useRestoreReservation`.
- Components:
  - `ReservationCalendar.tsx` (NEW) — month grid with density dots, heat-shaded by status mix, blackout pill on days where `hasBlackout`.
  - `ReservationDateChip.tsx` (NEW) — header chip on day-book, jumps back to calendar / picks date.
  - Edit `ReservationCard.tsx` — swipe-to-archive on terminal rows; "Restore" swipe when archived.
  - Edit `ReservationEditor.tsx` — footer Archive button when status terminal; sheet collects optional reason.

**Tasks**
1. Add the density hook + calendar view. If backend density endpoint not yet live, fall back to a stub state: render empty dots and bypass density fetch (feature-flag `EXPO_PUBLIC_RESERVATIONS_DENSITY` defaulting to off; Codex enables once backend ships).
2. Calendar interactions: tap date → push `[date]`; left/right paginate month; today button. Match dark-mode tokens.
3. Day-book: add "Show archived" toggle. Wire `?includeArchived=true` into the existing list query. Archived rows render dimmed with pill.
4. Archive flow: swipe action triggers `useArchiveReservation` with optional reason sheet. Optimistic: remove from default list (or move to archived if toggle on). On error: revert + toast.
5. Restore flow: swipe action on archived row → `useRestoreReservation`. Optimistic: row un-dims and rejoins list if not archived view.
6. ReservationEditor: only show Archive button when status terminal. Tap → sheet with reason → submit → close editor.
7. Tests: api adapters, archive optimistic toggle, terminal-status gate.

**DoD**
- Calendar opens by default; tapping today's date jumps to current day-book.
- Density dots match backend counts on staging.
- Archive of a `completed` reservation removes it from default list; toggling archived shows it dimmed with Restore.
- Archive button is hidden on `booked`/`confirmed`/`checked_in`/`seated` reservations.

### Phase D — Blackouts CRUD + Settings polish

**Goal:** blackouts have a real surface, archive/restore parity with reservations, reservation settings is at least viewable.

**Backend deps:**
- §1.4 blackout archive/restore + payload extension.

**Files**
- `features/blackouts/api.ts` (NEW) — list, create, update, archive, restore.
- `features/blackouts/contracts.ts` (NEW) — DTO ↔ view-model (mostly pass-through but date-parsing helpers).
- `features/blackouts/hooks.ts` (NEW) — `useBlackouts`, `useCreateBlackout`, `useUpdateBlackout`, `useArchiveBlackout`, `useRestoreBlackout`.
- Routes: `settings/blackouts/index.tsx`, `new.tsx`, `[id].tsx`.
- Components: reuse Reservation-style archive sheet; new `BlackoutForm.tsx` (name, date range, all-day toggle, reason, active toggle).
- Reservation calendar uses `hasBlackout` already from §1.3; this phase just adds the surface to manage them.
- `settings/reservation-settings/index.tsx` (NEW) — pure read-only view of `/reservation-settings`. No mutation UI in v1.

**Tasks**
1. Blackouts list with "Show archived" toggle (same pattern as Reservations).
2. Create / edit / archive / restore flows mirror Reservation archive/restore behaviorally.
3. Validate `startsAt < endsAt`. If `allDay`, persist `startsAt = startOfDay`, `endsAt = endOfDay`.
4. Empty state: "No blackouts. Create one to block a date or time window."
5. Tests: api adapters; create form validates `startsAt < endsAt`.

**DoD**
- Creating a blackout that overlaps a calendar day flips `hasBlackout` on that calendar dot after refetch.
- Archive hides from default list; toggle reveals with restore.
- Reservation settings page renders the backend response untouched.

### Phase E — Polish, tests, push planning

**Goal:** harden, document, plan push.

**Tasks**
1. Sentry breadcrumbs on every mutation (send message, archive, notify, create blackout, create template).
2. Error message map: walk all `features/*/errors.ts` and reservation/blackout/messaging error codes through one mapper.
3. Empty / loading / error states audit across all new screens. Capture screenshots.
4. Dark mode audit across all new screens.
5. iPad split-view audit at 768/834/1024/1180/1366 widths. Document the breakpoint behavior.
6. Push notification v2 plan: write a follow-up note in `docs/plan/host-mobile-push-v2.md` capturing what backend would need (token register endpoint, send-on-inbound, deep link to thread) and what frontend would need (Expo push setup, APNs cert).
7. Storybook-style "showcase" route under a dev-only flag for the new components (optional; implementor discretion).
8. Run `pnpm typecheck` + `pnpm test` + `pnpm lint` clean.
9. Manual smoke pass: end-to-end golden path on iPad Pro sim per `pnpm ios:ipad-pro`.

**DoD**
- All new screens dark-mode clean.
- All new screens render empty/loading/error states without crashing.
- v1 ships behind a clean release tag; v2 push plan checked in.

---

## 4. Risks

| Risk | Mitigation |
|---|---|
| Backend single-instance assumption breaks under scale (WS broadcasts lose clients on other instances). | Documented in §1.8. Frontend assumes single-instance; Section 1.9 captures the Realtime contingency. |
| Polling overload (every host = polling every 15s) hammering backend. | `usePolling` stops after 5min background. Foreground polling only when tab focused. Easy swap to push later. |
| Template placeholder semantics drift between backend interpolation and frontend preview. | `templateRenderer.ts` is preview-only; we always send `templateId` (server-side render) unless the host edits the body. Tests verify the renderer matches documented placeholders. |
| Inbound message during a rush goes unseen for up to 15s. | Foreground polling at 5s on the open thread, 15s on the list. Push is the v2 fix. |
| Optimistic send shows a message that backend ultimately drops. | Inline failed-bubble + retry button; never silently. |
| Calendar density endpoint slips. | Phase C ships behind `EXPO_PUBLIC_RESERVATIONS_DENSITY` flag with stub-empty dots. Day-book continues to work. |
| Reservation seat WS confirmation race vs HTTP response. | Unchanged from today: HTTP-first, WS confirms via `commandId`. No change in v1. |

---

## 5. Future work (v2+)

- Push notifications (Expo notifications + APNs/FCM) — see Phase E plan note.
- Supabase Realtime contingency for CCTV table state.
- Recurring blackouts.
- Calendar density heat map (per-day status mix shading).
- WS event for messaging (drop polling).
- Inbox attachments (MMS).
- Template variable autocomplete in the body editor.
- Bulk-archive reservations end-of-night screen.
- Reservation settings mutation UI (currently read-only in v1).

---

## 6. Codex / implementor notes

- Phase boundaries are real — don't merge phases B and C into a single PR even if it's tempting. Each phase has its own backend dependency and its own merge risk.
- Where the plan says "discretion": organizing files inside a feature module, naming sub-types, choosing skeleton/empty illustration styles, picking sheet vs modal for small interactions.
- Where the plan is strict: backend contracts (§1), routing structure (§2.3), state ownership (§2.1), shared types (§2.4), DoD per phase.
- All new screens must obey `CLAUDE.md`: no `BlurView`, use `useTheme`, tokens-only colors.
- All copy is English-only in v1. No i18n setup needed yet.
- Match existing test scaffolding: `api.test.ts`, `contracts.test.ts`, `store.test.ts` patterns from `features/host/*`.
- Branch naming and PR titles: feel free to follow conventional commits; not strict in this repo yet.

---

## 7. Doc cross-references

- `CLAUDE.md` — design system rules (BlurView ban, theme tokens).
- `docs/architecture/host-backend-contract.md` — existing host backend contract.
- `docs/architecture/host-mobile-reservations-contract.md` — earlier reservations contract; this plan supersedes the `messageDelivery` deprecation note and the "nice-to-have date-range" note (now required).
- `docs/architecture/realtime-floor-state.md` — backend floor WS payloads.
- `docs/architecture/realtime-floor-state-integration.md` — frontend WS integration patterns.
- Backend sibling repo (reference only):
  - `docs/frontend/HOST_CCTV_TABLE_STATE_HANDOFF.md`
  - `docs/backend/REALTIME_TABLE_STATE_LAYER.md`
  - `supabase/migrations/0024_host_tables_realtime_rls.sql`

End of plan.
