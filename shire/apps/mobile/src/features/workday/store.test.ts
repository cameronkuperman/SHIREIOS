import { storage } from '@/lib/storage';
import { useWorkdayStore } from './store';

describe('workday store', () => {
  afterEach(() => {
    useWorkdayStore.getState().reset();
    storage.delete('shire-workday-store');
  });

  it('tracks the active location for the current workday', () => {
    useWorkdayStore.getState().approveSetup(
      'location-1',
      '2026-05-21',
      '2026-05-21T12:30:00+00:00',
    );
    expect(useWorkdayStore.getState().activeLocationId).toBe('location-1');
    expect(useWorkdayStore.getState().serviceDate).toBe('2026-05-21');
    expect(useWorkdayStore.getState().setupApprovedAt).toBe('2026-05-21T12:30:00+00:00');

    useWorkdayStore.getState().endWorkday();
    expect(useWorkdayStore.getState().activeLocationId).toBeNull();
  });

  it('does not mark a pending setup as workday active', () => {
    useWorkdayStore.getState().startWorkday('location-1', { serviceDate: '2026-05-21' });

    expect(useWorkdayStore.getState().activeLocationId).toBe('location-1');
    expect(useWorkdayStore.getState().setupApprovedAt).toBeNull();
  });

  it('persists the active location for cold starts', () => {
    useWorkdayStore.getState().approveSetup(
      'location-1',
      '2026-05-21',
      '2026-05-21T12:30:00+00:00',
    );

    expect(storage.getString('shire-workday-store')).toContain('location-1');
    expect(storage.getString('shire-workday-store')).toContain('2026-05-21');
  });
});
