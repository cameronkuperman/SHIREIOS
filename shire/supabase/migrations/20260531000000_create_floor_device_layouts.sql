-- Device-scoped floor layouts: table geometry for a host device/profile.
-- The canonical floor map remains the source for table facts; this table owns
-- presentation details such as x/y, size, rotation, and device/profile defaults.

create table if not exists public.floor_device_layouts (
  id text primary key,
  location_id text not null,
  floor_id text not null,
  surface text not null default 'host',
  profile_key text not null,
  device_id text,
  device_label text,
  is_profile_default boolean not null default false,
  map_version text,
  layout_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint floor_device_layouts_surface_check
    check (surface in ('host'))
);

create index if not exists idx_floor_device_layouts_lookup
  on public.floor_device_layouts (location_id, floor_id, surface, profile_key);

create index if not exists idx_floor_device_layouts_device
  on public.floor_device_layouts (location_id, floor_id, surface, device_id)
  where device_id is not null;

create unique index if not exists idx_floor_device_layouts_profile_default_unique
  on public.floor_device_layouts (location_id, floor_id, surface, profile_key)
  where is_profile_default;

create trigger floor_device_layouts_updated_at
  before update on public.floor_device_layouts
  for each row execute function public.set_updated_at();

alter table public.floor_device_layouts enable row level security;

create policy "Authenticated users can read floor device layouts"
  on public.floor_device_layouts for select
  to authenticated
  using (true);

create policy "Authenticated users can insert floor device layouts"
  on public.floor_device_layouts for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update floor device layouts"
  on public.floor_device_layouts for update
  to authenticated
  using (true)
  with check (true);
