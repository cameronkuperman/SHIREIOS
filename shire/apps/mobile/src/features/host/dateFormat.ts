import { format, parseISO } from 'date-fns';

function dayOrdinalSuffix(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/** e.g. `2026-05-20` → `May 20th` */
export function formatServiceDateLabel(date: string): string {
  try {
    const parsed = parseISO(`${date}T12:00:00`);
    const day = parsed.getDate();
    return `${format(parsed, 'MMMM')} ${day}${dayOrdinalSuffix(day)}`;
  } catch {
    return date;
  }
}
