# Mobile Supabase Setup

This project uses Supabase for mobile authentication only. The host app signs in
with Supabase email/password auth, then sends the Supabase access token to the
backend API and websocket layer.

## Put These In `.env`

Create [`.env`](../../shire/apps/mobile/.env) in
[`shire/apps/mobile`](../../shire/apps/mobile).
You can start from
[`shire/apps/mobile/.env.example`](../../shire/apps/mobile/.env.example).

Required for a real backend:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_WS_URL`

Optional:

- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_APP_ENV`

Example:

```dotenv
EXPO_PUBLIC_API_URL=https://web-production-5c5b4.up.railway.app/api/v1
EXPO_PUBLIC_WS_URL=wss://web-production-5c5b4.up.railway.app
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
EXPO_PUBLIC_APP_ENV=production
```

## What You Need From Supabase

From the Supabase project:

- Project URL
- Project anon key
- Email/password auth enabled
- Host users created in Supabase Auth

The mobile app does not currently require the service role key.

## What You Need From The Backend

The backend must trust and validate Supabase JWTs and expose the host routes the
app calls after sign-in:

- `GET /api/v1/me`
- `GET /api/v1/me/locations`
- `POST /api/v1/locations`
- `GET /api/v1/locations/:locationId/bootstrap`
- `GET /api/v1/locations/:locationId/routing`
- `PUT /api/v1/locations/:locationId/routing`
- floor snapshot, waitlist, and websocket routes described in
  [Host Backend Contract](../architecture/host-backend-contract.md)

The websocket layer should accept the same Supabase bearer token.

## Default Mobile Host Backend

If you do not override the API or websocket env vars, the host app now defaults
to the Railway production backend:

- `https://web-production-5c5b4.up.railway.app/api/v1`
- `wss://web-production-5c5b4.up.railway.app`

`EXPO_PUBLIC_WS_URL` should be the websocket origin only. The mobile client
adds `/ws/locations/:locationId/floors/:floorId` itself.

## Local Development Defaults

If you need local backend development, set API and websocket env vars
explicitly, for example:

```dotenv
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000/api/v1
EXPO_PUBLIC_WS_URL=ws://127.0.0.1:3000
```

If you do not set Supabase vars, the client falls back to placeholder values,
which means sign-in will not work.

## Security

- Do not paste real keys into chat.
- Put local values in
  [`shire/apps/mobile/.env`](../../shire/apps/mobile/.env).
- Only the anon key belongs in the mobile app.
- Keep the Supabase service role key on the backend only.
