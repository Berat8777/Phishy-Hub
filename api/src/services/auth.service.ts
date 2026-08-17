import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Transaction } from 'sequelize';
import ms from '../utils/ms';
import { env } from '../config/env';
import { sequelize, Organization, User, RefreshToken, Department } from '../models';
import { ConflictError, ForbiddenError, UnauthorizedError, BadRequestError } from '../utils/errors';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  decodeExpiry,
  hashRefreshToken,
} from './token.service';
import { logger } from '../utils/logger';
import type { UserRole } from '../utils/constants';

export interface RequestMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

let cachedOrganizationId: string | null = null;

/**
 * Single-tenant deployment (architecture doc, open question #1): there is
 * exactly one seeded Organization row. Cached after first lookup instead of
 * threading an orgId through every call site.
 */
export async function getDefaultOrganizationId(): Promise<string> {
  if (cachedOrganizationId) return cachedOrganizationId;
  const org = await Organization.findOne({ order: [['createdAt', 'ASC']] });
  if (!org) {
    throw new Error('No Organization row found — has the demo seeder been run?');
  }
  cachedOrganizationId = org.id;
  return org.id;
}

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  departmentId?: string | null;
}): Promise<InstanceType<typeof User>> {
  const email = input.email.trim().toLowerCase();

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new ConflictError('Email is already registered');
  }

  if (input.departmentId) {
    const department = await Department.findByPk(input.departmentId);
    if (!department) {
      throw new BadRequestError('departmentId does not reference an existing department');
    }
  }

  const passwordHash = await bcrypt.hash(input.password, env.bcryptRounds);

  // Self-registration always lands as a plain `employee` — elevated roles
  // are granted later via the admin-only user management endpoints, never
  // chosen by the registrant. `status` starts `active` (no invite/approval
  // step is specified for Module 1).
  const user = await User.create({
    email,
    passwordHash,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    role: 'employee',
    status: 'active',
    departmentId: input.departmentId ?? null,
  });

  return user;
}

async function issueTokenPair(
  userId: string,
  role: UserRole,
  meta: RequestMeta,
  familyId: string = randomUUID(),
  transaction?: Transaction,
): Promise<TokenPair> {
  const orgId = await getDefaultOrganizationId();
  const jti = randomUUID();

  const accessToken = signAccessToken({ sub: userId, role, orgId });
  const refreshToken = signRefreshToken({ sub: userId, familyId, jti });

  const expiresAt = decodeExpiry(refreshToken) ?? new Date(Date.now() + ms(env.jwt.refreshExpiresIn));

  await RefreshToken.create(
    {
      id: jti,
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      familyId,
      expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
    { transaction },
  );

  return { accessToken, refreshToken, accessTokenExpiresIn: ms(env.jwt.accessExpiresIn) / 1000 };
}

export async function login(
  email: string,
  password: string,
  meta: RequestMeta,
): Promise<{ user: InstanceType<typeof User>; tokens: TokenPair }> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.scope('withPassword').findOne({ where: { email: normalizedEmail } });

  // Same error for "no such user" and "wrong password" — don't leak which one it was.
  // The `@ai` bot user (Module 7, utils/constants.ts::AI_BOT_USER_ID) has no
  // real credentials and must never be able to log in — rejected with the
  // same generic message so its existence isn't distinguishable either.
  if (!user || user.isBot || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.status !== 'active') {
    throw new ForbiddenError('Account is not active');
  }

  const tokens = await issueTokenPair(user.id, user.role, meta);

  // Re-fetch through the default scope so the returned user never carries passwordHash.
  const sanitized = await User.findByPk(user.id);
  return { user: sanitized!, tokens };
}

/**
 * Refresh rotation + reuse detection (architecture doc §3). A refresh token
 * can only ever be used once: using it issues a new one and marks the old
 * row `revoked_at` + `replaced_by_token_id`. If a token whose
 * `replaced_by_token_id` is already set gets presented again, that's proof
 * a token got used twice — the whole family is revoked so the legitimate
 * session and any stolen copy both get kicked back to login.
 *
 * Concurrency: the read-check-write sequence below runs inside a DB
 * transaction with a `SELECT ... FOR UPDATE` row lock on the RefreshToken
 * row. Without this, two simultaneous refresh calls with the same token
 * (a realistic race — see CONTRACT.md §4.1's "socket drops every 15min,
 * client reconnects with a refresh" flow) could both read `revokedAt: null`
 * before either writes, mint two valid child tokens, and never trip reuse
 * detection at all. The lock serializes the second caller behind the first;
 * by the time it re-reads the row, `revokedAt` is already set and it
 * correctly hits the reuse-detected branch.
 */
export async function refresh(presentedToken: string, meta: RequestMeta): Promise<TokenPair> {
  const payload = verifyRefreshToken(presentedToken);

  const transaction = await sequelize.transaction();
  // Sequelize's `Transaction.finished` ('commit'|'rollback' once settled) exists
  // at runtime but isn't in the public TS types — track completion locally instead.
  let settled = false;
  try {
    const record = await RefreshToken.findByPk(payload.jti, {
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });

    if (!record || record.userId !== payload.sub || record.familyId !== payload.familyId) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (record.tokenHash !== hashRefreshToken(presentedToken)) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh token expired');
    }

    if (record.revokedAt) {
      if (record.replacedByTokenId) {
        logger.warn({ userId: record.userId, familyId: record.familyId }, 'refresh token reuse detected');
        await RefreshToken.update(
          { revokedAt: new Date() },
          { where: { familyId: record.familyId, revokedAt: null }, transaction },
        );
      }
      // Commit the family-revoke write (if any) before throwing — the
      // catch block below rolls back on error, which would otherwise undo
      // the very revocation this branch exists to perform.
      await transaction.commit();
      settled = true;
      throw new UnauthorizedError('Refresh token has been revoked, please log in again');
    }

    const user = await User.findByPk(record.userId, { transaction });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedError('Account is no longer active');
    }

    const tokens = await issueTokenPair(user.id, user.role, meta, record.familyId, transaction);

    record.revokedAt = new Date();
    // jti of the token we just minted is embedded in its own signed payload;
    // decode it back out rather than threading it separately through issueTokenPair.
    const newJti = verifyRefreshToken(tokens.refreshToken).jti;
    record.replacedByTokenId = newJti;
    await record.save({ transaction });

    await transaction.commit();
    settled = true;
    return tokens;
  } catch (err) {
    if (!settled) {
      await transaction.rollback();
    }
    throw err;
  }
}

/** Best-effort, idempotent: an already-expired/invalid token still "successfully" logs out. */
export async function logout(presentedToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(presentedToken);
    const record = await RefreshToken.findByPk(payload.jti);
    if (record && !record.revokedAt) {
      record.revokedAt = new Date();
      await record.save();
    }
  } catch {
    // Token already invalid/expired — nothing to revoke, treat as success.
  }
}
