import jwt, { JwtPayload } from 'jsonwebtoken';
import { createHash } from 'crypto';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import type { JwtAccessPayload, JwtRefreshPayload } from '../types';

/**
 * JWT sign/verify — the single source of truth used by both the REST
 * `authenticate` middleware and the Socket.IO auth middleware (architecture
 * doc §3/§4), so the two surfaces can never drift on token semantics.
 */

export function signAccessToken(payload: JwtAccessPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: JwtRefreshPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
    if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string' || typeof decoded.orgId !== 'string') {
      throw new UnauthorizedError('Malformed access token payload');
    }
    return { sub: decoded.sub, role: decoded.role, orgId: decoded.orgId };
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  try {
    const decoded = jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
    if (
      typeof decoded.sub !== 'string' ||
      typeof decoded.familyId !== 'string' ||
      typeof decoded.jti !== 'string'
    ) {
      throw new UnauthorizedError('Malformed refresh token payload');
    }
    return { sub: decoded.sub, familyId: decoded.familyId, jti: decoded.jti };
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}

/** Returns the token's expiry as a JS Date, decoding without verifying signature (caller must verify separately). */
export function decodeExpiry(token: string): Date | null {
  const decoded = jwt.decode(token) as JwtPayload | null;
  if (!decoded?.exp) return null;
  return new Date(decoded.exp * 1000);
}

/**
 * Refresh tokens are stored hashed (never in plaintext) so a DB leak alone
 * doesn't hand out usable sessions. SHA-256 (not bcrypt) is deliberate: the
 * input is already a high-entropy signed JWT, not a low-entropy user
 * password, so there's nothing for a slow adaptive hash to protect against
 * here — a fast, deterministic digest is exactly what a single equality
 * lookup by primary key (jti) needs.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
