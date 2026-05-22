jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

import {
  requestCctvModeChangeConfirmation,
  type CctvModeAlertFn,
} from '../cctvModeConfirmation';

describe('requestCctvModeChangeConfirmation', () => {
  it('confirms before turning CCTV sync off', async () => {
    const alertFn: CctvModeAlertFn = jest.fn((title, message, buttons) => {
      expect(title).toBe('Turn CCTV sync off?');
      expect(message).toContain('Camera table updates will stop syncing');
      buttons?.[1]?.onPress?.();
    });

    await expect(requestCctvModeChangeConfirmation(false, alertFn)).resolves.toBe(true);
    expect(alertFn).toHaveBeenCalledTimes(1);
  });

  it('cancels without confirming the shared mode change', async () => {
    const alertFn: CctvModeAlertFn = jest.fn((title, message, buttons) => {
      expect(title).toBe('Turn CCTV sync on?');
      expect(message).toContain('sync to every host iPad again');
      buttons?.[0]?.onPress?.();
    });

    await expect(requestCctvModeChangeConfirmation(true, alertFn)).resolves.toBe(false);
    expect(alertFn).toHaveBeenCalledTimes(1);
  });
});
