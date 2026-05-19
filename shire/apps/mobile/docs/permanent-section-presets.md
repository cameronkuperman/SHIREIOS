# Permanent Section Presets

## Current implementation

Section presets are persisted as part of the existing floor map document:

- `floorMap.sectionPlans`
- `floorMap.activeSectionPlanId`
- each plan stores `planId`, `name`, `waiterCount`, `sections[]`, and `isDefault`
- each section stores `sectionId` and `tableIds`

This keeps sections permanent without requiring a new backend migration for the first pass, because the app already saves `floor_maps.map_data` and upserts the host floor map payload.

Daily waiter assignment stays in existing routing state:

- `host_waiter_routing.section_assignments`
- shape remains `sectionId -> waiterId`
- no waiter IDs are stored inside section presets

## Product split

Floor Builder owns permanent setup:

- table layout
- section presets by waiter count
- table membership for each section

Shift Setup owns daily assignment:

- active waiters
- selected section preset
- assigning today's waiters to existing section IDs
- visual preview of assignment coverage

## Future backend extraction

If section presets need their own API or multi-device editing outside the floor-map payload, add a dedicated table:

```sql
create table host_floor_section_plans (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  floor_id text not null,
  name text not null,
  waiter_count integer not null check (waiter_count > 0),
  section_map jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

The `section_map` JSON should store only reusable floor geometry and table membership, not daily waiter assignment.
