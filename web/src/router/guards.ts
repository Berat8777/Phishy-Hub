import type { NavigationGuardWithThis, RouteLocationRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

/**
 * Global `beforeEach` guard: unauthenticated users get bounced to /login,
 * and an authenticated user hitting /login or /register gets bounced to
 * /chat instead (no reason to show them an auth form for a session they
 * already have).
 *
 * Uses `authStore.user` (not tokenManager directly) as the source of truth
 * — the store's ref is seeded from tokenManager at boot and kept in sync by
 * login/logout/hardReset, so it reflects "do we currently have a usable
 * session" without this guard needing its own auth-state tracking.
 */
export const authGuard: NavigationGuardWithThis<undefined> = (to): true | RouteLocationRaw => {
  const authStore = useAuthStore();
  const isAuthenticated = authStore.user !== null;
  const isPublicRoute = to.meta.public === true;

  if (!isAuthenticated && !isPublicRoute) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined };
  }

  if (isAuthenticated && isPublicRoute) {
    return { name: 'chat' };
  }

  return true;
};

/**
 * `meta.roles` allow-list check — registered after `authGuard`, so it only
 * ever runs for a route we already know the user is authenticated for (an
 * unauthenticated hit on a role-gated route gets redirected to /login by
 * authGuard first, never reaching this one).
 *
 * Not exercised by any route this phase (`/boards` is open to all
 * authenticated roles) but must work correctly now — the next phase's
 * `/admin` routes will set `meta.roles: ['admin']` and depend on this.
 * Redirects to `/chat` rather than a dedicated 403 view, matching the
 * "keep it simple" call in the task brief.
 */
export const roleGuard: NavigationGuardWithThis<undefined> = (to): true | RouteLocationRaw => {
  const roles = to.meta.roles;
  if (!roles || roles.length === 0) return true;

  const authStore = useAuthStore();
  const role = authStore.user?.role;
  if (!role || !roles.includes(role)) {
    return { name: 'chat' };
  }

  return true;
};
