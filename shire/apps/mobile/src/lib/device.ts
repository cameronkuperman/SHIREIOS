import Constants from 'expo-constants';
import { storage } from './storage';

const DEVICE_ID_KEY = 'shire_device_id';

export function getOrCreateDeviceId(): string {
  const existing = storage.getString(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const nextId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  storage.set(DEVICE_ID_KEY, nextId);
  return nextId;
}

export function getAppVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? 'dev';
  return String(version);
}
