import type { ReservationBlackout } from '@shire/shared';

export type ReservationBlackoutDto = ReservationBlackout;

export function adaptBlackout(blackout: ReservationBlackoutDto): ReservationBlackout {
  return {
    ...blackout,
    reason: blackout.reason ?? null,
    archivedAt: blackout.archivedAt ?? null,
    archivedByUserId: blackout.archivedByUserId ?? null,
    archiveReason: blackout.archiveReason ?? null,
  };
}
