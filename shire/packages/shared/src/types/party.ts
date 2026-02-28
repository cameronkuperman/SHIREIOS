export type SeatingPreference = 'window' | 'bar' | 'booth' | 'none';

export interface Party {
  groupId: string;
  partySize: number;
  isReserved: boolean;
  tablePreference: SeatingPreference;
  requestedTime: string;
}
