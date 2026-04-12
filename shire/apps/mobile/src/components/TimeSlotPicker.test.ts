import { DEFAULT_TIME_SLOTS, resolveTimeSlotOptions } from './reservationTimeSlots';

describe('resolveTimeSlotOptions', () => {
  it('falls back to standard service times when live availability is empty', () => {
    const options = resolveTimeSlotOptions([]);

    expect(options).toHaveLength(DEFAULT_TIME_SLOTS.length);
    expect(options[0]).toEqual({ value: '11:00' });
    expect(options[options.length - 1]).toEqual({ value: '22:00' });
  });

  it('preserves a currently selected time that is missing from live availability', () => {
    const options = resolveTimeSlotOptions([{ value: '18:00' }], '18:30');

    expect(options.map((slot) => slot.value)).toEqual(['18:00', '18:30']);
  });

  it('keeps live availability metadata when slots are provided', () => {
    const options = resolveTimeSlotOptions([
      { value: '19:00', disabled: true, reason: 'Dining room full' },
    ]);

    expect(options).toEqual([
      { value: '19:00', disabled: true, reason: 'Dining room full' },
    ]);
  });
});
