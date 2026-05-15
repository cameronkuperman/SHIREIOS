export interface ReservationBlackout {
  id: string;
  locationId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  archivedByUserId: string | null;
  archiveReason: string | null;
}

export interface CreateBlackoutRequest {
  name: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  reason?: string;
  active?: boolean;
}

export type UpdateBlackoutRequest = Partial<CreateBlackoutRequest>;

export interface ArchiveBlackoutRequest {
  reason?: string;
}
