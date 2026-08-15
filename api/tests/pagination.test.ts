import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from './helpers/testServer';
import { registerAndLogin, bearer } from './helpers/factories';
import type { AuthedSession } from './helpers/factories';

describe('pagination — sort whitelist regression', () => {
  let app: Express;
  let session: AuthedSession;

  beforeAll(async () => {
    app = buildApp();
    session = await registerAndLogin(app);
  });

  it('GET /users?sort=<real-but-unlisted column> -> 422, never a raw 500', async () => {
    const res = await request(app)
      .get('/api/v1/users?sort=passwordHash')
      .set('Authorization', bearer(session.accessToken));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /users?sort=<SQL-injection-shaped garbage> -> 422', async () => {
    const res = await request(app)
      .get('/api/v1/users?sort=' + encodeURIComponent('id; DROP TABLE users;--'))
      .set('Authorization', bearer(session.accessToken));
    expect(res.status).toBe(422);
  });

  it('GET /tickets?sort=<unknown column> -> 422', async () => {
    const res = await request(app)
      .get('/api/v1/tickets?sort=notAColumn')
      .set('Authorization', bearer(session.accessToken));
    expect(res.status).toBe(422);
  });

  it('GET /departments?sort=<unknown column> -> 422', async () => {
    const res = await request(app)
      .get('/api/v1/departments?sort=' + encodeURIComponent("name'); --"))
      .set('Authorization', bearer(session.accessToken));
    expect(res.status).toBe(422);
  });

  it('a whitelisted sort field still works (happy path)', async () => {
    const res = await request(app)
      .get('/api/v1/users?sort=email&order=ASC&pageSize=5')
      .set('Authorization', bearer(session.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 5 });
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('pageSize is clamped to the max (100) instead of erroring or DoS-ing the query', async () => {
    const res = await request(app)
      .get('/api/v1/users?pageSize=99999')
      .set('Authorization', bearer(session.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.meta.pageSize).toBe(100);
  });

  it('page below 1 is clamped to 1 rather than producing a negative offset', async () => {
    const res = await request(app)
      .get('/api/v1/users?page=-5')
      .set('Authorization', bearer(session.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(1);
  });
});
