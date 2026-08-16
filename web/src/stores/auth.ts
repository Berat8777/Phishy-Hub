import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as authApi from '../api/endpoints/auth';
import * as usersApi from '../api/endpoints/users';
import * as tokenManager from '../api/tokenManager';
import { connectSocket, disconnectSocket } from '../socket/connection';
import { resetAllStores } from './index';
import type { UserDTO } from '../api/types';

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';

export const useAuthStore = defineStore('auth', () => {
  // Tokens live in tokenManager (localStorage), not here — this store only
  // mirrors the session user + status for reactive UI. Seeded from
  // whatever's already in storage so a page reload stays logged in.
  const user = ref<UserDTO | null>(tokenManager.getUser());
  const status = ref<AuthStatus>(user.value ? 'authenticated' : 'unauthenticated');

  async function login(input: { email: string; password: string }): Promise<void> {
    status.value = 'authenticating';
    try {
      const res = await authApi.login(input);
      tokenManager.setSession(res);
      user.value = res.user;
      status.value = 'authenticated';
      connectSocket();
    } catch (err) {
      status.value = 'unauthenticated';
      throw err;
    }
  }

  /**
   * `POST /auth/register` only returns the created user, no tokens
   * (CONTRACT.md §3.2 / api/src/controllers/auth.controller.ts::register).
   * Auto-login right after with the same credentials so registering lands
   * the user straight in the app — proves the full
   * register -> session -> socket pipeline in one action instead of
   * bouncing to a second login screen.
   */
  async function register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    departmentId?: string;
  }): Promise<void> {
    status.value = 'authenticating';
    try {
      await authApi.register(input);
      await login({ email: input.email, password: input.password });
    } catch (err) {
      status.value = 'unauthenticated';
      throw err;
    }
  }

  /**
   * Clears everything session-scoped: tokens, socket connection, every
   * other Pinia store, and the local user ref. Shared by manual logout and
   * the forced logout triggered by tokenManager.onSessionExpired (wired in
   * main.ts, since that callback also needs router + toast, which this
   * transport-adjacent store deliberately doesn't depend on).
   */
  function hardReset(): void {
    tokenManager.clearSession();
    disconnectSocket();
    resetAllStores();
    user.value = null;
    status.value = 'unauthenticated';
  }

  /**
   * `PATCH /users/me` (CONTRACT.md §3.3) — self-service profile edit, used
   * by `UserProfileEditDialog.vue` when the viewer is looking at their own
   * profile. Keeps both the reactive `user` ref AND `tokenManager`'s
   * localStorage copy in sync (`tokenManager.setUser`, its documented hook
   * for exactly this), so a page reload right after editing still shows the
   * new name.
   *
   * `managedDepartmentIds` is preserved from the existing session user
   * rather than taken from the response — per `UserDTO`'s doc comment
   * (api/types.ts), it's only ever populated on register/login/`GET
   * /auth/me`, so `PATCH /users/me`'s response would otherwise silently
   * wipe it back to `[]` for a department-manager editing their own name.
   */
  async function updateSelf(patch: { firstName?: string; lastName?: string; avatarFileId?: string }): Promise<UserDTO> {
    const updated = await usersApi.updateMe(patch);
    const merged: UserDTO = { ...updated, managedDepartmentIds: user.value?.managedDepartmentIds ?? [] };
    user.value = merged;
    tokenManager.setUser(merged);
    return merged;
  }

  /** Manual logout — best-effort server-side revoke (CONTRACT.md: idempotent, safe even if it fails/times out). */
  async function logout(): Promise<void> {
    const refreshToken = tokenManager.getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Best-effort — proceed with local logout regardless.
      }
    }
    hardReset();
  }

  return { user, status, login, register, updateSelf, logout, hardReset };
});
