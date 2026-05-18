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
  lastAssignedAt: string | null;
}

export interface WaiterRoutingState {
  mode: WaiterRoutingMode;
  waiters: RoutingWaiter[];
  activeWaiterIds: string[];
  sectionAssignments: Record<string, string>;
  tableAssignments: Record<string, string>;
  rotationOrder: string[];
  nextWaiterId: string | null;
  nextUpByTable?: Record<string, string>;
  nextUpBySection?: Record<string, string>;
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
}
