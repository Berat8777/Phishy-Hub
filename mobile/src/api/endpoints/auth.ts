import { http } from '../http';
import type { LoginResponse, UserDTO } from '../types';

/**
 * `POST /auth/refresh` is deliberately NOT wrapped here — tokenManager.ts
 * calls it directly via its own internal fetch, same reasoning as the web
 * client (keep the single-flight refresh guard self-contained).
 */

export function login(input: { email: string; password: string }): Promise<LoginResponse> {
  return http.post<LoginResponse>('/auth/login', input, { auth: false }).then((r) => r.data);
}

/** Best-effort + idempotent per CONTRACT.md — caller should not block local logout on this failing. */
export function logout(refreshToken: string): Promise<void> {
  return http.post<{ loggedOut: true }>('/auth/logout', { refreshToken }, { auth: false }).then(() => undefined);
}

export function me(): Promise<UserDTO> {
  return http.get<{ user: UserDTO }>('/auth/me').then((r) => r.data.user);
}
