# Apple Developer Build

This app uses Expo and EAS, so Apple signing is configured through Expo config and EAS credentials, not a checked-in Xcode project.

## Required values

Add these to your local `.env` before running an iOS build:

```bash
EXPO_IOS_BUNDLE_IDENTIFIER=com.yourcompany.shire
EXPO_IOS_BUILD_NUMBER=1
EXPO_APPLE_TEAM_ID=ABCDE12345
EXPO_EAS_PROJECT_ID=
```

- `EXPO_IOS_BUNDLE_IDENTIFIER` must match the App ID you want in Apple Developer.
- `EXPO_IOS_BUILD_NUMBER` maps to `CFBundleVersion`. The `production` EAS profile already has `autoIncrement: true`, so this is mainly the starting value.
- `EXPO_APPLE_TEAM_ID` is the Apple Developer team ID used when EAS resolves credentials.
- `EXPO_EAS_PROJECT_ID` is optional until the app is linked to an Expo project.

## First-time setup

1. Log in to Expo: `npx eas-cli@latest login`
2. Configure EAS for the app: `npx eas-cli@latest build:configure`
3. If `build:configure` gives you a project ID, copy it into `EXPO_EAS_PROJECT_ID`
4. Start the iOS build: `npx eas-cli@latest build --platform ios --profile production`

During the first iOS build, EAS can create or reuse the App ID, distribution certificate, and provisioning profile after you authenticate with your Apple Developer account.

## Submit to TestFlight / App Store

Run: `npx eas-cli@latest submit --platform ios --profile production`

## Notes

- Keep build-only variables in shell env, `.env`, or EAS project environment variables. Do not expose them through `EXPO_PUBLIC_*`.
- The Expo config lives in `app.config.ts`, so changing the Apple team ID or bundle identifier does not require editing native files.
