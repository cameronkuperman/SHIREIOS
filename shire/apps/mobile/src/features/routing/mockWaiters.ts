// Mock waiter roster — placeholder data so the floor, sections, and rotation
// UI render with content before the real waiter backend is wired. Swap for
// live data later; the shape is intentionally minimal.

export type MockWaiter = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

export const MOCK_WAITERS: MockWaiter[] = [
  { id: 'w-sarah', name: 'Sarah', initials: 'SA', color: '#E0734A' },
  { id: 'w-james', name: 'James', initials: 'JA', color: '#4E9E5B' },
  { id: 'w-maria', name: 'Maria', initials: 'MR', color: '#9B6BC4' },
  { id: 'w-tyler', name: 'Tyler', initials: 'TY', color: '#D6A92E' },
  { id: 'w-alex', name: 'Alex', initials: 'AL', color: '#3E8FC4' },
  { id: 'w-nina', name: 'Nina', initials: 'NI', color: '#C2517A' },
  { id: 'w-omar', name: 'Omar', initials: 'OM', color: '#4FA39A' },
  { id: 'w-dana', name: 'Dana', initials: 'DA', color: '#7E8A3C' },
];

/** The roster trimmed to a given waiter count (5–8 for section sets). */
export function mockWaitersForCount(count: number): MockWaiter[] {
  const clamped = Math.max(1, Math.min(count, MOCK_WAITERS.length));
  return MOCK_WAITERS.slice(0, clamped);
}
