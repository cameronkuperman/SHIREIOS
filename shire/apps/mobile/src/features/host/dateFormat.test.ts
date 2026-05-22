import { formatServiceDateLabel } from './dateFormat';

describe('formatServiceDateLabel', () => {
  it('formats yyyy-MM-dd with month name and ordinal day', () => {
    expect(formatServiceDateLabel('2026-05-20')).toBe('May 20th');
    expect(formatServiceDateLabel('2026-05-01')).toBe('May 1st');
    expect(formatServiceDateLabel('2026-05-02')).toBe('May 2nd');
    expect(formatServiceDateLabel('2026-05-03')).toBe('May 3rd');
    expect(formatServiceDateLabel('2026-05-11')).toBe('May 11th');
  });

  it('returns the original string when parsing fails', () => {
    expect(formatServiceDateLabel('not-a-date')).toBe('not-a-date');
  });
});
