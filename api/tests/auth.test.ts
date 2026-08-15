import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { buildApp } from './helpers/testServer';
import { registerUser, registerAndLogin, login, loginDemoUser, uniqueEmail, bearer } from './helpers/factories';
import { DEMO_USERS } from './helpers/demoUsers';

describe('auth', () => {
  let app: Express;

  beforeAll(() => {
    app = buildApp();
  });

  describe('register', () => {
    it('happy path: 201, role is always employee, status active', async () => {
      const { res, email } = await registerUser(app);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.role).toBe('employee');
      expect(res.body.data.user.status).toBe('active');
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('regression: client-supplied role is ignored, never grants elevated access', async () => {
      const { res } = await registerUser(app, { role: 'admin' });
      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('employee');
    });

    it('duplicate email -> 409 CONFLICT', async () => {
      const { email, password } = await registerUser(app);
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password, firstName: 'Dupe', lastName: 'User' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('missing required fields -> 422 VALIDATION_ERROR', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: uniqueEmail() });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('password shorter than 8 chars -> 422', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: uniqueEmail(), password: 'short', firstName: 'A', lastName: 'B' });
      expect(res.status).toBe(422);
    });

    it('non-existent departmentId -> 400 BAD_REQUEST (not 500)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: uniqueEmail(),
        password: 'Password123!',
        firstName: 'Dept',
        lastName: 'Less',
        departmentId: '00000000-0000-4000-8000-000000000000',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('login', () => {
    it('happy path: returns user + token triple, never leaks passwordHash', async () => {
      const { email, password } = await registerUser(app);
      const res = await login(app, email, password);
      expect(res.status).toBe(200);
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(typeof res.body.data.refreshToken).toBe('string');
      expect(typeof res.body.data.accessTokenExpiresIn).toBe('number');
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
    });

    it('regression: wrong password vs non-existent email return the identical error (no user enumeration)', async () => {
      const { email } = await registerUser(app);

      const wrongPassword = await login(app, email, 'TotallyWrongPassword1!');
      const noSuchUser = await login(app, uniqueEmail('ghost'), 'TotallyWrongPassword1!');

      expect(wrongPassword.status).toBe(401);
      expect(noSuchUser.status).toBe(401);
      expect(wrongPassword.body.error.code).toBe('UNAUTHORIZED');
      expect(noSuchUser.body.error.code).toBe('UNAUTHORIZED');
      expect(wrongPassword.body.error.message).toBe(noSuchUser.body.error.message);
    });

    it('invalid email format -> 422', async () => {
      const res = await login(app, 'not-an-email', 'whatever123');
      expect(res.status).toBe(422);
    });
  });

  describe('protected routes / token validation', () => {
    it('no Authorization header -> 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('garbage/malformed token -> 401', async () => {
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-real-jwt');
      expect(res.status).toBe(401);
    });

    it('expired access token -> 401', async () => {
      const secret = process.env.JWT_ACCESS_SECRET!;
      const expired = jwt.sign({ sub: 'ffffffff-ffff-4fff-8fff-ffffffffffff', role: 'employee', orgId: 'x' }, secret, {
        expiresIn: -10,
      });
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', bearer(expired));
      expect(res.status).toBe(401);
    });

    it('valid token -> 200, returns own profile', async () => {
      const session = await registerAndLogin(app);
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', bearer(session.accessToken));
      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(session.userId);
    });
  });

  describe('refresh rotation + reuse detection (regression)', () => {
    it('happy path: refresh returns a new refresh token and a working access token', async () => {
      const session = await registerAndLogin(app);
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });
      expect(res.status).toBe(200);
      // The refresh token embeds a unique jti, so it's guaranteed to differ.
      // The access token's payload (sub/role/orgId/iat/exp) has second-level
      // precision and no nonce — HS256 signing is deterministic, so two
      // tokens minted for the same user within the same second CAN be
      // byte-identical without that being a bug. What must hold is that the
      // returned access token actually works.
      expect(res.body.data.refreshToken).not.toBe(session.refreshToken);
      const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', bearer(res.body.data.accessToken));
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.id).toBe(session.userId);
    });

    it('reusing an already-rotated refresh token is rejected AND revokes the whole family, including the token that replaced it', async () => {
      const session = await registerAndLogin(app);

      const first = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });
      expect(first.status).toBe(200);
      const rotatedToken = first.body.data.refreshToken as string;

      // Reuse of the original (already-spent) token: 401.
      const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });
      expect(reuse.status).toBe(401);
      expect(reuse.body.error.code).toBe('UNAUTHORIZED');

      // The legitimate child token must ALSO now be dead — reuse detection revokes the whole family.
      const rotatedNowRevoked = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: rotatedToken });
      expect(rotatedNowRevoked.status).toBe(401);
    });

    it('concurrency regression: 5 parallel refresh calls with the same token -> exactly one 200, the rest 401', async () => {
      const session = await registerAndLogin(app);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken }),
        ),
      );

      const successes = responses.filter((r) => r.status === 200);
      const failures = responses.filter((r) => r.status === 401);
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(4);
    });
  });

  describe('privilege escalation (regression)', () => {
    it('hr cannot grant the admin role -> 403', async () => {
      const target = await registerAndLogin(app);
      const hr = await loginDemoUser(app, DEMO_USERS.hr);

      const res = await request(app)
        .patch(`/api/v1/users/${target.userId}`)
        .set('Authorization', bearer(hr.accessToken))
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
    });

    it('hr CAN change a non-admin role (only admin-granting is blocked)', async () => {
      const target = await registerAndLogin(app);
      const hr = await loginDemoUser(app, DEMO_USERS.hr);

      const res = await request(app)
        .patch(`/api/v1/users/${target.userId}`)
        .set('Authorization', bearer(hr.accessToken))
        .send({ role: 'developer' });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('developer');
    });

    it('admin CAN grant the admin role -> 200', async () => {
      const target = await registerAndLogin(app);
      const admin = await loginDemoUser(app, DEMO_USERS.admin);

      const res = await request(app)
        .patch(`/api/v1/users/${target.userId}`)
        .set('Authorization', bearer(admin.accessToken))
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('admin');

      const check = await request(app)
        .get(`/api/v1/users/${target.userId}`)
        .set('Authorization', bearer(admin.accessToken));
      expect(check.body.data.role).toBe('admin');
    });

    it('employee cannot patch another user at all -> 403', async () => {
      const target = await registerAndLogin(app);
      const actor = await registerAndLogin(app);

      const res = await request(app)
        .patch(`/api/v1/users/${target.userId}`)
        .set('Authorization', bearer(actor.accessToken))
        .send({ role: 'developer' });

      expect(res.status).toBe(403);
    });
  });

  describe('logout', () => {
    it('happy path: revokes the token, subsequent refresh with it fails', async () => {
      const session = await registerAndLogin(app);

      const logoutRes = await request(app).post('/api/v1/auth/logout').send({ refreshToken: session.refreshToken });
      expect(logoutRes.status).toBe(200);

      const refreshAfterLogout = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken });
      expect(refreshAfterLogout.status).toBe(401);
    });

    it('is idempotent: an already-invalid token still returns 200', async () => {
      const res = await request(app).post('/api/v1/auth/logout').send({ refreshToken: 'garbage.not.a.token' });
      expect(res.status).toBe(200);
    });
  });
});
