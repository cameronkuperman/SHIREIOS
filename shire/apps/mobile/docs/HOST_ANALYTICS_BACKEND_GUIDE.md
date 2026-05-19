# Host Analytics Backend Guide

This guide documents the backend data needed for the host iPad Shift Analytics
page. The mobile v1 surface is mock-first, but the UI is shaped around these
definitions so the backend can later replace the mock model without changing
the product contract.

The backend can choose its own tables, jobs, and query strategy. The important
part is that the app can ask for shift analytics and receive consistent
aggregates for covers, turns, waiter load, and occupied-to-dirty turn time.

## V1 Product Scope

- Audience: host or manager watching the current shift live.
- Primary unit: covers / people, not revenue.
- Primary time range: current shift.
- Secondary ranges: today and week once historical data exists.
- Money metrics are intentionally excluded until POS data is available.
- Cleaning/reset metrics are not shown in v1, but the backend should preserve
  enough timestamps to calculate them later.

## Suggested Aggregate Response

A single aggregate endpoint is preferred, but not required:

`GET /api/v1/locations/{location_id}/analytics/shift?range=current_shift|today|week`

Equivalent GraphQL/RPC/materialized-view data is also fine if it returns the
same conceptual shape.

Recommended response fields:

```json
{
  "range": "current_shift",
  "generatedAt": "2026-05-18T23:15:00Z",
  "summary": {
    "covers": 161,
    "parties": 54,
    "tablesTurned": 41,
    "avgTurnTimeMinutes": 58,
    "peakBucketLabel": "7 PM"
  },
  "hourly": [
    {
      "bucketStart": "2026-05-18T21:00:00Z",
      "bucketLabel": "5 PM",
      "covers": 18,
      "parties": 6,
      "tablesTurned": 4,
      "avgTurnTimeMinutes": 52
    }
  ],
  "waiters": [
    {
      "waiterId": "uuid",
      "waiterName": "James",
      "covers": 44,
      "tablesServed": 12,
      "liveTables": 4,
      "avgTurnTimeMinutes": 62,
      "signal": "load_watch"
    }
  ],
  "bottlenecks": {
    "longOccupiedTables": [
      {
        "tableId": "table-12",
        "tableLabel": "12",
        "waiterId": "uuid",
        "waiterName": "James",
        "occupiedMinutes": 78
      }
    ]
  },
  "insights": [
    {
      "tone": "watch",
      "title": "7 PM is the pressure point",
      "body": "7 PM is pacing above the shift average for covers."
    }
  ]
}
```

## Event Facts Needed

For each completed or live table visit, keep enough facts to attribute the
turn to a table, waiter, party, and time bucket:

- `tableId`
- `tableLabel`
- `waiterId`
- `waiterName`
- `partySize`
- `occupiedAt` or `seatedAt`
- `dirtyAt`
- `currentState`
- existing state timestamps such as `updatedAt`, `stateChangedAt`, and
  `seatedAt` when available

For v1 analytics, a completed turn is counted only when both occupied/seated
time and dirty time exist.

## Metric Definitions

- `covers`: sum of `partySize` for seated parties in the range.
- `parties`: count of seated parties in the range.
- `tablesTurned`: count of visits where `dirtyAt` exists in the range.
- `turnTimeMinutes`: `dirtyAt - occupiedAt`.
- `avgTurnTimeMinutes`: average `turnTimeMinutes` across completed turns.
- `liveTables`: current occupied tables assigned to the waiter.
- `longOccupiedTables`: currently occupied tables above the configured dwell
  threshold. The mobile mock uses 65 minutes as an example target only.

If a table is manually marked dirty after guests leave, use the manual dirty
timestamp as `dirtyAt`. If computer vision detects dirty state first, use the
first trusted dirty transition.

## Waiter Signals

The live host app should use operational language rather than punitive labels.
Backend may send one of these optional signal keys:

- `steady`
- `load_watch`
- `fastest_flow`
- `needs_support`

The app should avoid labels like "worst" or "underperforming" on the live host
floor. Manager-only historical reports can be more direct later if needed.

## Future Fields Not Shown In V1

The backend should preserve these fields if cheap, but the v1 mobile UI should
not display cleaning/reset analytics yet:

- `cleanedAt`
- `dirtyDurationMinutes`
- `resetTimeMinutes = cleanedAt - dirtyAt`

These will support future busser/reset analytics, dirty-table bottleneck
reporting, and table-ready forecasting.

## Data Quality Rules

- If `partySize` is missing, count the visit as one party but do not include it
  in covers unless the backend has a safe fallback.
- If waiter attribution changes during a visit, attribute the completed turn to
  the waiter assigned at `occupiedAt` unless backend product rules choose a
  different canonical owner.
- Exclude blocked tables from utilization and turn calculations.
- Keep generated aggregates location-scoped and shift-scoped.
- Include `generatedAt` so the app can show staleness later.
