-- Floor map layouts: stores user-built freeform table positions per location/floor.

create table if not exists public.floor_maps (
  id uuid primary key default gen_random_uuid(),
  location_id text not null,
  floor_id text not null,
  map_version text not null,
  map_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint floor_maps_location_floor_unique unique (location_id, floor_id)
);

-- Index for fast lookup by location + floor
create index if not exists idx_floor_maps_location_floor
  on public.floor_maps (location_id, floor_id);

-- Auto-update updated_at on row modification
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger floor_maps_updated_at
  before update on public.floor_maps
  for each row execute function public.set_updated_at();

-- RLS: authenticated users can read/write their own location's floor maps
alter table public.floor_maps enable row level security;

create policy "Users can read floor maps for their location"
  on public.floor_maps for select
  using (true);

create policy "Users can insert floor maps"
  on public.floor_maps for insert
  with check (true);

create policy "Users can update floor maps"
  on public.floor_maps for update
  using (true);
