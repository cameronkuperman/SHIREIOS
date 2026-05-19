import {
  describeClosedDays,
  scheduleWindowsToServicePeriods,
  servicePeriodsToScheduleWindows,
} from './reservationSchedule';

describe('reservation schedule editor model', () => {
  it('groups matching backend service periods into one multi-day tablet window', () => {
    const windows = servicePeriodsToScheduleWindows([
      {
        id: 'wed-dinner',
        name: 'Dinner',
        dayOfWeek: 2,
        startTime: '17:00',
        endTime: '22:00',
        slotIntervalMinutes: 15,
        leadTimeMinutes: 60,
        sameDayCutoffTime: null,
        minPartySize: 1,
        maxPartySize: 8,
        defaultDurationMinutes: 90,
        active: true,
      },
      {
        id: 'thu-dinner',
        name: 'Dinner',
        dayOfWeek: 3,
        startTime: '17:00',
        endTime: '22:00',
        slotIntervalMinutes: 15,
        leadTimeMinutes: 60,
        sameDayCutoffTime: null,
        minPartySize: 1,
        maxPartySize: 8,
        defaultDurationMinutes: 90,
        active: true,
      },
    ]);

    expect(windows).toHaveLength(1);
    expect(windows[0]?.days).toEqual([2, 3]);
    expect(windows[0]?.periodIdsByDay).toEqual({ 2: 'wed-dinner', 3: 'thu-dinner' });
  });

  it('expands one tablet window into per-day service periods for the backend', () => {
    const periods = scheduleWindowsToServicePeriods([
      {
        draftId: 'draft-1',
        periodIdsByDay: { 2: 'wed-dinner' },
        name: 'Dinner',
        days: [2, 4, 3],
        startTime: '17:00',
        endTime: '22:00',
        slotIntervalMinutes: 15,
        leadTimeMinutes: 60,
        sameDayCutoffTime: null,
        minPartySize: 1,
        maxPartySize: 8,
        defaultDurationMinutes: 90,
        active: true,
      },
    ]);

    expect(periods.map((period) => period.dayOfWeek)).toEqual([2, 3, 4]);
    expect(periods[0]?.id).toBe('wed-dinner');
    expect(periods[1]?.id).toBeNull();
  });

  it('describes closed days when no active windows exist for those days', () => {
    const description = describeClosedDays([
      {
        draftId: 'draft-1',
        periodIdsByDay: {},
        name: 'Dinner',
        days: [2],
        startTime: '17:00',
        endTime: '22:00',
        slotIntervalMinutes: 15,
        leadTimeMinutes: 60,
        sameDayCutoffTime: null,
        minPartySize: 1,
        maxPartySize: 8,
        defaultDurationMinutes: 90,
        active: true,
      },
    ]);

    expect(description).toContain('Mon');
    expect(description).not.toContain('Wed');
  });
});
