# Shire iOS Dev Quick Start

## Run from repo root

From `SHIREIOS/`:

```bash
npm start
```

That launches:

- the Expo mobile app

## Run on the iPad Pro simulator

From `SHIREIOS/`:

```bash
npm run ios:ipad-pro
```

That script:

- picks your booted `iPad Pro` simulator when possible
- falls back to another available iPad simulator if needed
- builds and launches the iOS dev client through Expo

If you want a different simulator, override it for that run:

```bash
SHIRE_IOS_SIMULATOR="iPad Pro 11-inch (M5)" npm run ios:ipad-pro
```

## Use a real phone or iPad

If the device cannot reach the local Metro server, use tunnel mode:

```bash
npm run start:tunnel
```

## Useful paths

- app workspace: `shire/`
- mobile app: `shire/apps/mobile/`
- click-to-run config: `.vscode/launch.json`

## Notes

- `npm start` now works from the repo root.
- `npm start` inside `shire/` also works.
- `npm run ios:sim` defaults to the iPad Pro family.
- The mobile app normalizes `EXPO_PUBLIC_API_URL`, so both `https://example.com` and `https://example.com/api/v1` work.
- If you want Expo Go instead of a development build, run:

```bash
cd shire/apps/mobile
npm run dev:go
```
