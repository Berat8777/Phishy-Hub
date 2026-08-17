/**
 * Expo inlines `EXPO_PUBLIC_*` env vars into the JS bundle at build time
 * (read from `.env` in dev, or whatever env the build step is run with) —
 * no `app.config.ts` indirection needed for this. See `.env.example`.
 *
 * Same rule as every other client in this repo: no hardcoded `localhost` in
 * source. If these are missing we fail loudly at import time rather than
 * silently making requests to `undefined`.
 */

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy mobile/.env.example to mobile/.env and set it (do not use "localhost" for on-device testing — use your LAN IP).`,
    );
  }
  return value;
}

export const API_BASE_URL = requireEnv('EXPO_PUBLIC_API_BASE_URL', process.env.EXPO_PUBLIC_API_BASE_URL);
export const SOCKET_URL = requireEnv('EXPO_PUBLIC_SOCKET_URL', process.env.EXPO_PUBLIC_SOCKET_URL);
