export type TimeSlotOption = {
  value: string;
  label?: string;
  disabled?: boolean;
  reason?: string | null;
};

function generateSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 11; hour <= 21; hour += 1) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 22) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }
  slots.push('22:00');
  return slots;
}

export const DEFAULT_TIME_SLOTS = generateSlots();

export function formatSlotLabel(value: string): string {
  const parts = value.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function roundUpToInterval(now: Date, intervalMin: number): string {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(minutes / intervalMin) * intervalMin;
  const clamped = Math.min(rounded, 23 * 60 + 45);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function resolveTimeSlotOptions(
  slots?: TimeSlotOption[],
  value?: string | null,
): TimeSlotOption[] {
  const baseOptions =
    slots && slots.length > 0 ? slots : DEFAULT_TIME_SLOTS.map((slot) => ({ value: slot }));
  const options = [...baseOptions];

  if (value && !options.find((slot) => slot.value === value)) {
    options.push({ value });
  }

  const seen = new Set<string>();
  return options
    .filter((slot) => slot.value.trim().length > 0)
    .filter((slot) => {
      if (seen.has(slot.value)) {
        return false;
      }

      seen.add(slot.value);
      return true;
    })
    .sort((left, right) => left.value.localeCompare(right.value));
}
