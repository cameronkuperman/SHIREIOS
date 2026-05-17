import type { ReservationAvailabilitySlot } from '@shire/shared';

export type NearbyOpenSlots = {
  earlier: ReservationAvailabilitySlot[];
  later: ReservationAvailabilitySlot[];
};

export function findNearbyOpenSlots(
  slots: ReservationAvailabilitySlot[] | undefined,
  anchor: string | null,
  count: number = 2,
): NearbyOpenSlots {
  if (!slots || slots.length === 0 || !anchor) {
    return { earlier: [], later: [] };
  }

  const seen = new Set<string>();
  const open = slots.filter((slot) => {
    if (!slot.available) return false;
    if (slot.timeSlot === anchor) return false;
    if (seen.has(slot.timeSlot)) return false;
    seen.add(slot.timeSlot);
    return true;
  });

  const earlier = open
    .filter((slot) => slot.timeSlot.localeCompare(anchor) < 0)
    .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
    .slice(-count);

  const later = open
    .filter((slot) => slot.timeSlot.localeCompare(anchor) > 0)
    .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
    .slice(0, count);

  return { earlier, later };
}
