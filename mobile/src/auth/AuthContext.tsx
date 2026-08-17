import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/endpoints/auth';
import * as tokenManager from '../api/tokenManager';
import { connectSocket, destroySocket, disconnectSocket } from '../socket/connection';
import { isBiometricAvailable, promptBiometricUnlock } from './biometrics';
import { registerForPushNotificationsAsync } from '../notifications/push';
import type { UserDTO } from '../api/types';

/**
 * `booting`    — bootstrap() still reading SecureStore.
 * `locked`     — a valid session IS persisted, but biometric-unlock is
 *                enabled for it and hasn't been passed yet this launch
 *                (see task brief item 6 / biometrics.ts doc comment).
 * `unauthenticated` — no persisted session (or it was cleared/expired) —
 *                show the password login screen.
 * `authenticated` — session is live in tokenManager's memory cache, socket
 *                connected, app.
 */
export type AuthStatus = 'booting' | 'locked' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDTO | null;
  biometricAvailable: boolean;
  /** Whether the CURRENT locked/persisted session has biometric unlock turned on. */
  biometricEnabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Called from app/unlock.tsx. Resolves true if the biometric prompt succeeded and the app should proceed. */
  unlock: () => Promise<boolean>;
  /** Called from the "Enable biometric unlock?" prompt shown right after a successful password login. */
  enableBiometricUnlock: () => Promise<void>;
  declineBiometricUnlock: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('booting');
  const [user, setUser] = useState<UserDTO | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [session, hwAvailable] = await Promise.all([tokenManager.bootstrap(), isBiometricAvailable()]);
      if (cancelled) return;
      setBiometricAvailable(hwAvailable);

      if (!session) {
        setStatus('unauthenticated');
        return;
      }

      const enabled = await tokenManager.getBiometricEnabled();
      if (cancelled) return;
      setBiometricEnabledState(enabled);
      setUser(session.user);

      if (enabled) {
        setStatus('locked');
      } else {
        connectSocket();
        setStatus('authenticated');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      tokenManager.onSessionExpired(() => {
        disconnectSocket();
        setUser(null);
        setStatus('unauthenticated');
      }),
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    tokenManager.setSession(response);
    setUser(response.user);
    setBiometricEnabledState(await tokenManager.getBiometricEnabled());
    connectSocket();
    setStatus('authenticated');
    // Best-effort, client-side-only plumbing (see notifications/push.ts doc
    // comment — no backend endpoint to send this token to yet).
    void registerForPushNotificationsAsync();
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenManager.getRefreshToken();
    destroySocket();
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => {
        /* best-effort per CONTRACT.md — local logout proceeds regardless */
      });
    }
    tokenManager.clearSession();
    await tokenManager.setBiometricEnabled(false);
    setBiometricEnabledState(false);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const unlock = useCallback(async () => {
    const ok = await promptBiometricUnlock('Unlock Phishy Hub');
    if (!ok) return false;
    // The session was already sitting in tokenManager's memory cache since
    // bootstrap() (that's what made status === 'locked' possible) — unlock
    // just gates the app's UI on proving identity, no token I/O here.
    connectSocket();
    setStatus('authenticated');
    return true;
  }, []);

  const enableBiometricUnlock = useCallback(async () => {
    await tokenManager.setBiometricEnabled(true);
    setBiometricEnabledState(true);
  }, []);

  const declineBiometricUnlock = useCallback(() => {
    // No-op: biometricEnabled already defaults to false. Present for
    // symmetry / explicit intent from the calling prompt.
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      biometricAvailable,
      biometricEnabled,
      login,
      logout,
      unlock,
      enableBiometricUnlock,
      declineBiometricUnlock,
    }),
    [status, user, biometricAvailable, biometricEnabled, login, logout, unlock, enableBiometricUnlock, declineBiometricUnlock],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within <AuthProvider>');
  return ctx;
}
