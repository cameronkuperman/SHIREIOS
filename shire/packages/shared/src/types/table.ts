export const TableState = {
  EMPTY_CLEAN: 'empty_clean',
  OCCUPIED: 'occupied',
  EMPTY_DIRTY: 'empty_dirty',
} as const;

export type TableState = (typeof TableState)[keyof typeof TableState];

export interface Table {
  tableId: string;
  section: string;
  capacity: number;
  type: 'regular' | 'high-top' | 'counter' | 'bar' | 'outdoor' | 'booth';
  predictedState: TableState;
  stateConfidence: number;
  lastStateChange: string;
  isBlocked: boolean;
}
