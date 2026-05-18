import { useEffect, useMemo, useState } from 'react';
import { useActiveWaitlistEntries } from '@/features/host/hooks';

/**
 * On-device alerts engine. Wait-time alerts are derived from live waitlist
 * timestamps. Service-time alerts (a table seated too long) need a real
 * `seatedAt` timestamp the floor view-model doesn't expose yet, so they are
 * deferred to the backend (see docs/backend-contract-insights.md).
 */
export type AlertKind = 'wait_time' | 'service_time';
export type AlertSeverity = 'info' | 'warning';

export type FloorAlert = {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  message: string;
  sinceMinutes: number;
};

const WAIT_THRESHOLD_MIN = 20;

function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) {
    return null;
  }
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
}

export function useAlerts(): FloorAlert[] {
  const waitlist = useActiveWaitlistEntries();
  const [, setTick] = useState(0);

  // Re-evaluate relative times every 30s.
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    const alerts: FloorAlert[] = [];

    for (const entry of waitlist) {
      const mins = minutesSince(entry.joinedAt);
      if (mins != null && mins >= WAIT_THRESHOLD_MIN) {
        alerts.push({
          id: `wait-${entry.id}`,
          kind: 'wait_time',
          severity: mins >= WAIT_THRESHOLD_MIN * 1.5 ? 'warning' : 'info',
          message: `${entry.guest.name} has waited ${mins}m`,
          sinceMinutes: mins,
        });
      }
    }

    return alerts.sort((a, b) => b.sinceMinutes - a.sinceMinutes);
  }, [waitlist]);
}
