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
