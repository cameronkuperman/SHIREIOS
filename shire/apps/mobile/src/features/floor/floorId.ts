import { DEFAULT_FLOOR_ID } from './floorMap';

export function findFloorId(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

export function resolveFloorId(...candidates: Array<string | null | undefined>): string {
  const floorId = findFloorId(...candidates);
  if (floorId) {
    return floorId;
  }

  return DEFAULT_FLOOR_ID;
}
