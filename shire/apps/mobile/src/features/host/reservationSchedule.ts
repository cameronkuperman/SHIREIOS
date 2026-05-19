import type { ReservationServicePeriod } from '@shire/shared';

export const WEEKDAYS = [
  { value: 0, short: 'Mon', label: 'Monday' },
  { value: 1, short: 'Tue', label: 'Tuesday' },
  { value: 2, short: 'Wed', label: 'Wednesday' },
  { value: 3, short: 'Thu', label: 'Thursday' },
  { value: 4, short: 'Fri', label: 'Friday' },
  { value: 5, short: 'Sat', label: 'Saturday' },
  { value: 6, short: 'Sun', label: 'Sunday' },
] as const;

export type ScheduleWindowDraft = {
  draftId: string;
  periodIdsByDay: Partial<Record<number, string>>;
  name: string;
  days: number[];
  startTime: string;
  endTime: string;
  slotIntervalMinutes: number;
  leadTimeMinutes: number;
  sameDayCutoffTime: string | null;
  minPartySize: number;
  maxPartySize: number;
  defaultDurationMinutes: number;
  active: boolean;
};

const DEFAULT_WINDOW = {
  name: 'Dinner',
  startTime: '17:00',
  endTime: '22:00',
  slotIntervalMinutes: 15,
  leadTimeMinutes: 60,
  sameDayCutoffTime: null,
  minPartySize: 1,
  maxPartySize: 8,
  defaultDurationMinutes: 90,
  active: true,
};

function sortedDays(days: number[]): number[] {
  return [...new Set(days)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
}

function keyForPeriod(period: ReservationServicePeriod): string {
  return [
    period.name,
    period.startTime,
    period.endTime,
    period.slotIntervalMinutes,
    period.leadTimeMinutes,
    period.sameDayCutoffTime ?? '',
    period.minPartySize,
    period.maxPartySize,
    period.defaultDurationMinutes,
    period.active,
  ].join('|');
}

export function createScheduleWindowDraft(
  overrides: Partial<ScheduleWindowDraft> = {},
): ScheduleWindowDraft {
  return {
    ...DEFAULT_WINDOW,
    ...overrides,
    draftId: overrides.draftId ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    periodIdsByDay: overrides.periodIdsByDay ?? {},
    days: sortedDays(overrides.days ?? [2]),
  };
}

export function servicePeriodsToScheduleWindows(
  periods: ReservationServicePeriod[],
): ScheduleWindowDraft[] {
  const groups = new Map<string, ScheduleWindowDraft>();

  periods
    .filter((period) => period.active)
    .forEach((period) => {
      const key = keyForPeriod(period);
      const existing = groups.get(key);
      if (existing) {
        groups.set(key, {
          ...existing,
          days: sortedDays([...existing.days, period.dayOfWeek]),
          periodIdsByDay: {
            ...existing.periodIdsByDay,
            ...(period.id ? { [period.dayOfWeek]: period.id } : {}),
          },
        });
        return;
      }

      groups.set(
        key,
        createScheduleWindowDraft({
          draftId: period.id ?? `period-${key}`,
          periodIdsByDay: period.id ? { [period.dayOfWeek]: period.id } : {},
          name: period.name,
          days: [period.dayOfWeek],
          startTime: period.startTime,
          endTime: period.endTime,
          slotIntervalMinutes: period.slotIntervalMinutes,
          leadTimeMinutes: period.leadTimeMinutes,
          sameDayCutoffTime: period.sameDayCutoffTime,
          minPartySize: period.minPartySize,
          maxPartySize: period.maxPartySize,
          defaultDurationMinutes: period.defaultDurationMinutes,
          active: period.active,
        }),
      );
    });

  return [...groups.values()].sort((left, right) => {
    const leftDay = left.days[0] ?? 0;
    const rightDay = right.days[0] ?? 0;
    if (leftDay !== rightDay) return leftDay - rightDay;
    return left.startTime.localeCompare(right.startTime);
  });
}

export function scheduleWindowsToServicePeriods(
  windows: ScheduleWindowDraft[],
): ReservationServicePeriod[] {
  return windows.flatMap((window) =>
    sortedDays(window.days).map((day) => ({
      id: window.periodIdsByDay[day] ?? null,
      name: window.name.trim() || 'Service',
      dayOfWeek: day,
      startTime: window.startTime,
      endTime: window.endTime,
      slotIntervalMinutes: window.slotIntervalMinutes,
      leadTimeMinutes: window.leadTimeMinutes,
      sameDayCutoffTime: window.sameDayCutoffTime,
      minPartySize: window.minPartySize,
      maxPartySize: window.maxPartySize,
      defaultDurationMinutes: window.defaultDurationMinutes,
      active: window.active,
    })),
  );
}

export function describeClosedDays(windows: ScheduleWindowDraft[]): string {
  const openDays = new Set(
    windows.flatMap((window) => (window.active ? window.days : [])),
  );
  const closed = WEEKDAYS.filter((day) => !openDays.has(day.value)).map((day) => day.short);
  return closed.length === 0 ? 'No closed days' : `${closed.join(', ')} closed`;
}
