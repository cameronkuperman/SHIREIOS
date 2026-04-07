import { create } from 'zustand';

type WaitlistConfig = {
  autoEscalateMinutes: number;
  notificationTimeoutMinutes: number;
  autoNotifyNext: boolean;
  setAutoEscalateMinutes: (minutes: number) => void;
  setNotificationTimeoutMinutes: (minutes: number) => void;
  setAutoNotifyNext: (enabled: boolean) => void;
};

export const useWaitlistConfigStore = create<WaitlistConfig>((set) => ({
  autoEscalateMinutes: 15,
  notificationTimeoutMinutes: 10,
  autoNotifyNext: true,
  setAutoEscalateMinutes: (minutes) => set({ autoEscalateMinutes: Math.max(5, Math.min(30, minutes)) }),
  setNotificationTimeoutMinutes: (minutes) => set({ notificationTimeoutMinutes: Math.max(5, Math.min(20, minutes)) }),
  setAutoNotifyNext: (enabled) => set({ autoNotifyNext: enabled }),
}));
