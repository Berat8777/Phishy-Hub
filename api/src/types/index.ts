import type { AuthenticatedUser } from './express';

export type { AuthenticatedUser };

export interface JwtAccessPayload {
  sub: string;
  role: string;
  orgId: string;
}

export interface JwtRefreshPayload {
  sub: string;
  familyId: string;
  jti: string;
}
