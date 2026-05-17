import { findNearbyOpenSlots } from './findNearbyOpenSlots';
import type { ReservationAvailabilitySlot } from '@shire/shared';

function slot(
  timeSlot: string,
  available: boolean = true,
): ReservationAvailabilitySlot {
  return {
    timeSlot,
    available,
    reason: null,
    servicePeriodId: null,
    servicePeriodName: null,
    canOverridePacing: false,
  };
}

describe('findNearbyOpenSlots', () => {
  it('returns the closest earlier and later open slots around an anchor', () => {
    const slots = [
      slot('17:00'),
      slot('17:30'),
      slot('18:00'),
      slot('18:30'),
      slot('19:00'),
      slot('19:30'),
      slot('20:00'),
      slot('20:30'),
    ];
    const result = findNearbyOpenSlots(slots, '19:00', 2);
    expect(result.earlier.map((s) => s.timeSlot)).toEqual(['18:00', '18:30']);
    expect(result.later.map((s) => s.timeSlot)).toEqual(['19:30', '20:00']);
  });

  it('returns empty arrays when no other open slots exist', () => {
    const slots = [slot('19:00')];
    const result = findNearbyOpenSlots(slots, '19:00', 2);
    expect(result.earlier).toEqual([]);
    expect(result.later).toEqual([]);
  });

  it('returns only one side when the anchor is at the edge of the day', () => {
    const slots = [
      slot('20:00'),
      slot('20:30'),
      slot('21:00'),
      slot('21:30'),
      slot('22:00'),
    ];
    const result = findNearbyOpenSlots(slots, '22:00', 2);
    expect(result.earlier.map((s) => s.timeSlot)).toEqual(['21:00', '21:30']);
    expect(result.later).toEqual([]);
  });

  it('ignores unavailable slots entirely', () => {
    const slots = [
      slot('18:00', false),
      slot('18:30', false),
      slot('19:00', false),
      slot('19:30', false),
    ];
    const result = findNearbyOpenSlots(slots, '19:00', 2);
    expect(result.earlier).toEqual([]);
    expect(result.later).toEqual([]);
  });

  it('still returns alts when the anchor itself is unavailable', () => {
    const slots = [
      slot('18:00', true),
      slot('18:30', true),
      slot('19:00', false),
      slot('19:30', true),
      slot('20:00', true),
    ];
    const result = findNearbyOpenSlots(slots, '19:00', 2);
    expect(result.earlier.map((s) => s.timeSlot)).toEqual(['18:00', '18:30']);
    expect(result.later.map((s) => s.timeSlot)).toEqual(['19:30', '20:00']);
  });

  it('deduplicates slots that share the same time', () => {
    const slots = [
      slot('18:00'),
      slot('18:00'),
      slot('18:30'),
      slot('19:30'),
      slot('19:30'),
    ];
    const result = findNearbyOpenSlots(slots, '19:00', 2);
    expect(result.earlier.map((s) => s.timeSlot)).toEqual(['18:00', '18:30']);
    expect(result.later.map((s) => s.timeSlot)).toEqual(['19:30']);
  });

  it('returns empty arrays when anchor is null', () => {
    const result = findNearbyOpenSlots([slot('18:00'), slot('19:00')], null);
    expect(result).toEqual({ earlier: [], later: [] });
  });
});
