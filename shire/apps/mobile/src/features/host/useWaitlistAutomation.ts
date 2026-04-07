import { useEffect, useRef } from 'react';
import { useHostPartyStore } from './partyStore';
import { useWaitlistConfigStore } from './waitlistConfigStore';
import { computeWaitlistTransitions } from './waitlistAutomation';

const INTERVAL_MS = 30_000; // 30 seconds

export function useWaitlistAutomation() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function tick() {
      const waitlist = useHostPartyStore.getState().waitlist;
      const config = useWaitlistConfigStore.getState();
      const actions = computeWaitlistTransitions(waitlist, config);

      const store = useHostPartyStore.getState();

      for (const action of actions) {
        switch (action.type) {
          case 'escalate':
            store.escalateParty(action.partyId);
            break;
          case 'notify':
            store.notifyParty(action.partyId);
            break;
          case 'timeout':
            store.removeParty(action.partyId);
            break;
        }
      }
    }

    // Run immediately and then on interval
    tick();
    intervalRef.current = setInterval(tick, INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
