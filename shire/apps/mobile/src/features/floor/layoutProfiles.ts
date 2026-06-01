import { Platform } from 'react-native';
import type { FloorMap, FloorMapTable } from '@shire/shared';
import { getOrCreateDeviceId } from '@/lib/device';
import { storage } from '@/lib/storage';
import { supabase } from '@/services/supabase/client';

export type FloorLayoutSurface = 'host';

export type FloorTableLayout = Pick<
  FloorMapTable,
  'tableId' | 'x' | 'y' | 'rotation' | 'width' | 'height'
>;

export type FloorLayoutProfile = {
  id: string;
  locationId: string | null;
  floorId: string;
  surface: FloorLayoutSurface;
  profileKey: string;
  deviceId: string | null;
  deviceLabel: string | null;
  isProfileDefault: boolean;
  mapVersion?: string;
  tables: Record<string, FloorTableLayout>;
  updatedAt: string;
};

type FloorLayoutProfileRow = {
  id: string;
  location_id: string;
  floor_id: string;
  surface: FloorLayoutSurface;
  profile_key: string;
  device_id: string | null;
  device_label: string | null;
  is_profile_default: boolean;
  map_version: string | null;
  layout_data: {
    tables?: Record<string, FloorTableLayout>;
  };
  updated_at: string;
};

type LayoutLookupInput = {
  locationId: string | null;
  floorId: string;
  surface?: FloorLayoutSurface;
  profileKey: string;
  deviceId?: string;
};

type SaveLayoutInput = LayoutLookupInput & {
  floorMap: FloorMap;
  deviceLabel?: string | null;
  makeProfileDefault?: boolean;
};

const LOCAL_LAYOUT_KEY = 'shire-floor-layout-profiles-v1';

function localScope(locationId: string | null): string {
  return locationId ?? 'local';
}

function readLocalProfiles(): FloorLayoutProfile[] {
  const raw = storage.getString(LOCAL_LAYOUT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalProfiles(profiles: FloorLayoutProfile[]): void {
  storage.set(LOCAL_LAYOUT_KEY, JSON.stringify(profiles));
}

function upsertLocalProfile(profile: FloorLayoutProfile): void {
  const profiles = readLocalProfiles().filter((current) => current.id !== profile.id);
  if (profile.isProfileDefault) {
    writeLocalProfiles([
      ...profiles.filter(
        (current) =>
          !(
            current.locationId === profile.locationId &&
            current.floorId === profile.floorId &&
            current.surface === profile.surface &&
            current.profileKey === profile.profileKey &&
            current.isProfileDefault
          ),
      ),
      profile,
    ]);
    return;
  }
  writeLocalProfiles([...profiles, profile]);
}

function profileId(input: {
  locationId: string | null;
  floorId: string;
  surface: FloorLayoutSurface;
  profileKey: string;
  deviceId: string | null;
  isProfileDefault: boolean;
}): string {
  const scope = localScope(input.locationId);
  const owner = input.isProfileDefault ? 'profile-default' : (input.deviceId ?? 'device-local');
  return [scope, input.floorId, input.surface, input.profileKey, owner]
    .map((part) => part.replace(/[^a-zA-Z0-9_-]+/g, '-'))
    .join(':');
}

function rowToProfile(row: FloorLayoutProfileRow): FloorLayoutProfile {
  return {
    id: row.id,
    locationId: row.location_id,
    floorId: row.floor_id,
    surface: row.surface,
    profileKey: row.profile_key,
    deviceId: row.device_id,
    deviceLabel: row.device_label,
    isProfileDefault: row.is_profile_default,
    mapVersion: row.map_version ?? undefined,
    tables: row.layout_data?.tables ?? {},
    updatedAt: row.updated_at,
  };
}

function profileToRow(profile: FloorLayoutProfile): FloorLayoutProfileRow {
  return {
    id: profile.id,
    location_id: profile.locationId ?? 'local',
    floor_id: profile.floorId,
    surface: profile.surface,
    profile_key: profile.profileKey,
    device_id: profile.deviceId,
    device_label: profile.deviceLabel,
    is_profile_default: profile.isProfileDefault,
    map_version: profile.mapVersion ?? null,
    layout_data: { tables: profile.tables },
    updated_at: profile.updatedAt,
  };
}

function newerProfile(
  current: FloorLayoutProfile | null,
  candidate: FloorLayoutProfile,
): FloorLayoutProfile {
  if (!current) return candidate;
  return Date.parse(candidate.updatedAt) >= Date.parse(current.updatedAt) ? candidate : current;
}

function bestLocalProfile(input: LayoutLookupInput): FloorLayoutProfile | null {
  const surface = input.surface ?? 'host';
  const deviceId = input.deviceId ?? getOrCreateDeviceId();
  const profiles = readLocalProfiles().filter(
    (profile) =>
      profile.locationId === input.locationId &&
      profile.floorId === input.floorId &&
      profile.surface === surface &&
      profile.profileKey === input.profileKey,
  );
  const exactDevice =
    profiles.find((profile) => profile.deviceId === deviceId && !profile.isProfileDefault) ?? null;
  if (exactDevice) return exactDevice;
  return (
    profiles
      .filter((profile) => profile.isProfileDefault)
      .reduce<FloorLayoutProfile | null>(newerProfile, null) ?? null
  );
}

async function fetchRemoteProfiles(
  input: Required<LayoutLookupInput>,
): Promise<FloorLayoutProfile[]> {
  if (!input.locationId) return [];
  const { data, error } = await supabase
    .from('floor_device_layouts')
    .select(
      'id, location_id, floor_id, surface, profile_key, device_id, device_label, is_profile_default, map_version, layout_data, updated_at',
    )
    .eq('location_id', input.locationId)
    .eq('floor_id', input.floorId)
    .eq('surface', input.surface)
    .eq('profile_key', input.profileKey);

  if (error) {
    return [];
  }

  return ((data ?? []) as FloorLayoutProfileRow[]).map(rowToProfile);
}

export function getFloorLayoutProfileKey(width: number, height: number): string {
  const shortestSide = Math.min(width, height);
  const orientation = width >= height ? 'landscape' : 'portrait';
  const sizeClass = shortestSide >= 744 ? 'tablet' : shortestSide >= 600 ? 'large-mobile' : 'phone';
  return `${Platform.OS}-${sizeClass}-${orientation}`;
}

export function getCurrentDeviceFloorLayoutInput(width: number, height: number) {
  const profileKey = getFloorLayoutProfileKey(width, height);
  return {
    deviceId: getOrCreateDeviceId(),
    deviceLabel: profileKey,
    profileKey,
  };
}

export function extractFloorLayoutFromMap(floorMap: FloorMap): Record<string, FloorTableLayout> {
  return Object.values(floorMap.tables).reduce<Record<string, FloorTableLayout>>(
    (tables, table) => {
      tables[table.tableId] = {
        tableId: table.tableId,
        x: table.x,
        y: table.y,
        rotation: table.rotation,
        width: table.width,
        height: table.height,
      };
      return tables;
    },
    {},
  );
}

export function applyFloorLayoutToMap(
  floorMap: FloorMap,
  profile: FloorLayoutProfile | null,
): FloorMap {
  if (!profile) return floorMap;
  const tables = Object.entries(floorMap.tables).reduce<FloorMap['tables']>(
    (nextTables, [tableId, table]) => {
      const layout = profile.tables[tableId] ?? profile.tables[table.tableId];
      nextTables[tableId] = layout
        ? {
            ...table,
            x: layout.x ?? table.x,
            y: layout.y ?? table.y,
            rotation: layout.rotation ?? table.rotation,
            width: layout.width ?? table.width,
            height: layout.height ?? table.height,
          }
        : table;
      return nextTables;
    },
    {},
  );
  return { ...floorMap, tables };
}

export async function loadBestFloorLayoutProfile(
  input: LayoutLookupInput,
): Promise<FloorLayoutProfile | null> {
  const surface = input.surface ?? 'host';
  const deviceId = input.deviceId ?? getOrCreateDeviceId();
  const normalizedInput = { ...input, surface, deviceId };
  let best = bestLocalProfile(normalizedInput);
  const remoteProfiles = await fetchRemoteProfiles(normalizedInput);
  for (const profile of remoteProfiles) {
    upsertLocalProfile(profile);
  }
  const exactRemote =
    remoteProfiles.find((profile) => profile.deviceId === deviceId && !profile.isProfileDefault) ??
    null;
  if (exactRemote) return exactRemote;
  const remoteDefault = remoteProfiles
    .filter((profile) => profile.isProfileDefault)
    .reduce<FloorLayoutProfile | null>(newerProfile, null);
  best = remoteDefault ? newerProfile(best, remoteDefault) : best;
  return best;
}

export async function saveFloorDeviceLayout(input: SaveLayoutInput): Promise<void> {
  const surface = input.surface ?? 'host';
  const deviceId = input.deviceId ?? getOrCreateDeviceId();
  const now = new Date().toISOString();
  const baseProfile: Omit<FloorLayoutProfile, 'id' | 'isProfileDefault' | 'deviceId'> = {
    locationId: input.locationId,
    floorId: input.floorId,
    surface,
    profileKey: input.profileKey,
    deviceLabel: input.deviceLabel ?? input.profileKey,
    mapVersion: input.floorMap.mapVersion,
    tables: extractFloorLayoutFromMap(input.floorMap),
    updatedAt: now,
  };
  const profiles: FloorLayoutProfile[] = [
    {
      ...baseProfile,
      id: profileId({
        locationId: input.locationId,
        floorId: input.floorId,
        surface,
        profileKey: input.profileKey,
        deviceId,
        isProfileDefault: false,
      }),
      deviceId,
      isProfileDefault: false,
    },
  ];

  if (input.makeProfileDefault ?? true) {
    profiles.push({
      ...baseProfile,
      id: profileId({
        locationId: input.locationId,
        floorId: input.floorId,
        surface,
        profileKey: input.profileKey,
        deviceId: null,
        isProfileDefault: true,
      }),
      deviceId: null,
      isProfileDefault: true,
    });
  }

  profiles.forEach(upsertLocalProfile);

  if (!input.locationId) return;

  const { error } = await supabase
    .from('floor_device_layouts')
    .upsert(profiles.map(profileToRow), { onConflict: 'id' });
  void error;
}
