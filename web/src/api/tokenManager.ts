import type { TokenPair, UserDTO } from './types';
import { ApiError } from './errors';

/**
 * Owns the auth session in localStorage and every refresh-token flow.
 *
 * Framework-agnostic on purpose (no vue/pinia import — see repo CLAUDE.md
 * "hard rule"): this must be a true module-scoped singleton, independent of
 * Pinia store lifecycle / HMR, because the in-tab single-flight guard below
 * only works if there is exactly one instance of it per tab.
 *
 * Refresh rotation is single-use and reuse-triggers a full family revoke
 * (api/src/services/auth.service.ts::refresh, CONTRACT.md §1.3) — presenting
 * an already-rotated refresh token logs the user out everywhere. That's what
 * the single-flight guards below exist to prevent:
 *   - in-tab: a module-scoped `inflight` promise every caller awaits instead
 *     of starting a second refresh call.
 *   - cross-tab: a `navigator.locks` mutex, inside of which we re-read
 *     storage first — if another tab already refreshed while we waited for
 *     the lock, its tokens are already sitting in localStorage and we just
 *     use those instead of presenting our (now-stale) refresh token too.
 */

const STORAGE_KEY = 'phishyhub.auth';
const LOCK_NAME = 'ph-token-refresh';
/** Implementer's choice, not mandated by CONTRACT.md: refresh ~60s before the access token actually expires. */
const PROACTIVE_REFRESH_BUFFER_MS = 60_000;

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  accessTokenExpiresAt: number;
  user: UserDTO;
}

type SessionExpiredListener = (reason: string) => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

let inflight: Promise<TokenPair> | null = null;
let proactiveTimer: ReturnType<typeof setTimeout> | null = null;

function hasLocksApi(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function';
}

function readStorage(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(auth: StoredAuth): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  scheduleProactiveRefresh();
}

function removeStorage(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }
}

function toTokenPair(auth: StoredAuth): TokenPair {
  return {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    accessTokenExpiresIn: Math.max(0, Math.round((auth.accessTokenExpiresAt - Date.now()) / 1000)),
  };
}

// --- Public reads ---

export function getAccessToken(): string | null {
  return readStorage()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return readStorage()?.refreshToken ?? null;
}

export function getUser(): UserDTO | null {
  return readStorage()?.user ?? null;
}

export function getAccessTokenExpiresAt(): number | null {
  return readStorage()?.accessTokenExpiresAt ?? null;
}

export function isAuthenticated(): boolean {
  return readStorage() !== null;
}

// --- Session lifecycle ---

/** Called after a successful login/register(+login). Establishes a brand-new session. */
export function setSession(input: { user: UserDTO } & TokenPair): void {
  const auth: StoredAuth = {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    accessTokenExpiresAt: Date.now() + input.accessTokenExpiresIn * 1000,
    user: input.user,
  };
  writeStorage(auth);
}

/** Called after a successful refresh. Preserves whichever user is already stored. */
function setTokens(tokens: TokenPair): void {
  const existing = readStorage();
  if (!existing) return;
  writeStorage({
    ...existing,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: Date.now() + tokens.accessTokenExpiresIn * 1000,
  });
}

/** Updates the cached user profile (e.g. after PATCH /users/me) without touching tokens. */
export function setUser(user: UserDTO): void {
  const existing = readStorage();
  if (!existing) return;
  writeStorage({ ...existing, user });
}

/** Plain local logout — no toast, no "session expired" semantics. Caller is responsible for the best-effort POST /auth/logout call first. */
export function clearSession(): void {
  removeStorage();
}

/**
 * Subscribe to "the session died and we couldn't recover it" (refresh
 * ultimately failed — revoked family, expired refresh token, etc). The auth
 * store subscribes at boot and owns the actual hard-logout side effects
 * (disconnect socket, reset other Pinia stores, redirect, toast) since this
 * module isn't allowed to touch vue/pinia/router.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function forceLogout(reason: string): void {
  removeStorage();
  for (const listener of sessionExpiredListeners) listener(reason);
}

// --- Proactive refresh timer ---

function scheduleProactiveRefresh(): void {
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }
  const stored = readStorage();
  if (!stored) return;

  const delay = stored.accessTokenExpiresAt - Date.now() - PROACTIVE_REFRESH_BUFFER_MS;
  if (delay <= 0) {
    // Already due (e.g. tab was backgrounded/asleep past the buffer) — kick
    // one off now rather than scheduling a negative-delay timeout.
    void refreshTokens().catch(() => {
      /* onSessionExpired listeners already notified inside refreshTokens */
    });
    return;
  }

  proactiveTimer = setTimeout(() => {
    void refreshTokens().catch(() => {});
  }, delay);
}

// --- Cross-tab sync: a tab that did NOT perform the refresh still needs to
// pick up the new tokens the tab that did perform it just wrote. ---

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    // event.newValue === null means another tab logged out / session expired.
    if (event.newValue === null) {
      if (proactiveTimer) {
        clearTimeout(proactiveTimer);
        proactiveTimer = null;
      }
      for (const listener of sessionExpiredListeners) listener('Signed out in another tab');
      return;
    }
    scheduleProactiveRefresh();
  });

  // Pick up whatever session (if any) was already in storage when this
  // module first loads (e.g. page reload).
  scheduleProactiveRefresh();
}

// --- The actual refresh call ---

/**
 * Deliberately does NOT go through api/http.ts's generic `request()` helper:
 * that helper's own 401 handling calls back into `refreshTokens()`, and
 * routing the refresh call itself through that path would risk infinite
 * recursion / re-entrancy. This is a small, self-contained fetch instead.
 */
async function callRefreshEndpoint(refreshToken: string): Promise<TokenPair> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
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
  const current = readStorage();
  if (!current) {
    throw new ApiError(401, 'UNAUTHORIZED', 'No session to refresh');
  }
  try {
    const tokens = await callRefreshEndpoint(current.refreshToken);
    setTokens(tokens);
    return tokens;
  } catch (err) {
    // Refresh ultimately failed (reuse-detected family revoke, expired
    // refresh token, or the account no longer active) — per CONTRACT.md
    // §1.3 there is no recovering from this short of logging in again.
    forceLogout('Your session has expired, please log in again');
    throw err;
  }
}

/**
 * The single shared entry point every caller (http.ts's 401 handler, the
 * proactive timer above, socket connect_error) must use instead of calling
 * the refresh endpoint directly.
 */
export async function refreshTokens(): Promise<TokenPair> {
  if (inflight) return inflight;

  const beforeAccessToken = readStorage()?.accessToken ?? null;

  const attempt = async (): Promise<TokenPair> => {
    // Re-read AFTER acquiring the lock (or, without locks, right before
    // trying): another tab may have already refreshed while we were
    // waiting, in which case storage now holds a different, already-fresh
    // token and we should just use it instead of presenting our own
    // (now-stale) refresh token — doing so would trip reuse detection.
    const stored = readStorage();
    const bufferMs = PROACTIVE_REFRESH_BUFFER_MS;
    const isFresh = stored ? stored.accessTokenExpiresAt - Date.now() > bufferMs : false;
    if (stored && stored.accessToken !== beforeAccessToken && isFresh) {
      return toTokenPair(stored);
    }
    return performRefresh();
  };

  const run = hasLocksApi() ? navigator.locks!.request(LOCK_NAME, attempt) : attempt();

  inflight = run.finally(() => {
    inflight = null;
  });

  return inflight;
}
