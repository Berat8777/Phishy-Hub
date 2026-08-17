import * as SecureStore from 'expo-secure-store';
import type { TokenPair, UserDTO } from './types';
import { ApiError } from './errors';
import { API_BASE_URL } from '../config/env';

/**
 * Owns the auth session in `expo-secure-store` (OS keychain/keystore —
 * never AsyncStorage, per the task brief) and every refresh-token flow.
 *
 * This is the mobile port of web/src/api/tokenManager.ts. Same refresh
 * rotation discipline (CONTRACT.md §1.3 — refresh is single-use, reuse
 * revokes the whole token family), same in-process single-flight guard so
 * concurrent callers (a 401 retry, the proactive timer, a socket
 * `connect_error`) never fire two concurrent `/auth/refresh` calls. Does
 * NOT need the web version's cross-tab `navigator.locks` mutex — a mobile
 * app is a single process, so the in-memory `inflight` promise alone is
 * enough (see repo instructions).
 *
 * `SecureStore` is async, unlike `localStorage`. To keep every OTHER call
 * site in this app synchronous (matching the web module's ergonomics —
 * `getAccessToken()` etc. used all over the place without `await`), this
 * module keeps an in-memory cache (`cached`) that mirrors whatever is
 * persisted, and hydrates it once at boot via `bootstrap()` (called by
 * AuthContext before the app renders anything that needs auth state). Every
 * write updates the memory cache synchronously and persists to SecureStore
 * in the background.
 */

const TOKENS_KEY = 'phishyhub.auth.tokens';
const USER_KEY = 'phishyhub.auth.user';
const BIOMETRIC_ENABLED_KEY = 'phishyhub.auth.biometricEnabled';

/** Implementer's choice, not mandated by CONTRACT.md: refresh ~60s before the access token actually expires (same buffer as web). */
const PROACTIVE_REFRESH_BUFFER_MS = 60_000;

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  accessTokenExpiresAt: number;
}

export interface StoredAuth extends StoredTokens {
  user: UserDTO;
}

type SessionExpiredListener = (reason: string) => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

let cached: StoredAuth | null = null;
let bootstrapped = false;
let inflight: Promise<TokenPair> | null = null;
let proactiveTimer: ReturnType<typeof setTimeout> | null = null;

// --- Boot ---

/**
 * Hydrates the in-memory cache from SecureStore. Must be awaited once,
 * before any screen reads `getAccessToken()`/`getUser()`/`isAuthenticated()`
 * — AuthContext does this before rendering the router. Idempotent/safe to
 * call more than once (subsequent calls are no-ops).
 */
export async function bootstrap(): Promise<StoredAuth | null> {
  if (bootstrapped) return cached;
  bootstrapped = true;
  try {
    const [tokensRaw, userRaw] = await Promise.all([
      SecureStore.getItemAsync(TOKENS_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    if (!tokensRaw || !userRaw) {
      cached = null;
      return null;
    }
    const tokens = JSON.parse(tokensRaw) as StoredTokens;
    const user = JSON.parse(userRaw) as UserDTO;
    if (!tokens.accessToken || !tokens.refreshToken || !user) {
      cached = null;
      return null;
    }
    cached = { ...tokens, user };
    scheduleProactiveRefresh();
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

async function persist(auth: StoredAuth): Promise<void> {
  const { user, ...tokens } = auth;
  await Promise.all([
    SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens)),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  ]);
}

async function removePersisted(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKENS_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(USER_KEY).catch(() => {}),
  ]);
}

function writeCache(auth: StoredAuth): void {
  cached = auth;
  scheduleProactiveRefresh();
  void persist(auth);
}

// --- Public reads (synchronous — read the in-memory cache, hydrated by bootstrap()) ---

export function getAccessToken(): string | null {
  return cached?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return cached?.refreshToken ?? null;
}

export function getUser(): UserDTO | null {
  return cached?.user ?? null;
}

export function getAccessTokenExpiresAt(): number | null {
  return cached?.accessTokenExpiresAt ?? null;
}

export function isAuthenticated(): boolean {
  return cached !== null;
}

// --- Session lifecycle ---

/** Called after a successful login. Establishes a brand-new session. */
export function setSession(input: { user: UserDTO } & TokenPair): void {
  writeCache({
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    accessTokenExpiresAt: Date.now() + input.accessTokenExpiresIn * 1000,
    user: input.user,
  });
}

/** Called after a successful refresh. Preserves whichever user is already cached. */
function setTokens(tokens: TokenPair): void {
  if (!cached) return;
  writeCache({
    ...cached,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: Date.now() + tokens.accessTokenExpiresIn * 1000,
  });
}

/** Updates the cached user profile (e.g. after PATCH /users/me) without touching tokens. */
export function setUser(user: UserDTO): void {
  if (!cached) return;
  writeCache({ ...cached, user });
}

/** Plain local logout — caller is responsible for the best-effort POST /auth/logout call first. */
export function clearSession(): void {
  cached = null;
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }
  void removePersisted();
}

/**
 * Subscribe to "the session died and we couldn't recover it" (refresh
 * ultimately failed — revoked family, expired refresh token, etc). Whoever
 * owns app-level navigation (AuthContext) subscribes at boot and redirects
 * to the login screen.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function forceLogout(reason: string): void {
  cached = null;
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }
  void removePersisted();
  for (const listener of sessionExpiredListeners) listener(reason);
}

// --- Biometric-unlock preference (separate from the session itself — see src/auth/biometrics.ts) ---

export async function getBiometricEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return value === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
  } else {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY).catch(() => {});
  }
}

// --- Proactive refresh timer ---

function scheduleProactiveRefresh(): void {
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }
  if (!cached) return;

  const delay = cached.accessTokenExpiresAt - Date.now() - PROACTIVE_REFRESH_BUFFER_MS;
  if (delay <= 0) {
    // Already due (e.g. app was backgrounded past the buffer) — kick one off
    // now rather than scheduling a negative-delay timeout.
    void refreshTokens().catch(() => {
      /* onSessionExpired listeners already notified inside refreshTokens */
    });
    return;
  }

  proactiveTimer = setTimeout(() => {
    void refreshTokens().catch(() => {});
  }, delay);
}

// --- The actual refresh call ---

/**
 * Deliberately does NOT go through api/http.ts's generic `request()` helper
 * — that helper's own 401 handling calls back into `refreshTokens()`, and
 * routing the refresh call itself through that path would risk infinite
 * recursion. This is a small, self-contained fetch instead (same as web).
 */
async function callRefreshEndpoint(refreshToken: string): Promise<TokenPair> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server to refresh the session');
  }

  const json = (await response.json().catch(() => null)) as
    | { success: true; data: TokenPair }
    | { success: false; error: { code: string; message: string; details?: unknown } }
    | null;

  if (!response.ok || !json || json.success === false) {
    const code = json && json.success === false ? json.error.code : 'INTERNAL_ERROR';
    const message = json && json.success === false ? json.error.message : `Refresh failed (HTTP ${response.status})`;
    throw new ApiError(response.status, code, message);
  }

  return json.data;
}

async function performRefresh(): Promise<TokenPair> {
  if (!cached) {
    throw new ApiError(401, 'UNAUTHORIZED', 'No session to refresh');
  }
  try {
    const tokens = await callRefreshEndpoint(cached.refreshToken);
    setTokens(tokens);
    return tokens;
  } catch (err) {
    // Only force-logout on an actual auth rejection (reuse-detected family
    // revoke, expired refresh token, account no longer active — per
    // CONTRACT.md §1.3, there's no recovering from these short of logging
    // in again). A NETWORK_ERROR (status 0, callRefreshEndpoint's fetch
    // itself failed) means the server was unreachable, not that the
    // session is invalid — this is the common case on mobile (wifi/
    // cellular handoffs triggering the socket's connect_error, which also
    // calls refreshTokens()), and must NOT wipe a still-valid session.
    if (!(err instanceof ApiError) || err.status !== 0) {
      forceLogout('Your session has expired, please log in again');
    }
    throw err;
  }
}

/**
 * The single shared entry point every caller (http.ts's 401 handler, the
 * proactive timer above, socket connect_error) must use instead of calling
 * the refresh endpoint directly — see module doc comment for why.
 */
export async function refreshTokens(): Promise<TokenPair> {
  if (inflight) return inflight;

  const attempt = async (): Promise<TokenPair> => performRefresh();

  inflight = attempt().finally(() => {
    inflight = null;
  });

  return inflight;
}

