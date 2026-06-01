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

  it('flags a manual end so /workday will not auto-resume', () => {
    useWorkdayStore.getState().approveSetup(
      'location-1',
      '2026-05-21',
      '2026-05-21T12:30:00+00:00',
    );
    expect(useWorkdayStore.getState().manuallyEnded).toBe(false);

    useWorkdayStore.getState().endWorkday();
    expect(useWorkdayStore.getState().manuallyEnded).toBe(true);

    // Starting the next shift only opens the setup flow — the flag stays set so the
    // setup sheet isn't auto-skipped while the server still holds today's approval.
    useWorkdayStore.getState().startWorkday('location-1', { serviceDate: '2026-05-22' });
    expect(useWorkdayStore.getState().manuallyEnded).toBe(true);

    // Approving a fresh setup clears it, restoring normal auto-resume on reopen.
    useWorkdayStore.getState().approveSetup(
      'location-1',
      '2026-05-22',
      '2026-05-22T12:30:00+00:00',
    );
    expect(useWorkdayStore.getState().manuallyEnded).toBe(false);
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
