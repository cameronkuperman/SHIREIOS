import { storage } from '@/lib/storage';
import { useWorkdayStore } from './store';

describe('workday store', () => {
  afterEach(() => {
    useWorkdayStore.getState().reset();
    storage.delete('shire-workday-store');
  });

  it('tracks the active location for the current workday', () => {
    useWorkdayStore.getState().startWorkday('location-1');
    expect(useWorkdayStore.getState().activeLocationId).toBe('location-1');

    useWorkdayStore.getState().endWorkday();
    expect(useWorkdayStore.getState().activeLocationId).toBeNull();
  });

  it('persists the active location for cold starts', () => {
    useWorkdayStore.getState().startWorkday('location-1');

    expect(storage.getString('shire-workday-store')).toContain('location-1');
  });
});
