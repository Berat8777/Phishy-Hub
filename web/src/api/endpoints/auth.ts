import { http } from '../http';
import type { LoginResponse, RegisterResponse, UserDTO } from '../types';

/**
 * `POST /auth/refresh` is deliberately NOT wrapped here — tokenManager.ts
 * calls it directly via its own internal fetch (see the comment on
 * `callRefreshEndpoint` there) to keep the single-flight refresh guard
 * self-contained and avoid re-entering http.ts's own 401-retry logic.
 * Nothing outside tokenManager.ts should ever call /auth/refresh directly.
 */

export function register(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  departmentId?: string;
}): Promise<RegisterResponse> {
  return http.post<RegisterResponse>('/auth/register', input, { auth: false }).then((r) => r.data);
}

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
