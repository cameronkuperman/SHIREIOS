import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { DEFAULT_FLOOR_MAP, TableState, type FloorSnapshot, type HostBootstrap, type Location, type UserSession } from '@shire/shared';
import { apiClient } from '@/services/api/client';
import type { HostAnalyticsRange, HostShiftAnalyticsResponse } from '@/features/host/api';

export const HOST_PREVIEW_LOCATION_ID = '00000000-0000-4000-8000-00000000f002';
const now = new Date().toISOString();

export function isHostPreviewRuntime(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('shirePreview') === '1';
}

export const hostPreviewLocation: Location = {
  id: HOST_PREVIEW_LOCATION_ID,
  organizationId: 'preview-org',
  name: 'Shire Preview Restaurant',
  timezone: 'America/Chicago',
  floorId: DEFAULT_FLOOR_MAP.floorId,
  permissions: ['host.view', 'host.manage', 'reservations.manage', 'waitlist.manage', 'tables.manage', 'location.switch'],
  isDefault: true,
};

export const hostPreviewSession: UserSession = {
  user: { id: 'preview-host', email: 'preview@shire.local', fullName: 'Maya Chen', role: 'manager' },
  organization: { id: 'preview-org', name: 'Shire Preview Organization' },
  permissions: hostPreviewLocation.permissions,
};

export function hostPreviewBootstrap(tokens: Record<string, string> = {}): HostBootstrap {
  return {
    session: hostPreviewSession,
    location: hostPreviewLocation,
    floorId: DEFAULT_FLOOR_MAP.floorId,
    floorMap: DEFAULT_FLOOR_MAP,
    routingSnapshot: null,
    uiTheme: tokens,
  };
}

export const hostPreviewFloorSnapshot: FloorSnapshot = {
  floorId: DEFAULT_FLOOR_MAP.floorId,
  mapVersion: DEFAULT_FLOOR_MAP.mapVersion,
  generatedAt: now,
  sequence: 20,
  tableStateMode: 'hybrid',
  tables: Object.values(DEFAULT_FLOOR_MAP.tables).map((table, index) => ({
    tableId: table.tableId,
    backendTableId: `preview-${table.tableId}`,
    tableNumber: table.tableNumber,
    displayStatus: index % 5 === 0 ? 'reserved' : index % 3 === 0 ? 'occupied' : index % 4 === 0 ? 'dirty' : 'available',
    sensedState: index % 3 === 0 ? TableState.OCCUPIED : index % 4 === 0 ? TableState.EMPTY_DIRTY : TableState.EMPTY_CLEAN,
    stateConfidence: 0.96,
    lastStateChange: now,
    updatedAt: now,
    sequence: index + 1,
    isBlocked: false,
    override: null,
    party: index % 3 === 0 ? { id: `party-${index}`, name: ['Morgan', 'Carter', 'Patel'][index % 3] ?? 'Preview Party', size: Math.min(table.capacity, 4), source: 'walk_in' } : null,
    seatedAt: index % 3 === 0 ? new Date(Date.now() - (25 + index * 3) * 60_000).toISOString() : null,
    assignedServer: index % 2 ? 'Jordan Lee' : 'Maya Chen',
    currentWaiterId: index % 2 ? 'preview-waiter-2' : 'preview-host',
    currentWaiterName: index % 2 ? 'Jordan Lee' : 'Maya Chen',
    currentWaitlistEntryId: null,
    currentReservationId: index % 5 === 0 ? `reservation-${index}` : null,
    currentVisitId: index % 3 === 0 ? `visit-${index}` : null,
    currentPartySize: index % 3 === 0 ? Math.min(table.capacity, 4) : null,
  })),
};

function hostPreviewAnalytics(range: HostAnalyticsRange): HostShiftAnalyticsResponse {
  const hour = 60 * 60_000;
  const windowEnd = new Date().toISOString();
  const windowStart = new Date(Date.now() - (range === 'week' ? 7 * 24 : range === 'today' ? 14 : 6) * hour).toISOString();

  return {
    range,
    generatedAt: windowEnd,
    windowStart,
    windowEnd,
    summary: {
      covers: range === 'week' ? 914 : range === 'today' ? 238 : 146,
      parties: range === 'week' ? 261 : range === 'today' ? 68 : 42,
      tablesTurned: range === 'week' ? 225 : range === 'today' ? 57 : 35,
      avgTurnTimeMinutes: 58,
      peakBucketLabel: '7:00 PM',
    },
    hourly: [
      { bucketStart: new Date(Date.now() - 3 * hour).toISOString(), bucketLabel: '5 PM', covers: 18, parties: 6, tablesTurned: 5, avgTurnTimeMinutes: 52 },
      { bucketStart: new Date(Date.now() - 2 * hour).toISOString(), bucketLabel: '6 PM', covers: 37, parties: 11, tablesTurned: 9, avgTurnTimeMinutes: 56 },
      { bucketStart: new Date(Date.now() - hour).toISOString(), bucketLabel: '7 PM', covers: 54, parties: 15, tablesTurned: 13, avgTurnTimeMinutes: 61 },
      { bucketStart: windowEnd, bucketLabel: '8 PM', covers: 37, parties: 10, tablesTurned: 8, avgTurnTimeMinutes: 59 },
    ],
    waiters: [
      { waiterId: 'preview-host', waiterName: 'Maya Chen', covers: 51, tablesServed: 13, liveTables: 4, avgTurnTimeMinutes: 54, signal: 'fastest_flow' },
      { waiterId: 'preview-waiter-2', waiterName: 'Jordan Lee', covers: 47, tablesServed: 11, liveTables: 5, avgTurnTimeMinutes: 62, signal: 'load_watch' },
      { waiterId: 'preview-waiter-3', waiterName: 'Alex Morgan', covers: 48, tablesServed: 11, liveTables: 3, avgTurnTimeMinutes: 58, signal: 'steady' },
    ],
    bottlenecks: {
      longOccupiedTables: [
        {
          tableId: 'T6',
          tableLabel: 'T6',
          waiterId: 'preview-waiter-2',
          waiterName: 'Jordan Lee',
          partySize: 4,
          occupiedMinutes: 82,
          targetMinutes: 60,
          seatedAt: new Date(Date.now() - 82 * 60_000).toISOString(),
        },
      ],
    },
    insights: [
      { id: 'preview-peak', tone: 'info', title: 'Peak demand at 7 PM', detail: 'The dining room served 54 covers during the busiest hour.' },
      { id: 'preview-flow', tone: 'good', title: 'Turn time is on target', detail: 'Average table time is holding near the 60-minute service target.' },
    ],
  };
}

let waitlist = [
  ['wait-1', 'Morgan Reed', '5550101', 4, 15],
  ['wait-2', 'Taylor Lee', '5550102', 2, 20],
  ['wait-3', 'Priya Patel', '5550103', 6, 30],
  ['wait-4', 'Elena Rivera', '5550104', 3, 35],
].map(([id, name, phone, size, quote], index) => ({
  id, guest: { id: `guest-${index}`, name, phone }, partySize: size, seatingPreference: 'none',
  status: 'waiting', notes: index === 2 ? 'Patio preferred' : '', source: 'walk_in',
  joinedAt: new Date(Date.now() - (8 + index * 6) * 60_000).toISOString(), quotedWaitMinutes: quote,
  arrivedAt: null, seatedAt: null, removedAt: null, noShowAt: null, assignedTableId: null,
  createdAt: now, updatedAt: now,
}));

let reservations = [
  ['res-1', 'Avery Carter', '5550201', 4, '18:00'],
  ['res-2', 'Noah Shah', '5550202', 2, '18:30'],
  ['res-3', 'Olivia Jones', '5550203', 6, '19:00'],
  ['res-4', 'Ethan Kim', '5550204', 3, '19:15'],
].map(([id, guestName, guestPhone, partySize, timeSlot]) => ({
  id, guestName, guestPhone, partySize, date: new Date().toISOString().slice(0, 10), timeSlot,
  seatingPreference: 'none', status: 'booked', source: 'host', specialRequests: '', internalNotes: '',
  createdAt: now, updatedAt: now,
}));

function body(config: InternalAxiosRequestConfig): Record<string, any> {
  if (!config.data) return {};
  if (typeof config.data === 'string') { try { return JSON.parse(config.data); } catch { return {}; } }
  return config.data;
}

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { data, status, statusText: status === 200 ? 'OK' : 'Created', headers: {}, config };
}

const adapter: AxiosAdapter = async (config) => {
  const url = new URL(config.url ?? '/', 'https://preview.shire.local').pathname;
  const method = String(config.method ?? 'get').toLowerCase();
  const payload = body(config);

  if (url.endsWith('/bootstrap')) return response(config, hostPreviewBootstrap());
  if (url.endsWith('/waitlist') && method === 'get') return response(config, waitlist);
  if (url.endsWith('/waitlist') && method === 'post') {
    const created = { id: `wait-${Date.now()}`, guest: { id: `guest-${Date.now()}`, name: payload.guestName, phone: payload.guestPhone }, partySize: payload.partySize, seatingPreference: payload.seatingPreference ?? 'none', status: 'waiting', notes: payload.notes ?? '', source: 'walk_in', joinedAt: now, quotedWaitMinutes: payload.quotedWaitMinutes ?? null, arrivedAt: null, seatedAt: null, removedAt: null, noShowAt: null, assignedTableId: null, createdAt: now, updatedAt: now };
    waitlist = [...waitlist, created] as typeof waitlist;
    return response(config, created, 201);
  }
  const waitMatch = url.match(/\/waitlist\/([^/]+)(?:\/actions\/([^/]+))?$/);
  if (waitMatch) {
    const existing = waitlist.find((item) => item.id === waitMatch[1]) ?? waitlist[0]!;
    const updated = { ...existing, ...payload, status: waitMatch[2] === 'seat' ? 'seated' : waitMatch[2] === 'remove' ? 'removed' : waitMatch[2] === 'mark_no_show' ? 'no_show' : waitMatch[2] === 'arrive' ? 'arrived' : existing.status, updatedAt: new Date().toISOString() };
    waitlist = waitlist.map((item) => item.id === updated.id ? updated : item) as typeof waitlist;
    return response(config, updated);
  }

  if (url.endsWith('/reservations') && method === 'get') return response(config, { reservations });
  if (url.endsWith('/reservations') && method === 'post') {
    const created = { id: `res-${Date.now()}`, ...payload, date: payload.serviceDate ?? payload.date, timeSlot: payload.reservationTime ?? payload.timeSlot, status: 'booked', source: payload.source ?? 'host', createdAt: now, updatedAt: now };
    reservations = [...reservations, created] as typeof reservations;
    return response(config, created, 201);
  }
  const reservationMatch = url.match(/\/reservations\/([^/]+)(?:\/actions\/([^/]+))?$/);
  if (reservationMatch) {
    const existing = reservations.find((item) => item.id === reservationMatch[1]) ?? reservations[0]!;
    const updated = { ...existing, ...payload, status: reservationMatch[2] === 'seat' ? 'seated' : reservationMatch[2] === 'cancel' ? 'canceled' : reservationMatch[2] === 'mark_no_show' ? 'no_show' : existing.status, updatedAt: new Date().toISOString() };
    reservations = reservations.map((item) => item.id === updated.id ? updated : item) as typeof reservations;
    return response(config, updated);
  }
  if (url.includes('/reservation-density')) return response(config, { days: reservations.map((item) => ({ date: item.date, count: 1, covers: Number(item.partySize) })) });
  if (url.includes('/reservation-availability')) return response(config, { available: true, slots: ['17:30', '18:00', '18:30', '19:00', '19:30'].map((time) => ({ time, available: true })) });
  if (url.includes('/reservation-settings')) return response(config, { locationId: HOST_PREVIEW_LOCATION_ID, defaultChannel: 'host', servicePeriods: [], updatedAt: now });
  if (url.endsWith('/analytics/shift') || url.includes('/analytics/host-shift')) {
    const range = String(config.params?.range ?? 'current_shift') as HostAnalyticsRange;
    return response(config, hostPreviewAnalytics(range));
  }
  if (url.endsWith('/routing')) return response(config, { locationId: HOST_PREVIEW_LOCATION_ID, sectionAssignments: {}, activeWaiterIds: ['preview-host'], requiresSetup: false, updatedAt: now });
  if (url.endsWith('/waiters')) return response(config, { waiters: [{ id: 'preview-host', name: 'Maya Chen', role: 'manager', active: true }, { id: 'preview-waiter-2', name: 'Jordan Lee', role: 'server', active: true }] });
  if (url.includes('/messages/conversations')) return response(config, { conversations: [] });
  if (url.includes('/messages/templates')) return response(config, []);
  if (url.includes('/seating-recommendations')) return response(config, { generatedAt: now, serviceDate: now.slice(0, 10), recommendations: [] });
  return response(config, {});
};

export function installHostPreviewTransport(): void {
  apiClient.defaults.adapter = adapter;
}
