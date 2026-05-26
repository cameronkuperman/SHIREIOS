import { create } from 'zustand';
import type {
  FloorMap,
  FloorSnapshot,
  Reservation,
  TableLiveState,
  WaiterRoutingState,
  WaitlistEntry,
} from '@shire/shared';
import { useFloorStore } from '@/features/floor';
import { useWaiterRoutingStore } from '@/features/routing';
import type { HostAnalyticsRange, HostShiftAnalyticsResponse, ReservationListFilters } from './api';

type PricingTone = 'raise' | 'lower' | 'promote';

export type MimosasPricingRecommendation = {
  id: string;
  item: string;
  action: string;
  tone: PricingTone;
  confidence: number;
  weeklyLift: number;
  coversAffected: number;
  reasoningTrace: {
    demand: string;
    floorCapacity: string;
    kitchenLoad: string;
    marginImpact: string;
    guardrail: string;
  };
};

export type MimosasFloorSignal = {
  tableLabel: string;
  status: string;
  owner: string;
  detail: string;
};

type MimosasScenarioStore = {
  isActive: boolean;
  activate: () => void;
  reset: () => void;
};

const NOW = Date.now();
const TODAY = new Date(NOW).toISOString().slice(0, 10);

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function minutesFromNow(minutes: number): string {
  return new Date(NOW + minutes * 60_000).toISOString();
}

function todayAt(hours: number, minutes: number): string {
  const date = new Date(NOW);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function allocateCounts(total: number, weights: number[]): number[] {
  const raw = weights.map((weight) => total * weight);
  const counts = raw.map(Math.floor);
  let remainder = total - counts.reduce((sum, count) => sum + count, 0);
  const order = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder);

  for (const item of order) {
    if (remainder <= 0) break;
    counts[item.index] = (counts[item.index] ?? 0) + 1;
    remainder -= 1;
  }

  return counts;
}

function baseTable(
  tableId: string,
  displayStatus: TableLiveState['displayStatus'],
  options: Partial<TableLiveState> = {},
): TableLiveState {
  return {
    tableId,
    backendTableId: tableId,
    tableNumber: tableId,
    displayStatus,
    sensedState:
      displayStatus === 'dirty'
        ? 'empty_dirty'
        : displayStatus === 'occupied'
          ? 'occupied'
          : 'empty_clean',
    stateConfidence: options.stateConfidence ?? 0.94,
    lastStateChange: options.lastStateChange ?? minutesAgo(8),
    updatedAt: options.updatedAt ?? minutesAgo(1),
    sequence: options.sequence ?? Number(tableId.replace(/\D/g, '') || 0),
    isBlocked: options.isBlocked ?? false,
    override: null,
    party: null,
    seatedAt: null,
    assignedServer: options.assignedServer ?? null,
    currentWaiterId: null,
    currentWaiterName: null,
    currentWaitlistEntryId: null,
    currentReservationId: null,
    currentVisitId: null,
    currentPartySize: null,
    lastUpdateSource: 'ml',
    hostIntentState: null,
    hostIntentUntil: null,
    hostIntentCommandId: null,
    mlSuppressedReason: null,
    emittedAt: minutesAgo(1),
    ...options,
  };
}

export const MIMOSAS_FLOOR_MAP: FloorMap = {
  floorId: 'mimosas-main-floor',
  mapVersion: 'mimosas-shift-v1',
  activeSectionPlanId: 'mimosas-five-server',
  rooms: [
    {
      roomId: 'main-room',
      label: 'MAIN ROOM',
      filterLabel: 'Main Room',
      flex: 1,
      variant: 'default',
      rows: [
        ['1', '2', '3', '4'],
        ['5', '6', '7', '8'],
        ['9', '10', '11', '12'],
      ],
    },
    {
      roomId: 'patio-room',
      label: 'PATIO',
      filterLabel: 'Patio',
      flex: 0.42,
      variant: 'patio',
      rows: [
        ['13', '14'],
        ['15', '16'],
      ],
    },
  ],
  sectionPlans: [
    {
      planId: 'mimosas-five-server',
      name: 'Dinner - five servers',
      waiterCount: 5,
      isDefault: true,
      sections: [
        { sectionId: 'Blue', tableIds: ['4', '10', '11'] },
        { sectionId: 'Red', tableIds: ['1', '2', '5'] },
        { sectionId: 'Green', tableIds: ['3', '6', '7'] },
        { sectionId: 'Gold', tableIds: ['8', '9', '12'] },
        { sectionId: 'Patio', tableIds: ['13', '14', '15', '16'] },
      ],
    },
  ],
  tables: {
    '1': {
      tableId: '1',
      tableNumber: '1',
      roomId: 'main-room',
      section: 'Red',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
      assignedServer: 'Sarah',
    },
    '2': {
      tableId: '2',
      tableNumber: '2',
      roomId: 'main-room',
      section: 'Red',
      capacity: 2,
      shape: 'circle',
      type: 'regular',
      assignedServer: 'Sarah',
    },
    '3': {
      tableId: '3',
      tableNumber: '3',
      roomId: 'main-room',
      section: 'Green',
      capacity: 4,
      shape: 'square',
      type: 'regular',
      assignedServer: 'Maria',
    },
    '4': {
      tableId: '4',
      tableNumber: '4',
      roomId: 'main-room',
      section: 'Blue',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
      assignedServer: 'Joe',
    },
    '5': {
      tableId: '5',
      tableNumber: '5',
      roomId: 'main-room',
      section: 'Red',
      capacity: 6,
      shape: 'horizontal',
      type: 'booth',
      assignedServer: 'Sarah',
    },
    '6': {
      tableId: '6',
      tableNumber: '6',
      roomId: 'main-room',
      section: 'Green',
      capacity: 2,
      shape: 'square',
      type: 'regular',
      assignedServer: 'Maria',
    },
    '7': {
      tableId: '7',
      tableNumber: '7',
      roomId: 'main-room',
      section: 'Green',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
      assignedServer: 'Maria',
    },
    '8': {
      tableId: '8',
      tableNumber: '8',
      roomId: 'main-room',
      section: 'Gold',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
      assignedServer: 'Tyler',
    },
    '9': {
      tableId: '9',
      tableNumber: '9',
      roomId: 'main-room',
      section: 'Gold',
      capacity: 8,
      shape: 'horizontal',
      type: 'booth',
      assignedServer: 'Tyler',
    },
    '10': {
      tableId: '10',
      tableNumber: '10',
      roomId: 'main-room',
      section: 'Blue',
      capacity: 2,
      shape: 'circle',
      type: 'regular',
      assignedServer: 'Joe',
    },
    '11': {
      tableId: '11',
      tableNumber: '11',
      roomId: 'main-room',
      section: 'Blue',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
      assignedServer: 'Joe',
    },
    '12': {
      tableId: '12',
      tableNumber: '12',
      roomId: 'main-room',
      section: 'Gold',
      capacity: 4,
      shape: 'square',
      type: 'regular',
      assignedServer: 'Tyler',
    },
    '13': {
      tableId: '13',
      tableNumber: '13',
      roomId: 'patio-room',
      section: 'Patio',
      capacity: 4,
      shape: 'square',
      type: 'outdoor',
      assignedServer: 'Alex',
    },
    '14': {
      tableId: '14',
      tableNumber: '14',
      roomId: 'patio-room',
      section: 'Patio',
      capacity: 2,
      shape: 'circle',
      type: 'outdoor',
      assignedServer: 'Alex',
    },
    '15': {
      tableId: '15',
      tableNumber: '15',
      roomId: 'patio-room',
      section: 'Patio',
      capacity: 4,
      shape: 'square',
      type: 'outdoor',
      assignedServer: 'Alex',
    },
    '16': {
      tableId: '16',
      tableNumber: '16',
      roomId: 'patio-room',
      section: 'Patio',
      capacity: 6,
      shape: 'horizontal',
      type: 'outdoor',
      assignedServer: 'Alex',
    },
  },
};

const TABLE_STATES: TableLiveState[] = [
  baseTable('1', 'occupied', {
    assignedServer: 'Sarah',
    currentWaiterId: 'waiter-sarah',
    currentWaiterName: 'Sarah',
    currentPartySize: 4,
    seatedAt: minutesAgo(34),
    party: { id: 'visit-table-1', name: 'Davis', size: 4, source: 'reservations' },
  }),
  baseTable('2', 'occupied', {
    assignedServer: 'Sarah',
    currentWaiterId: 'waiter-sarah',
    currentWaiterName: 'Sarah',
    currentPartySize: 2,
    seatedAt: minutesAgo(51),
    party: { id: 'visit-table-2', name: 'Nguyen', size: 2, source: 'walk_in' },
  }),
  baseTable('3', 'reserved', {
    assignedServer: 'Maria',
    stateConfidence: 0.91,
    lastStateChange: minutesAgo(3),
  }),
  baseTable('4', 'available', {
    assignedServer: 'Joe',
    stateConfidence: 0.98,
    lastStateChange: minutesAgo(5),
  }),
  baseTable('5', 'occupied', {
    assignedServer: 'Sarah',
    currentWaiterId: 'waiter-sarah',
    currentWaiterName: 'Sarah',
    currentPartySize: 5,
    seatedAt: minutesAgo(29),
    party: { id: 'visit-table-5', name: 'Miller', size: 5, source: 'reservations' },
  }),
  baseTable('6', 'available', {
    assignedServer: 'Maria',
    lastStateChange: minutesAgo(4),
  }),
  baseTable('7', 'occupied', {
    assignedServer: 'Maria',
    currentWaiterId: 'waiter-maria',
    currentWaiterName: 'Maria',
    currentPartySize: 4,
    seatedAt: minutesAgo(41),
    party: { id: 'visit-table-7', name: 'Patel', size: 4, source: 'reservations' },
  }),
  baseTable('8', 'occupied', {
    assignedServer: 'Tyler',
    currentWaiterId: 'waiter-tyler',
    currentWaiterName: 'Tyler',
    currentPartySize: 4,
    seatedAt: minutesAgo(72),
    party: { id: 'visit-table-8', name: 'Kim', size: 4, source: 'walk_in' },
  }),
  baseTable('9', 'available', {
    assignedServer: 'Tyler',
    lastStateChange: minutesAgo(2),
  }),
  baseTable('10', 'occupied', {
    assignedServer: 'Joe',
    currentWaiterId: 'waiter-joe',
    currentWaiterName: 'Joe',
    currentPartySize: 2,
    seatedAt: minutesAgo(18),
    party: { id: 'visit-table-10', name: 'Brooks', size: 2, source: 'reservations' },
  }),
  baseTable('11', 'available', {
    assignedServer: 'Joe',
    lastStateChange: minutesAgo(7),
  }),
  baseTable('12', 'dirty', {
    assignedServer: 'Tyler',
    lastStateChange: minutesAgo(6),
  }),
  baseTable('13', 'occupied', {
    assignedServer: 'Alex',
    currentWaiterId: 'waiter-alex',
    currentWaiterName: 'Alex',
    currentPartySize: 4,
    seatedAt: minutesAgo(58),
    party: { id: 'visit-table-13', name: 'Lopez', size: 4, source: 'reservations' },
  }),
  baseTable('14', 'available', {
    assignedServer: 'Alex',
    lastStateChange: minutesAgo(12),
  }),
  baseTable('15', 'dirty', {
    assignedServer: 'Alex',
    lastStateChange: minutesAgo(9),
  }),
  baseTable('16', 'occupied', {
    assignedServer: 'Alex',
    currentWaiterId: 'waiter-alex',
    currentWaiterName: 'Alex',
    currentPartySize: 6,
    seatedAt: minutesAgo(33),
    party: { id: 'visit-table-16', name: 'Harper', size: 6, source: 'reservations' },
  }),
];

export const MIMOSAS_WAITLIST: WaitlistEntry[] = [
  {
    id: 'mimosas-wait-rivera',
    guest: { id: 'guest-rivera', name: 'Rivera', phone: '555-0114' },
    partySize: 4,
    seatingPreference: 'none',
    status: 'arrived',
    notes: 'Walk-in at host stand',
    source: 'walk_in',
    joinedAt: minutesAgo(4),
    quotedWaitMinutes: 8,
    arrivedAt: minutesAgo(3),
    seatedAt: null,
    removedAt: null,
    noShowAt: null,
    assignedTableId: null,
    createdAt: minutesAgo(4),
    updatedAt: minutesAgo(1),
  },
  {
    id: 'mimosas-wait-chen',
    guest: { id: 'guest-chen', name: 'Chen', phone: '555-0188' },
    partySize: 2,
    seatingPreference: 'bar',
    status: 'waiting',
    notes: 'Prefers a quick drink first',
    source: 'walk_in',
    joinedAt: minutesAgo(12),
    quotedWaitMinutes: 10,
    arrivedAt: null,
    seatedAt: null,
    removedAt: null,
    noShowAt: null,
    assignedTableId: null,
    createdAt: minutesAgo(12),
    updatedAt: minutesAgo(2),
  },
  {
    id: 'mimosas-wait-thompson',
    guest: { id: 'guest-thompson', name: 'Thompson', phone: '555-0136' },
    partySize: 6,
    seatingPreference: 'booth',
    status: 'waiting',
    notes: 'Birthday note on profile',
    source: 'walk_in',
    joinedAt: minutesAgo(18),
    quotedWaitMinutes: 22,
    arrivedAt: null,
    seatedAt: null,
    removedAt: null,
    noShowAt: null,
    assignedTableId: null,
    createdAt: minutesAgo(18),
    updatedAt: minutesAgo(3),
  },
];

export const MIMOSAS_RESERVATIONS: Reservation[] = [
  {
    id: 'mimosas-rsv-adams',
    guestId: null,
    guest: null,
    guestName: 'Adams',
    guestPhone: '555-0105',
    partySize: 4,
    date: TODAY,
    timeSlot: '19:15',
    seatingPreference: 'window',
    status: 'checked_in',
    notes: 'Anniversary',
    specialRequests: 'Window if possible',
    internalNotes: 'Course pacing should stay tight',
    source: 'host_dashboard',
    linkedVisitId: null,
    assignedTableId: null,
    suggestedTableId: '11',
    pacingOverrideApplied: false,
    createdAt: minutesAgo(90),
    updatedAt: minutesAgo(3),
    confirmedAt: minutesAgo(80),
    checkedInAt: minutesAgo(3),
    seatedAt: null,
    completedAt: null,
    canceledAt: null,
    noShowAt: null,
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    messageDelivery: null,
  },
  {
    id: 'mimosas-rsv-morales',
    guestId: null,
    guest: null,
    guestName: 'Morales',
    guestPhone: '555-0140',
    partySize: 2,
    date: TODAY,
    timeSlot: '19:30',
    seatingPreference: 'none',
    status: 'confirmed',
    notes: '',
    specialRequests: '',
    internalNotes: 'Likely prix fixe',
    source: 'google_business_profile',
    linkedVisitId: null,
    assignedTableId: null,
    suggestedTableId: '14',
    pacingOverrideApplied: false,
    createdAt: minutesAgo(220),
    updatedAt: minutesAgo(30),
    confirmedAt: minutesAgo(210),
    checkedInAt: null,
    seatedAt: null,
    completedAt: null,
    canceledAt: null,
    noShowAt: null,
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    messageDelivery: null,
  },
  {
    id: 'mimosas-rsv-williams',
    guestId: null,
    guest: null,
    guestName: 'Williams',
    guestPhone: '555-0177',
    partySize: 5,
    date: TODAY,
    timeSlot: '19:45',
    seatingPreference: 'booth',
    status: 'booked',
    notes: 'High chair',
    specialRequests: 'High chair',
    internalNotes: 'Seat after table 9 resets',
    source: 'website_widget',
    linkedVisitId: null,
    assignedTableId: null,
    suggestedTableId: '9',
    pacingOverrideApplied: false,
    createdAt: minutesAgo(180),
    updatedAt: minutesAgo(40),
    confirmedAt: null,
    checkedInAt: null,
    seatedAt: null,
    completedAt: null,
    canceledAt: null,
    noShowAt: null,
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    messageDelivery: null,
  },
];

export const MIMOSAS_ROUTING: WaiterRoutingState = {
  mode: 'section',
  waiters: [
    {
      id: 'waiter-joe',
      name: 'Joe',
      isTemporary: false,
      status: 'available',
      isActive: true,
      assignedSectionIds: ['Blue'],
      assignedTableIds: ['4', '10', '11'],
      currentTableIds: ['10'],
      servedTableIds: ['10'],
      liveTables: 1,
      servedSeatingCount: 1,
      currentCovers: 2,
      recentHourCovers: 6,
      shiftClockIn: minutesAgo(180),
      gratCountToday: 0,
      lastGratAt: null,
      lastAssignedAt: minutesAgo(23),
    },
    {
      id: 'waiter-sarah',
      name: 'Sarah',
      isTemporary: false,
      status: 'busy',
      isActive: true,
      assignedSectionIds: ['Red'],
      assignedTableIds: ['1', '2', '5'],
      currentTableIds: ['1', '2', '5'],
      servedTableIds: ['1', '2', '5'],
      liveTables: 3,
      servedSeatingCount: 3,
      currentCovers: 11,
      recentHourCovers: 18,
      shiftClockIn: minutesAgo(180),
      gratCountToday: 1,
      lastGratAt: minutesAgo(44),
      lastAssignedAt: minutesAgo(8),
    },
    {
      id: 'waiter-maria',
      name: 'Maria',
      isTemporary: false,
      status: 'available',
      isActive: true,
      assignedSectionIds: ['Green'],
      assignedTableIds: ['3', '6', '7'],
      currentTableIds: ['7'],
      servedTableIds: ['3', '7'],
      liveTables: 1,
      servedSeatingCount: 2,
      currentCovers: 4,
      recentHourCovers: 12,
      shiftClockIn: minutesAgo(180),
      gratCountToday: 0,
      lastGratAt: null,
      lastAssignedAt: minutesAgo(12),
    },
    {
      id: 'waiter-tyler',
      name: 'Tyler',
      isTemporary: false,
      status: 'busy',
      isActive: true,
      assignedSectionIds: ['Gold'],
      assignedTableIds: ['8', '9', '12'],
      currentTableIds: ['8'],
      servedTableIds: ['8', '12'],
      liveTables: 1,
      servedSeatingCount: 2,
      currentCovers: 4,
      recentHourCovers: 14,
      shiftClockIn: minutesAgo(180),
      gratCountToday: 0,
      lastGratAt: null,
      lastAssignedAt: minutesAgo(15),
    },
    {
      id: 'waiter-alex',
      name: 'Alex',
      isTemporary: false,
      status: 'busy',
      isActive: true,
      assignedSectionIds: ['Patio'],
      assignedTableIds: ['13', '14', '15', '16'],
      currentTableIds: ['13', '16'],
      servedTableIds: ['13', '15', '16'],
      liveTables: 2,
      servedSeatingCount: 3,
      currentCovers: 10,
      recentHourCovers: 16,
      shiftClockIn: minutesAgo(180),
      gratCountToday: 1,
      lastGratAt: minutesAgo(71),
      lastAssignedAt: minutesAgo(10),
    },
  ],
  activeWaiterIds: ['waiter-joe', 'waiter-sarah', 'waiter-maria', 'waiter-tyler', 'waiter-alex'],
  sectionAssignments: {
    Blue: 'waiter-joe',
    Red: 'waiter-sarah',
    Green: 'waiter-maria',
    Gold: 'waiter-tyler',
    Patio: 'waiter-alex',
  },
  tableAssignments: {},
  rotationOrder: ['waiter-joe', 'waiter-maria', 'waiter-tyler', 'waiter-alex', 'waiter-sarah'],
  nextWaiterId: 'waiter-joe',
  nextUpQueue: [
    { waiterId: 'waiter-joe', tableIds: ['4', '11'] },
    { waiterId: 'waiter-maria', tableIds: ['6'] },
    { waiterId: 'waiter-tyler', tableIds: ['9'] },
    { waiterId: 'waiter-alex', tableIds: ['14'] },
    { waiterId: 'waiter-sarah', tableIds: [] },
  ],
  nextUpByTable: {
    '4': 'waiter-joe',
    '11': 'waiter-joe',
    '6': 'waiter-maria',
    '9': 'waiter-tyler',
    '14': 'waiter-alex',
  },
  nextUpBySection: {
    Blue: 'waiter-joe',
    Green: 'waiter-maria',
    Gold: 'waiter-tyler',
    Patio: 'waiter-alex',
    Red: 'waiter-sarah',
  },
  shiftStartGroups: [
    {
      id: 'dinner-open',
      name: 'Dinner team',
      startTime: minutesAgo(180),
      waiterIds: ['waiter-joe', 'waiter-sarah', 'waiter-maria', 'waiter-tyler', 'waiter-alex'],
    },
  ],
  gratThreshold: 6,
  gratRotationState: { rotationOrder: ['waiter-sarah', 'waiter-alex', 'waiter-joe'] },
  nextGratWaiterId: 'waiter-joe',
  nextGratByTable: { '9': 'waiter-joe', '16': 'waiter-joe' },
  nextGratBySection: { Blue: 'waiter-joe' },
  setupServiceDate: TODAY,
  setupApprovedAt: minutesAgo(210),
  setupApprovedByUserId: 'mimosas-manager',
  setupStartingMode: 'section',
  setupPlannedMode: 'section',
  setupSectionPlanId: 'mimosas-five-server',
  setupApproval: {
    serviceDate: TODAY,
    approvedAt: minutesAgo(210),
    approvedByUserId: 'mimosas-manager',
    startingMode: 'section',
    plannedMode: 'section',
    sectionPlanId: 'mimosas-five-server',
  },
  requiresSetup: false,
  updatedAt: minutesAgo(1),
};

export const MIMOSAS_PRICING_RECOMMENDATIONS: MimosasPricingRecommendation[] = [
  {
    id: 'salmon-plus-two',
    item: 'Citrus salmon',
    action: 'Review price position',
    tone: 'raise',
    confidence: 91,
    weeklyLift: 740,
    coversAffected: 64,
    reasoningTrace: {
      demand: 'Salmon attach rate is 24% above the four-week Tuesday baseline.',
      floorCapacity: 'Historically performs best when four-top demand is above baseline.',
      kitchenLoad: 'Prep and station load can support higher mix without slowing service.',
      marginImpact: 'A modest menu price move preserves conversion and improves item margin.',
      guardrail: 'Review guest feedback and substitution rate before changing printed menus.',
    },
  },
  {
    id: 'house-red-minus-fifty',
    item: 'House red',
    action: 'Reposition by-the-glass',
    tone: 'lower',
    confidence: 84,
    weeklyLift: 310,
    coversAffected: 41,
    reasoningTrace: {
      demand: 'Wine-by-glass attach rate trails comparable dinner periods.',
      floorCapacity: 'Shorter two-top visits create room for faster beverage conversion.',
      kitchenLoad: 'No kitchen dependency; bar throughput remains strong.',
      marginImpact: 'A small positioning move can recover glass volume without hurting bottles.',
      guardrail: 'Keep happy-hour, comps, and bottle promotions separate.',
    },
  },
  {
    id: 'prix-fixe-push',
    item: 'Dinner prix fixe',
    action: 'Feature on peak nights',
    tone: 'promote',
    confidence: 88,
    weeklyLift: 1180,
    coversAffected: 52,
    reasoningTrace: {
      demand: 'Reservation mix shows strong party-size fit for two- and four-top pacing.',
      floorCapacity: 'Best fit is high-demand dinner services with predictable turn cadence.',
      kitchenLoad: 'Expo can handle the feature when orders are batched into a fixed flow.',
      marginImpact: 'Expected check lift is $9.40 per affected cover.',
      guardrail: 'Do not feature it on services where expo or prep is already constrained.',
    },
  },
];

export const MIMOSAS_FLOOR_SIGNALS: MimosasFloorSignal[] = [
  {
    tableLabel: '4',
    status: 'Open now',
    owner: 'Joe',
    detail: 'Best party-of-4 fit with the lightest live section.',
  },
  {
    tableLabel: '8',
    status: 'Check-ready',
    owner: 'Tyler',
    detail: 'Camera sees cleared plates and payment posture; likely turn in 8 minutes.',
  },
  {
    tableLabel: '12',
    status: 'Dirty 6m',
    owner: 'Tyler',
    detail: 'Clear task should recover a four-top before the 7:30 reservation wave.',
  },
  {
    tableLabel: '15',
    status: 'Dirty 9m',
    owner: 'Alex',
    detail: 'Patio demand is softer, keep inside turns ahead of patio reset.',
  },
];

export const MIMOSAS_OPPORTUNITY_SUMMARY = {
  recoveredTonight: 486,
  revenueAtRisk: 312,
  expectedWeeklyLift: 2230,
  utilization: '87%',
  capacityOpening: '18 covers in next 22m',
  turnRisk: '2 tables need action',
  waitingOnCheck: '3 tables',
  readyToOrder: '2 tables',
  nextTurns: '2 in 12m',
};

function analyticsForRange(range: HostAnalyticsRange): HostShiftAnalyticsResponse {
  const nowMs = Date.now();
  const multiplier = range === 'week' ? 6.4 : range === 'today' ? 1.8 : 1;
  const hourly = [
    {
      bucketStart: todayAt(15, 30),
      bucketLabel: '3:30 PM',
      covers: Math.round(4 * multiplier),
      parties: Math.round(1 * multiplier),
      tablesTurned: Math.round(1 * multiplier),
      avgTurnTimeMinutes: 54,
    },
    {
      bucketStart: todayAt(16, 0),
      bucketLabel: '4:00 PM',
      covers: Math.round(12 * multiplier),
      parties: Math.round(4 * multiplier),
      tablesTurned: Math.round(1 * multiplier),
      avgTurnTimeMinutes: 58,
    },
    {
      bucketStart: todayAt(16, 30),
      bucketLabel: '4:30 PM',
      covers: Math.round(18 * multiplier),
      parties: Math.round(5 * multiplier),
      tablesTurned: 0,
      avgTurnTimeMinutes: null,
    },
    {
      bucketStart: todayAt(17, 0),
      bucketLabel: '5:00 PM',
      covers: Math.round(21 * multiplier),
      parties: Math.round(6 * multiplier),
      tablesTurned: Math.round(1 * multiplier),
      avgTurnTimeMinutes: 60,
    },
    {
      bucketStart: todayAt(17, 30),
      bucketLabel: '5:30 PM',
      covers: Math.round(28 * multiplier),
      parties: Math.round(8 * multiplier),
      tablesTurned: Math.round(3 * multiplier),
      avgTurnTimeMinutes: 63,
    },
    {
      bucketStart: todayAt(18, 0),
      bucketLabel: '6:00 PM',
      covers: Math.round(34 * multiplier),
      parties: Math.round(10 * multiplier),
      tablesTurned: Math.round(5 * multiplier),
      avgTurnTimeMinutes: 66,
    },
  ];
  const visibleRows = hourly.filter((row) => new Date(row.bucketStart).getTime() <= nowMs);
  const summaryRows = visibleRows;
  const summaryCovers = summaryRows.reduce((sum, row) => sum + row.covers, 0);
  const summaryParties = summaryRows.reduce((sum, row) => sum + row.parties, 0);
  const summaryTurns = summaryRows.reduce((sum, row) => sum + row.tablesTurned, 0);
  const avgTurnRows = summaryRows.filter((row) => row.avgTurnTimeMinutes != null);
  const avgTurnTimeMinutes =
    avgTurnRows.length > 0
      ? Math.round(
          avgTurnRows.reduce((sum, row) => sum + (row.avgTurnTimeMinutes ?? 0), 0) /
            avgTurnRows.length,
        )
      : null;
  const peakRow = summaryRows.reduce<(typeof hourly)[number] | null>(
    (peak, row) => (!peak || row.covers > peak.covers ? row : peak),
    null,
  );
  const waiterCovers = allocateCounts(summaryCovers, [0.18, 0.32, 0.21, 0.18, 0.11]);
  const waiterTables = allocateCounts(summaryParties, [0.2, 0.3, 0.2, 0.18, 0.12]);

  return {
    range,
    generatedAt: new Date(nowMs).toISOString(),
    windowStart: range === 'week' ? minutesAgo(7 * 24 * 60) : todayAt(15, 30),
    windowEnd: todayAt(21, 0),
    summary: {
      covers: summaryCovers,
      parties: summaryParties,
      tablesTurned: summaryTurns,
      avgTurnTimeMinutes: range === 'week' ? 70 : avgTurnTimeMinutes,
      peakBucketLabel: peakRow?.bucketLabel ?? null,
    },
    hourly: visibleRows,
    waiters: [
      {
        waiterId: 'waiter-joe',
        waiterName: 'Joe',
        covers: waiterCovers[0] ?? 0,
        tablesServed: waiterTables[0] ?? 0,
        liveTables: 1,
        avgTurnTimeMinutes: 63,
        signal: 'fastest_flow',
      },
      {
        waiterId: 'waiter-sarah',
        waiterName: 'Sarah',
        covers: waiterCovers[1] ?? 0,
        tablesServed: waiterTables[1] ?? 0,
        liveTables: 3,
        avgTurnTimeMinutes: 76,
        signal: 'load_watch',
      },
      {
        waiterId: 'waiter-maria',
        waiterName: 'Maria',
        covers: waiterCovers[2] ?? 0,
        tablesServed: waiterTables[2] ?? 0,
        liveTables: 1,
        avgTurnTimeMinutes: 68,
        signal: 'steady',
      },
      {
        waiterId: 'waiter-tyler',
        waiterName: 'Tyler',
        covers: waiterCovers[3] ?? 0,
        tablesServed: waiterTables[3] ?? 0,
        liveTables: 1,
        avgTurnTimeMinutes: 73,
        signal: 'needs_support',
      },
      {
        waiterId: 'waiter-alex',
        waiterName: 'Alex',
        covers: waiterCovers[4] ?? 0,
        tablesServed: waiterTables[4] ?? 0,
        liveTables: 2,
        avgTurnTimeMinutes: 70,
        signal: 'steady',
      },
    ],
    bottlenecks: {
      longOccupiedTables: [
        {
          tableId: '8',
          tableLabel: '8',
          waiterId: 'waiter-tyler',
          waiterName: 'Tyler',
          partySize: 4,
          occupiedMinutes: 72,
          targetMinutes: 64,
          seatedAt: minutesAgo(72),
        },
        {
          tableId: '13',
          tableLabel: '13',
          waiterId: 'waiter-alex',
          waiterName: 'Alex',
          partySize: 4,
          occupiedMinutes: 58,
          targetMinutes: 54,
          seatedAt: minutesAgo(58),
        },
      ],
    },
    insights: [
      {
        id: 'joe-next',
        tone: 'good',
        title: 'Seat the Rivera party at T4',
        detail: 'Joe has the lightest live section and T4 is the clean four-top with best fit.',
      },
      {
        id: 'dirty-recovery',
        tone: 'watch',
        title: 'Recover two dirty tables',
        detail: 'T12 and T15 represent 8 covers of near-term capacity.',
      },
      {
        id: 'pricing-window',
        tone: 'info',
        title: 'Menu opportunities are active',
        detail: 'Historical demand supports a salmon review and prix fixe feature.',
      },
    ],
  };
}

export const useMimosasScenarioStore = create<MimosasScenarioStore>((set) => ({
  isActive: false,
  activate: () => set({ isActive: true }),
  reset: () => set({ isActive: false }),
}));

export function activateMimosasScenario(locationId: string) {
  const floorStore = useFloorStore.getState();
  floorStore.setFloorMap(MIMOSAS_FLOOR_MAP);
  floorStore.applySnapshot(MIMOSAS_FLOOR_SNAPSHOT);
  floorStore.setConnectionState('connected');
  floorStore.setTableStateMode('hybrid');

  useWaiterRoutingStore.getState().applyRouting(locationId, MIMOSAS_ROUTING);
  useMimosasScenarioStore.getState().activate();
}

export function getMimosasWaitlist(): WaitlistEntry[] {
  return MIMOSAS_WAITLIST;
}

export function getMimosasReservations(filters: ReservationListFilters = {}): Reservation[] {
  return MIMOSAS_RESERVATIONS.filter((reservation) => {
    if (filters.date && reservation.date !== filters.date) return false;
    if (filters.status && filters.status !== 'all' && reservation.status !== filters.status) {
      return false;
    }
    if (!filters.includeArchived && reservation.archivedAt) return false;
    if (filters.search) {
      const query = filters.search.trim().toLowerCase();
      if (
        query &&
        !`${reservation.guestName} ${reservation.guestPhone} ${reservation.notes}`
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
    }
    return true;
  });
}

export function getMimosasShiftAnalytics(range: HostAnalyticsRange): HostShiftAnalyticsResponse {
  return analyticsForRange(range);
}

export const MIMOSAS_FLOOR_SNAPSHOT: FloorSnapshot = {
  floorId: MIMOSAS_FLOOR_MAP.floorId,
  mapVersion: MIMOSAS_FLOOR_MAP.mapVersion,
  generatedAt: new Date(NOW).toISOString(),
  sequence: 9001,
  tables: TABLE_STATES,
  routingSnapshot: MIMOSAS_ROUTING,
  tableStateMode: 'hybrid',
};
