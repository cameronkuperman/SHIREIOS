import { storage } from './storage';
import { getOrCreateDeviceId } from './device';

jest.mock('expo-constants', () => ({
  expoConfig: { version: 'test' },
  manifest2: null,
}));

describe('device identity', () => {
  afterEach(() => {
    storage.delete('shire_device_id');
    storage.delete('shire-auth-store');
    storage.delete('shire-workday-store');
  });

  it('keeps the same device id across repeated reads', () => {
    const firstId = getOrCreateDeviceId();
    const secondId = getOrCreateDeviceId();

    expect(firstId).toBe(secondId);
    expect(firstId).toMatch(/^device-/);
  });

  it('does not change when auth or workday state is reset', () => {
    const deviceId = getOrCreateDeviceId();

    storage.delete('shire-auth-store');
    storage.delete('shire-workday-store');

    expect(getOrCreateDeviceId()).toBe(deviceId);
  });
});
