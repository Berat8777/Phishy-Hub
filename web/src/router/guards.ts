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
