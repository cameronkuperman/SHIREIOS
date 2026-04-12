import { findFloorId, resolveFloorId } from '../floorId';

describe('resolveFloorId', () => {
  it('returns null when every raw candidate is missing', () => {
    expect(findFloorId(undefined, null, '')).toBeNull();
  });

  it('returns the first non-empty floor id candidate', () => {
    expect(resolveFloorId(undefined, '', 'floor-2', 'floor-3')).toBe('floor-2');
  });

  it('falls back to the default floor id when every candidate is missing', () => {
    expect(resolveFloorId(undefined, null, '')).toBe('shire-main-floor');
  });
});
