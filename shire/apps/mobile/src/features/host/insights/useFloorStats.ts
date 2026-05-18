import { useMemo } from 'react';
import { useFloorTablesByRoom } from '@/features/floor';

/**
 * Restaurant stats derived on-device from live floor state. Occupancy and the
 * status counts are real; tablesServed / efficiency / tips need a backend and
 * are returned as null (see docs/backend-contract-insights.md).
 */
export type FloorStats = {
  occupancyPct: number;
  open: number;
  seated: number;
  dirty: number;
  reserved: number;
  blocked: number;
  totalTables: number;
  tablesServed: number | null;
  efficiencyPct: number | null;
  tipsTotalCents: number | null;
};

export function useFloorStats(): FloorStats {
  const rooms = useFloorTablesByRoom();

  return useMemo(() => {
    let open = 0;
    let seated = 0;
    let dirty = 0;
    let reserved = 0;
    let blocked = 0;

    for (const room of rooms) {
      for (const table of room.tables) {
        if (table.isBlocked) {
          blocked += 1;
          continue;
        }
        switch (table.status) {
          case 'available':
            open += 1;
            break;
          case 'occupied':
            seated += 1;
            break;
          case 'dirty':
            dirty += 1;
            break;
          case 'reserved':
            reserved += 1;
            break;
          default:
            break;
        }
      }
    }

    const totalTables = open + seated + dirty + reserved + blocked;
    const serviceable = totalTables - blocked;
    const occupancyPct = serviceable > 0 ? Math.round((seated / serviceable) * 100) : 0;

    return {
      occupancyPct,
      open,
      seated,
      dirty,
      reserved,
      blocked,
      totalTables,
      tablesServed: null,
      efficiencyPct: null,
      tipsTotalCents: null,
    };
  }, [rooms]);
}
