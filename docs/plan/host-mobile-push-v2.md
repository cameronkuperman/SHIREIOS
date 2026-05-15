# Host Mobile Push v2

v1 uses foreground polling for the inbox and open thread. Push is deferred until the backend owns an inbound-message event path and mobile has APNs/Expo notification registration.

## Backend requirements

- `POST /api/v1/locations/{locationId}/devices/push-tokens` to register Expo/APNs tokens for the authenticated host user and active location.
- Token revoke endpoint or idempotent replacement on sign-out / location switch.
- Send notification on inbound guest SMS with a payload that includes `locationId` and `conversationId`.
- Deep-link payload format: `shire:///(host)/inbox/{conversationId}` or the Expo Router equivalent.
- Provider retry/error observability separate from the existing SMS delivery status.

## Frontend requirements

- Add Expo notifications setup and APNs entitlement/cert configuration.
- Request notification permission after first successful host login, not before auth.
- Register token per user/location and refresh it when the current location changes.
- On notification tap, hydrate auth/location first, then deep-link to the thread.
- Replace inbox polling intervals with event-driven invalidation while keeping polling as a fallback.
