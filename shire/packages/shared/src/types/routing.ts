export type WaiterRoutingMode = 'manual_rotation' | 'section';

export type RoutingWaiterStatus = 'available' | 'busy' | 'on_break';

export interface RoutingWaiter {
  id: string;
  name: string;
  isTemporary: boolean;
  status: RoutingWaiterStatus;
  isActive: boolean;
  assignedSectionIds: string[];
  assignedTableIds: string[];
  currentTableIds: string[];
  servedTableIds: string[];
  liveTables: number;
  servedSeatingCount: number;
  currentCovers?: number;
  recentHourCovers?: number;
  shiftClockIn?: string | null;
  gratCountToday?: number;
  lastGratAt?: string | null;
  lastAssignedAt: string | null;
}

export interface ShiftStartGroup {
  id: string;
  name: string;
  startTime: string;
  waiterIds: string[];
}

export interface NextUpQueueEntry {
  waiterId: string;
  tableIds: string[];
}

export interface RoutingSetupApproval {
  serviceDate: string;
  approvedAt: string;
  approvedByUserId?: string | null;
  startingMode: WaiterRoutingMode;
  plannedMode: WaiterRoutingMode;
  sectionPlanId?: string | null;
}

export interface RoutingSetupApprovalRequest {
  serviceDate?: string | null;
  approvedAt?: string | null;
  approvedByUserId?: string | null;
  startingMode: WaiterRoutingMode;
  plannedMode: WaiterRoutingMode;
  sectionPlanId?: string | null;
  sectionIds?: string[];
}

export interface WaiterRoutingState {
  mode: WaiterRoutingMode;
  waiters: RoutingWaiter[];
  activeWaiterIds: string[];
  sectionAssignments: Record<string, string>;
  tableAssignments: Record<string, string>;
  rotationOrder: string[];
  nextWaiterId: string | null;
  nextUpQueue?: NextUpQueueEntry[];
  nextUpByTable?: Record<string, string>;
  nextUpBySection?: Record<string, string>;
  shiftStartGroups?: ShiftStartGroup[];
  gratThreshold?: number;
  gratRotationState?: { rotationOrder?: string[] };
  nextGratWaiterId?: string | null;
  nextGratByTable?: Record<string, string>;
  nextGratBySection?: Record<string, string>;
  setupServiceDate?: string | null;
  setupApprovedAt?: string | null;
  setupApprovedByUserId?: string | null;
  setupStartingMode?: WaiterRoutingMode | null;
  setupPlannedMode?: WaiterRoutingMode | null;
  setupSectionPlanId?: string | null;
  setupApproval?: RoutingSetupApproval | null;
  requiresSetup?: boolean;
  updatedAt: string;
}

export interface WaiterRoutingUpdatePayload {
  mode: WaiterRoutingMode;
  waiters: Array<
    Pick<RoutingWaiter, 'id' | 'name' | 'isTemporary' | 'status' | 'isActive'>
  >;
  activeWaiterIds: string[];
  sectionAssignments: Record<string, string>;
  tableAssignments: Record<string, string>;
  rotationOrder: string[];
  nextWaiterId: string | null;
  shiftStartGroups?: ShiftStartGroup[];
  gratThreshold?: number;
  gratRotationState?: { rotationOrder?: string[] };
  setupApproval?: RoutingSetupApprovalRequest;
}
