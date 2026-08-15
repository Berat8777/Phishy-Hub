import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from './helpers/testServer';
import { registerAndLogin, loginDemoUser, bearer, uniqueEmail } from './helpers/factories';
import { DEMO_USERS } from './helpers/demoUsers';
import type { AuthedSession } from './helpers/factories';

const NON_EXISTENT_UUID = '00000000-0000-4000-8000-000000000000';

describe('CRUD edge cases / business-rule validation', () => {
  let app: Express;
  let admin: AuthedSession;
  let employee: AuthedSession;

  beforeAll(async () => {
    app = buildApp();
    admin = await loginDemoUser(app, DEMO_USERS.admin);
    employee = await registerAndLogin(app);
  });

  describe('users', () => {
    it('admin-create with non-existent departmentId -> 400, not 500', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', bearer(admin.accessToken))
        .send({
          email: uniqueEmail('admincreated'),
          password: 'Password123!',
          firstName: 'No',
          lastName: 'Dept',
          departmentId: NON_EXISTENT_UUID,
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('DELETE /users/:id is admin-only — hr gets 403, admin gets 200 (soft delete)', async () => {
      const targetForHr = await registerAndLogin(app);
      const hr = await loginDemoUser(app, DEMO_USERS.hr);
      const hrAttempt = await request(app)
        .delete(`/api/v1/users/${targetForHr.userId}`)
        .set('Authorization', bearer(hr.accessToken));
      expect(hrAttempt.status).toBe(403);

      const targetForAdmin = await registerAndLogin(app);
      const adminAttempt = await request(app)
        .delete(`/api/v1/users/${targetForAdmin.userId}`)
        .set('Authorization', bearer(admin.accessToken));
      expect(adminAttempt.status).toBe(200);
      expect(adminAttempt.body.data.deleted).toBe(true);
    });

    it('PATCH /users/:id requires admin/hr — a plain employee gets 403', async () => {
      const target = await registerAndLogin(app);
      const res = await request(app)
        .patch(`/api/v1/users/${target.userId}`)
        .set('Authorization', bearer(employee.accessToken))
        .send({ status: 'suspended' });
      expect(res.status).toBe(403);
    });
  });

  describe('departments', () => {
    it('creating a department requires admin/hr — employee gets 403', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', bearer(employee.accessToken))
        .send({ name: `Dept-${uniqueEmail()}` });
      expect(res.status).toBe(403);
    });

    it('admin can create a department', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', bearer(admin.accessToken))
        .send({ name: `Dept-${uniqueEmail()}` });
      expect(res.status).toBe(201);
    });
  });

  describe('channels', () => {
    it('cannot join a private channel directly -> 400 (must be added by a channel/global admin)', async () => {
      const owner = await registerAndLogin(app);
      const outsider = await registerAndLogin(app);
      const createRes = await request(app)
        .post('/api/v1/channels')
        .set('Authorization', bearer(owner.accessToken))
        .send({ type: 'private', name: `private-${uniqueEmail('c')}` });

      const joinRes = await request(app)
        .post(`/api/v1/channels/${createRes.body.data.id}/join`)
        .set('Authorization', bearer(outsider.accessToken));
      expect(joinRes.status).toBe(400);
    });

    it('joining the same public channel twice -> 409 CONFLICT', async () => {
      const owner = await registerAndLogin(app);
      const joiner = await registerAndLogin(app);
      const createRes = await request(app)
        .post('/api/v1/channels')
        .set('Authorization', bearer(owner.accessToken))
        .send({ type: 'public', name: `public-${uniqueEmail('c')}` });
      const channelId = createRes.body.data.id;

      const firstJoin = await request(app)
        .post(`/api/v1/channels/${channelId}/join`)
        .set('Authorization', bearer(joiner.accessToken));
      expect(firstJoin.status).toBe(201);

      const secondJoin = await request(app)
        .post(`/api/v1/channels/${channelId}/join`)
        .set('Authorization', bearer(joiner.accessToken));
      expect(secondJoin.status).toBe(409);
    });

    it('creating a non-DM channel without a name -> 400', async () => {
      const res = await request(app)
        .post('/api/v1/channels')
        .set('Authorization', bearer(employee.accessToken))
        .send({ type: 'public' });
      expect(res.status).toBe(400);
    });
  });

  describe('messages', () => {
    it('a message with neither body nor attachments -> 400', async () => {
      const owner = await registerAndLogin(app);
      const createRes = await request(app)
        .post('/api/v1/channels')
        .set('Authorization', bearer(owner.accessToken))
        .send({ type: 'public', name: `empty-msg-${uniqueEmail('c')}` });
      const channelId = createRes.body.data.id;

      const res = await request(app)
        .post(`/api/v1/channels/${channelId}/messages`)
        .set('Authorization', bearer(owner.accessToken))
        .send({});
      expect(res.status).toBe(400);
    });

    it('replyToMessageId pointing at a message in a different channel -> 400', async () => {
      const owner = await registerAndLogin(app);
      const channelA = await request(app)
        .post('/api/v1/channels')
        .set('Authorization', bearer(owner.accessToken))
        .send({ type: 'public', name: `reply-a-${uniqueEmail('c')}` });
      const channelB = await request(app)
        .post('/api/v1/channels')
        .set('Authorization', bearer(owner.accessToken))
        .send({ type: 'public', name: `reply-b-${uniqueEmail('c')}` });

      const msgInA = await request(app)
        .post(`/api/v1/channels/${channelA.body.data.id}/messages`)
        .set('Authorization', bearer(owner.accessToken))
        .send({ body: 'in channel A' });

      const crossChannelReply = await request(app)
        .post(`/api/v1/channels/${channelB.body.data.id}/messages`)
        .set('Authorization', bearer(owner.accessToken))
        .send({ body: 'reply', replyToMessageId: msgInA.body.data.id });
      expect(crossChannelReply.status).toBe(400);
    });
  });

  describe('tickets', () => {
    it('assigning to a non-existent user -> 400', async () => {
      const createRes = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', bearer(employee.accessToken))
        .send({ title: 'Broken thing' });

      const res = await request(app)
        .post(`/api/v1/tickets/${createRes.body.data.id}/assign`)
        .set('Authorization', bearer(employee.accessToken))
        .send({ assignedToId: NON_EXISTENT_UUID });
      expect(res.status).toBe(400);
    });
  });

  describe('leave requests', () => {
    it('endDate before startDate -> 400', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(employee.accessToken))
        .send({ type: 'annual', startDate: '2026-09-10', endDate: '2026-09-01' });
      expect(res.status).toBe(400);
    });

    it('reviewing a request that is not pending anymore -> 400', async () => {
      const hr = await loginDemoUser(app, DEMO_USERS.hr);
      const requester = await registerAndLogin(app);

      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(requester.accessToken))
        .send({ type: 'unpaid', startDate: '2026-11-01', endDate: '2026-11-02' });
      const id = createRes.body.data.id;

      await request(app)
        .post(`/api/v1/leave-requests/${id}/review`)
        .set('Authorization', bearer(hr.accessToken))
        .send({ status: 'approved' })
        .expect(200);

      const secondReview = await request(app)
        .post(`/api/v1/leave-requests/${id}/review`)
        .set('Authorization', bearer(hr.accessToken))
        .send({ status: 'rejected' });
      expect(secondReview.status).toBe(400);
    });

    it('malformed (non-ISO8601) dates -> 422', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(employee.accessToken))
        .send({ type: 'annual', startDate: 'not-a-date', endDate: '2026-09-01' });
      expect(res.status).toBe(422);
    });
  });
});
