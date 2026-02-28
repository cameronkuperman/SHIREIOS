import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * Syncs device connectivity state with TanStack Query's onlineManager.
 * When offline, queries pause and resume automatically when connectivity returns.
 * Call this once at app startup.
 */
export function setupNetworkListener(): () => void {
  return NetInfo.addEventListener((state) => {
    const isOnline = state.isConnected != null && state.isConnected && state.isInternetReachable;
    onlineManager.setOnline(!!isOnline);
  });
}
