import type { BusinessRuleError, WaitlistEntry } from "./host.ts";
import type { WaiterRoutingState } from "./routing.ts";

export const TableState = {
  EMPTY_CLEAN: "empty_clean",
  OCCUPIED: "occupied",
  EMPTY_DIRTY: "empty_dirty",
} as const;

export type TableState = (typeof TableState)[keyof typeof TableState];

export type TableDisplayStatus =
  | "available"
  | "occupied"
  | "dirty"
  | "reserved";
export type FloorTableStateMode = "hybrid" | "manual" | "cctv";
export type TableShape = "circle" | "square" | "horizontal";
export type TableType =
  | "regular"
  | "high-top"
  | "counter"
  | "bar"
  | "outdoor"
  | "booth";
export type PartySource = "waitlist" | "reservations" | "walk_in" | "manual";
export type TableCommandType =
  | "seat_party"
  | "seat_walk_in"
  | "clear_table"
  | "mark_dirty"
  | "mark_clean"
  | "set_table_state"
  | "block_table"
  | "unblock_table";
export type TableUpdateSource = "host" | "ml";
export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface Table {
  tableId: string;
  section: string;
  capacity: number;
  type: TableType;
  predictedState: TableState;
  stateConfidence: number;
  lastStateChange: string;
  isBlocked: boolean;
}

export interface FloorMapTable {
  tableId: string;
  tableNumber: string;
  roomId: string;
  section: string;
  capacity: number;
  shape: TableShape;
  type: TableType;
  assignedServer?: string | null;
  x?: number;        // normalized 0–1 position on canvas
  y?: number;        // normalized 0–1 position on canvas
  rotation?: number; // degrees, default 0
  width?: number;    // custom width in px (builder-canvas space); default by shape
  height?: number;   // custom height in px (builder-canvas space); default by shape
}

export interface FloorMapRoom {
  roomId: string;
  label: string;
  filterLabel: string;
  flex?: number;
  variant?: "default" | "patio";
  rows: string[][];
  layoutMode?: "grid" | "freeform"; // default 'grid' for backward compat
}

export interface FloorMapSectionDefinition {
  sectionId: string;
  tableIds: string[];
}

export interface FloorMapSectionPlan {
  planId: string;
  name: string;
  waiterCount: number;
  sections: FloorMapSectionDefinition[];
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FloorMap {
  floorId: string;
  mapVersion: string;
  rooms: FloorMapRoom[];
  tables: Record<string, FloorMapTable>;
  sectionPlans?: FloorMapSectionPlan[];
  activeSectionPlanId?: string | null;
  /** Saved canvas zoom level (1 = 100%). Set in the Floor Map Builder. */
  zoom?: number;
  /** Builder canvas width the layout was designed against (for proportional rendering). */
  canvasWidth?: number;
  /** Builder canvas height the layout was designed against (for proportional rendering). */
  canvasHeight?: number;
}

export interface TableParty {
  id: string;
  name: string;
  size: number;
  source: PartySource;
}

export interface TableOverride {
  source: "host";
  commandType: TableCommandType;
  createdAt: string;
  active: boolean;
}

export interface TableLiveState {
  tableId: string;
  tableNumber?: string;
  displayStatus: TableDisplayStatus;
  sensedState: TableState;
  stateConfidence: number;
  lastStateChange: string;
  updatedAt: string;
  sequence: number;
  isBlocked: boolean;
  override: TableOverride | null;
  party: TableParty | null;
  seatedAt: string | null;
  assignedServer?: string | null;
  currentWaiterId?: string | null;
  currentWaiterName?: string | null;
  currentWaitlistEntryId?: string | null;
  currentReservationId?: string | null;
  currentVisitId?: string | null;
  currentPartySize?: number | null;
  lastUpdateSource?: TableUpdateSource | null;
  hostIntentState?: TableDisplayStatus | null;
  hostIntentUntil?: string | null;
  hostIntentCommandId?: string | null;
  mlSuppressedReason?: string | null;
  emittedAt?: string | null;
}

export interface FloorSnapshot {
  floorId: string;
  mapVersion: string;
  generatedAt: string;
  sequence: number;
  tables: TableLiveState[];
  routingSnapshot?: WaiterRoutingState | null;
  tableStateMode?: FloorTableStateMode;
}

interface BaseTableCommand {
  commandId: string;
  floorId: string;
  tableId: string;
  requestedAt: string;
}

export interface SeatTableCommand extends BaseTableCommand {
  type: "seat_party" | "seat_walk_in";
  party: TableParty;
  waiterId?: string;
}

export interface ClearTableCommand extends BaseTableCommand {
  type: "clear_table";
}

export interface MarkCleanCommand extends BaseTableCommand {
  type: "mark_clean";
}

export interface MarkDirtyCommand extends BaseTableCommand {
  type: "mark_dirty";
}

export interface SetTableStateCommand extends BaseTableCommand {
  type: "set_table_state";
  state: "clean" | "occupied" | "dirty";
}

export interface BlockTableCommand extends BaseTableCommand {
  type: "block_table" | "unblock_table";
}

export type TableCommand =
  | SeatTableCommand
  | ClearTableCommand
  | MarkCleanCommand
  | MarkDirtyCommand
  | SetTableStateCommand
  | BlockTableCommand;

export interface FloorSnapshotMessage {
  type: "floor.snapshot";
  floorId: string;
  sequence: number;
  snapshot: FloorSnapshot;
  emittedAt?: string;
  tableStateMode?: FloorTableStateMode;
}

export interface TableUpdatedMessage {
  type: "table.updated";
  floorId: string;
  sequence: number;
  table: TableLiveState;
  commandId?: string | null;
  source?: TableUpdateSource;
  emittedAt?: string;
  tableStateMode?: FloorTableStateMode;
}

export interface TableBatchUpdatedMessage {
  type: "table.batch_updated";
  floorId: string;
  sequence: number;
  tables: TableLiveState[];
  commandId?: string | null;
  source?: TableUpdateSource;
  emittedAt?: string;
  tableStateMode?: FloorTableStateMode;
}

export interface CommandRejectedMessage {
  type: "command.rejected";
  floorId: string;
  sequence: number;
  commandId: string;
  tableId: string;
  error?: BusinessRuleError;
  reason?: string;
  emittedAt?: string;
}

export interface WaitlistUpdatedMessage {
  type: "waitlist.updated";
  floorId: string;
  sequence: number;
  commandId?: string | null;
  source?: TableUpdateSource;
  emittedAt?: string;
  entry: WaitlistEntry;
}

export interface RoutingUpdatedMessage {
  type: "routing.updated";
  locationId: string;
  routing: WaiterRoutingState;
  emittedAt?: string;
}

export interface FloorPingMessage {
  type: "connection.ping";
  timestamp: string;
}

export interface FloorPongMessage {
  type: "connection.pong";
  timestamp: string;
}

export interface CursorExpiredMessage {
  type: "cursor.expired";
  floorId?: string;
  reason?: string;
  emittedAt?: string;
}

export interface CommandAckMessage {
  type: "command.ack";
  commandId: string;
  floorId?: string;
  sequence?: number;
  emittedAt?: string;
}

export type FloorStreamMessage =
  | FloorSnapshotMessage
  | TableUpdatedMessage
  | TableBatchUpdatedMessage
  | CommandRejectedMessage
  | CommandAckMessage
  | CursorExpiredMessage
  | WaitlistUpdatedMessage
  | RoutingUpdatedMessage
  | FloorPingMessage
  | FloorPongMessage;

export interface SubscribeFloorMessage {
  type: "subscribe";
  floorId: string;
  sinceSequence?: number;
}

export interface CommandMessage {
  type: "command";
  command: TableCommand;
}

export type FloorClientMessage =
  | SubscribeFloorMessage
  | CommandMessage
  | FloorPongMessage;

export type BackendTableState =
  | "available"
  | "clean"
  | "dirty"
  | "occupied"
  | TableState;

export interface BackendLiveTable {
  id: string;
  tableNumber: string;
  capacity: number;
  state: BackendTableState;
  stateConfidence: number | null;
  updatedAt: string;
  stateChangedAt?: string | null;
  seatedAt?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  currentVisitId?: string | null;
  currentReservationId?: string | null;
  currentPartyName?: string | null;
  currentPartySize?: number | null;
  currentWaitlistEntryId?: string | null;
  currentWaiterId?: string | null;
  currentWaiterName?: string | null;
  hostIntentState?: TableDisplayStatus | null;
  hostIntentUntil?: string | null;
  hostIntentCommandId?: string | null;
  mlSuppressedReason?: string | null;
  isBlocked: boolean;
  block?: unknown | null;
}

export interface BackendFloorSnapshotDto {
  floorId: string;
  mapVersion: string;
  snapshotAt?: string;
  generatedAt?: string;
  sequence: number;
  tables?: BackendLiveTable[];
  tablesById?: Record<string, BackendLiveTable>;
  routingSnapshot?: WaiterRoutingState | null;
  tableStateMode?: FloorTableStateMode;
}

export interface BackendFloorSnapshotMessage {
  type: "floor.snapshot";
  floorId: string;
  sequence: number;
  snapshot: BackendFloorSnapshotDto;
  emittedAt?: string;
  tableStateMode?: FloorTableStateMode;
}

export interface BackendTableUpdatedMessage {
  type: "table.updated";
  floorId: string;
  sequence: number;
  table: BackendLiveTable;
  commandId: string | null;
  source: TableUpdateSource;
  emittedAt: string;
  tableStateMode?: FloorTableStateMode;
}

export interface BackendTableBatchUpdatedMessage {
  type: "table.batch_updated";
  floorId: string;
  sequence: number;
  tables: BackendLiveTable[];
  commandId: string | null;
  source: TableUpdateSource;
  emittedAt: string;
  tableStateMode?: FloorTableStateMode;
}

export interface BackendRoutingUpdatedMessage {
  type: "routing.updated";
  locationId: string;
  routing: WaiterRoutingState;
  emittedAt?: string;
}

export type BackendFloorStreamMessage =
  | BackendFloorSnapshotMessage
  | BackendTableUpdatedMessage
  | BackendTableBatchUpdatedMessage
  | BackendRoutingUpdatedMessage
  | CommandRejectedMessage
  | CommandAckMessage
  | CursorExpiredMessage
  | WaitlistUpdatedMessage
  | FloorPingMessage
  | FloorPongMessage;
