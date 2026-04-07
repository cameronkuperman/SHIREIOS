import type { WaitlistParty } from './partyStore';

export type WaitlistAction =
  | { type: 'escalate'; partyId: string }
  | { type: 'notify'; partyId: string }
  | { type: 'timeout'; partyId: string };

type WaitlistConfig = {
  autoEscalateMinutes: number;
  notificationTimeoutMinutes: number;
  autoNotifyNext: boolean;
};

export function computeWaitlistTransitions(
  waitlist: WaitlistParty[],
  config: WaitlistConfig,
  now: number = Date.now(),
): WaitlistAction[] {
  const actions: WaitlistAction[] = [];

  // Check for notification timeouts first
  for (const party of waitlist) {
    if (party.status === 'Notified' && party.notifiedAt) {
      const notifiedMs = new Date(party.notifiedAt).getTime();
      const elapsedMinutes = (now - notifiedMs) / 60_000;
      if (elapsedMinutes >= config.notificationTimeoutMinutes) {
        actions.push({ type: 'timeout', partyId: party.id });
      }
    }
  }

  // Check if any party should be escalated to "Next"
  const hasNext = waitlist.some((p) => p.status === 'Next' || p.status === 'Notified');
  if (!hasNext) {
    // Find the longest-waiting party that qualifies for escalation
    const waitingParties = waitlist
      .filter((p) => p.status === 'Waiting')
      .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

    for (const party of waitingParties) {
      const joinedMs = new Date(party.joinedAt).getTime();
      const elapsedMinutes = (now - joinedMs) / 60_000;
      if (elapsedMinutes >= config.autoEscalateMinutes) {
        actions.push({ type: 'escalate', partyId: party.id });
        if (config.autoNotifyNext) {
          actions.push({ type: 'notify', partyId: party.id });
        }
        break; // Only escalate one at a time
      }
    }
  }

  return actions;
}
