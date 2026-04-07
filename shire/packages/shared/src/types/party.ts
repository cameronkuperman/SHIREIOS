export type SeatingPreference = 'window' | 'bar' | 'booth' | 'patio' | 'none';

export interface Party {
  groupId: string;
  partySize: number;
  isReserved: boolean;
  tablePreference: SeatingPreference;
  requestedTime: string;
}
