export type WaiterStatus = 'available' | 'busy' | 'on_break' | 'heading_to_table';
export type CleanerStatus = 'idle' | 'cleaning' | 'unavailable';

export interface WaiterSkills {
  largeParty: boolean;
  wineUpsell: boolean;
  languages: string[];
  trainee: boolean;
  pairedWith: string | null;
}

export interface Waiter {
  id: string;
  name: string;
  score: number;
  currentTipTotal: number;
  liveTables: number;
  status: WaiterStatus;
  section: string;
  skills: WaiterSkills;
}

export interface Cleaner {
  id: string;
  name: string;
  status: CleanerStatus;
}

export interface Host {
  id: string;
  name: string;
  onDuty: boolean;
}
