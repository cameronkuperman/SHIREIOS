import type { SeatingPreference } from "./party.ts";
import type { FloorMap } from "./table.ts";

export type Permission =
  | "host.view"
  | "host.manage"
  | "reservations.manage"
  | "waitlist.manage"
  | "tables.manage"
  | "location.switch";

export interface Organization {
  id: string;
  name: string;
}

export interface Location {
  id: string;
  organizationId: string;
  name: string;
  timezone: string;
  floorId: string;
  permissions: Permission[];
  isDefault?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: "host" | "manager" | "group_admin";
}

export interface UserSession {
  user: UserProfile;
  organization: Organization;
  permissions: Permission[];
}

export type MessageDeliveryStatus =
  | "not_sent"
  | "queued"
  | "sent"
  | "failed"
  | "opted_out";

export interface MessageDelivery {
  channel: "sms";
  status: MessageDeliveryStatus;
  destinationMasked: string | null;
  updatedAt: string | null;
  errorMessage: string | null;
}

export interface Guest {
  id: string;
  name: string;
  phone: string;
}

export type WaitlistSource = "walk_in" | "manual" | "yelp" | "import";
export type WaitlistStatus =
  | "waiting"
  | "arrived"
  | "seated"
  | "removed"
  | "no_show";

export interface WaitlistEntry {
  id: string;
  guest: Guest;
  partySize: number;
  seatingPreference: SeatingPreference;
  status: WaitlistStatus;
  notes: string;
  source: WaitlistSource;
  joinedAt: string;
  quotedWaitMinutes: number | null;
  arrivedAt: string | null;
  seatedAt: string | null;
  removedAt: string | null;
  noShowAt: string | null;
  assignedTableId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BusinessRuleErrorCode =
  | "TABLE_UNAVAILABLE"
  | "TABLE_OCCUPIED"
  | "TABLE_BLOCKED"
  | "TABLE_CAPACITY_EXCEEDED"
  | "WAITER_NOT_FOUND"
  | "WAITER_NOT_ACTIVE"
  | "ROUTING_CONFIG_INVALID"
  | "PERMISSION_DENIED"
  | "PACING_REJECTED"
  | "STALE_COMMAND"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR";

export interface BusinessRuleError {
  code: BusinessRuleErrorCode;
  message: string;
  retryable: boolean;
}

export interface TableCommandResult {
  ok: boolean;
  commandId: string;
  tableId: string;
  error: BusinessRuleError | null;
}

export interface HostBootstrap {
  session: UserSession;
  location: Location;
  floorId: string;
  floorMap: FloorMap;
}
