import { Alert } from 'react-native';
import { extractHostRequestErrorMessage } from './errors';

/**
 * Fire a mutation without blocking the UI on the network round-trip.
 *
 * Every host mutation applies an optimistic `onMutate` cache write, so the
 * change is already visible the moment this is called — and `onError` rolls it
 * back if the request fails. That means screens never need to `await` the
 * server response for correctness; awaiting only makes the user stare at a
 * spinner. Use this to let sheets/modals close immediately (the "Resy/Yelp"
 * instant feel) while the request reconciles in the background.
 *
 * Failures surface via Alert (a global API that fires even after the calling
 * screen has unmounted) rather than blocking the close.
 */
export function fireHostMutation<T>(
  promise: Promise<T>,
  errorTitle: string,
  fallbackMessage: string,
): void {
  void promise.catch((error) => {
    Alert.alert(errorTitle, extractHostRequestErrorMessage(error, fallbackMessage));
  });
}
