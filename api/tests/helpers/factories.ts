import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Express } from 'express';
import { DEMO_PASSWORD } from './demoUsers';

/** Unique-per-call email so tests can run against a shared DB without colliding on the unique index. */
export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}.${randomUUID()}@test.local`;
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

export interface RegisterOverrides {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string | null;
  /** Deliberately allowed through so tests can assert the server ignores it (see auth.test.ts). */
  role?: string;
}

/** POST /auth/register — returns the raw supertest response plus the credentials used. */
export async function registerUser(app: Express, overrides: RegisterOverrides = {}) {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? DEMO_PASSWORD;
  const body: Record<string, unknown> = {
    email,
    password,
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
  };
  if (overrides.departmentId !== undefined) body.departmentId = overrides.departmentId;
  if (overrides.role !== undefined) body.role = overrides.role;

  const res = await request(app).post('/api/v1/auth/register').send(body);
  return { res, email, password };
}

/** POST /auth/login */
export async function login(app: Express, email: string, password: string) {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

export interface AuthedSession {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  userId: string;
  email: string;
  password: string;
}

/** Registers a brand-new throwaway `employee` and logs them in. */
export async function registerAndLogin(app: Express, overrides: RegisterOverrides = {}): Promise<AuthedSession> {
  const { res: registerRes, email, password } = await registerUser(app, overrides);
  if (registerRes.status !== 201) {
    throw new Error(`registerAndLogin: register failed (${registerRes.status}): ${JSON.stringify(registerRes.body)}`);
  }
  const res = await login(app, email, password);
  if (res.status !== 200) {
    throw new Error(`registerAndLogin: login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
    accessTokenExpiresIn: res.body.data.accessTokenExpiresIn,
    userId: res.body.data.user.id,
    email,
    password,
  };
}

/** Logs in as one of the fixed demo/seed accounts (src/database/seeders). */
export async function loginDemoUser(app: Express, email: string): Promise<AuthedSession> {
  const res = await login(app, email, DEMO_PASSWORD);
  if (res.status !== 200) {
    throw new Error(`loginDemoUser(${email}): login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
    accessTokenExpiresIn: res.body.data.accessTokenExpiresIn,
    userId: res.body.data.user.id,
    email,
    password: DEMO_PASSWORD,
  };
}
