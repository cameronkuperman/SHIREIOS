import { Alert } from 'react-native';

type AlertButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

export type CctvModeAlertFn = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
) => void;

export function requestCctvModeChangeConfirmation(
  nextEnabled: boolean,
  alertFn: CctvModeAlertFn = Alert.alert,
): Promise<boolean> {
  const title = nextEnabled ? 'Turn CCTV sync on?' : 'Turn CCTV sync off?';
  const message = nextEnabled
    ? 'Camera table updates will sync to every host iPad again.'
    : 'Camera table updates will stop syncing. Every host iPad will use manual table state until CCTV sync is turned back on.';

  return new Promise((resolve) => {
    let isResolved = false;
    const resolveOnce = (confirmed: boolean) => {
      if (isResolved) return;
      isResolved = true;
      resolve(confirmed);
    };

    alertFn(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolveOnce(false) },
        {
          text: nextEnabled ? 'Turn On' : 'Turn Off',
          style: nextEnabled ? 'default' : 'destructive',
          onPress: () => resolveOnce(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolveOnce(false) },
    );
  });
}
