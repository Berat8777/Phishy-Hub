import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from './helpers/testServer';
import { registerAndLogin, loginDemoUser, bearer, uniqueEmail } from './helpers/factories';
import { DEMO_USERS } from './helpers/demoUsers';

describe('authorization / multi-tenant isolation', () => {
  let app: Express;

  beforeAll(() => {
    app = buildApp();
  });

  describe('channel membership isolation', () => {
    it('a non-member cannot read a private channel or its messages (403), a member can', async () => {
      const owner = await registerAndLogin(app);
      const outsider = await registerAndLogin(app);

      const createRes = await request(app)
        .post('/api/v1/channels')
        .set('Authorization', bearer(owner.accessToken))
        .send({ type: 'private', name: `authz-${uniqueEmail('c')}` });
      expect(createRes.status).toBe(201);
      const channelId = createRes.body.data.id;

      const getAsOutsider = await request(app)
        .get(`/api/v1/channels/${channelId}`)
        .set('Authorization', bearer(outsider.accessToken));
      expect(getAsOutsider.status).toBe(403);

      const messagesAsOutsider = await request(app)
        .get(`/api/v1/channels/${channelId}/messages`)
        .set('Authorization', bearer(outsider.accessToken));
      expect(messagesAsOutsider.status).toBe(403);

      const postMessageAsOutsider = await request(app)
        .post(`/api/v1/channels/${channelId}/messages`)
        .set('Authorization', bearer(outsider.accessToken))
        .send({ body: 'sneaky' });
      expect(postMessageAsOutsider.status).toBe(403);

      const getAsOwner = await request(app)
        .get(`/api/v1/channels/${channelId}`)
        .set('Authorization', bearer(owner.accessToken));
      expect(getAsOwner.status).toBe(200);

      const postMessageAsOwner = await request(app)
        .post(`/api/v1/channels/${channelId}/messages`)
        .set('Authorization', bearer(owner.accessToken))
        .send({ body: 'hello' });
      expect(postMessageAsOwner.status).toBe(201);
    });

    it('regression using seeded data: employee1 (not in #engineering) is rejected, dev1 (member) is accepted', async () => {
      const admin = await loginDemoUser(app, DEMO_USERS.admin);
      const list = await request(app)
        .get('/api/v1/channels?pageSize=50')
        .set('Authorization', bearer(admin.accessToken));
      const engineering = list.body.data.find((c: { name: string }) => c.name === 'engineering');
      expect(engineering).toBeTruthy();

      const dev1 = await loginDemoUser(app, DEMO_USERS.dev1);
      const employee1 = await loginDemoUser(app, DEMO_USERS.employee1);

      const asDev1 = await request(app)
        .get(`/api/v1/channels/${engineering.id}`)
        .set('Authorization', bearer(dev1.accessToken));
      expect(asDev1.status).toBe(200);

      const asEmployee1 = await request(app)
        .get(`/api/v1/channels/${engineering.id}`)
        .set('Authorization', bearer(employee1.accessToken));
      expect(asEmployee1.status).toBe(403);
    });
  });

  describe('file access isolation', () => {
    it('a file attached to a channel-only message is visible to channel members, not to outsiders', async () => {
      const memberA = await registerAndLogin(app);
      const memberB = await registerAndLogin(app);
      const outsider = await registerAndLogin(app);

      const createChannel = await request(app)
        .post('/api/v1/channels')
        .set('Authorization', bearer(memberA.accessToken))
        .send({ type: 'private', name: `files-authz-${uniqueEmail('c')}`, memberIds: [memberB.userId] });
      const channelId = createChannel.body.data.id;

      const uploadRes = await request(app)
        .post('/api/v1/files')
        .set('Authorization', bearer(memberA.accessToken))
        .attach('file', Buffer.from('hello world, this is a shared file'), {
          filename: 'shared.txt',
          contentType: 'text/plain',
        });
      expect(uploadRes.status).toBe(201);
      const fileId = uploadRes.body.data.id;

      const postMessage = await request(app)
        .post(`/api/v1/channels/${channelId}/messages`)
        .set('Authorization', bearer(memberA.accessToken))
        .send({ body: 'see attached', fileIds: [fileId] });
      expect(postMessage.status).toBe(201);

      const asOutsider = await request(app)
        .get(`/api/v1/files/${fileId}`)
        .set('Authorization', bearer(outsider.accessToken));
      expect(asOutsider.status).toBe(403);

      const asMember = await request(app)
        .get(`/api/v1/files/${fileId}`)
        .set('Authorization', bearer(memberB.accessToken));
      expect(asMember.status).toBe(200);
      expect(typeof asMember.body.data.url).toBe('string');

      const asUploader = await request(app)
        .get(`/api/v1/files/${fileId}`)
        .set('Authorization', bearer(memberA.accessToken));
      expect(asUploader.status).toBe(200);
    });
  });

  describe('ticket close authorization', () => {
    it('only the assignee or a global admin may close a ticket (403 for everyone else)', async () => {
      const creator = await registerAndLogin(app);
      const assignee = await registerAndLogin(app);
      const outsider = await registerAndLogin(app);
      const admin = await loginDemoUser(app, DEMO_USERS.admin);

      const createRes = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', bearer(creator.accessToken))
        .send({ title: 'Printer on fire' });
      const ticketId = createRes.body.data.id;

      await request(app)
        .post(`/api/v1/tickets/${ticketId}/assign`)
        .set('Authorization', bearer(creator.accessToken))
        .send({ assignedToId: assignee.userId })
        .expect(200);

      const outsiderClose = await request(app)
        .post(`/api/v1/tickets/${ticketId}/status`)
        .set('Authorization', bearer(outsider.accessToken))
        .send({ status: 'closed' });
      expect(outsiderClose.status).toBe(403);

      const creatorClose = await request(app)
        .post(`/api/v1/tickets/${ticketId}/status`)
        .set('Authorization', bearer(creator.accessToken))
        .send({ status: 'closed' });
      expect(creatorClose.status).toBe(403);

      const assigneeClose = await request(app)
        .post(`/api/v1/tickets/${ticketId}/status`)
        .set('Authorization', bearer(assignee.accessToken))
        .send({ status: 'closed' });
      expect(assigneeClose.status).toBe(200);
      expect(assigneeClose.body.data.status).toBe('closed');

      // Admin can close any ticket, assigned or not.
      const secondTicket = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', bearer(creator.accessToken))
        .send({ title: 'Another one' });
      const adminClose = await request(app)
        .post(`/api/v1/tickets/${secondTicket.body.data.id}/status`)
        .set('Authorization', bearer(admin.accessToken))
        .send({ status: 'closed' });
      expect(adminClose.status).toBe(200);

      // Non-close status transitions remain open to anyone authenticated.
      const thirdTicket = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', bearer(creator.accessToken))
        .send({ title: 'Third' });
      const outsiderProgress = await request(app)
        .post(`/api/v1/tickets/${thirdTicket.body.data.id}/status`)
        .set('Authorization', bearer(outsider.accessToken))
        .send({ status: 'in_progress' });
      expect(outsiderProgress.status).toBe(200);
    });
  });

  describe('leave request approval flow', () => {
    it('only hr/admin can review; the owner gets a notification once reviewed', async () => {
      const employee = await registerAndLogin(app);
      const hr = await loginDemoUser(app, DEMO_USERS.hr);

      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(employee.accessToken))
        .send({ type: 'annual', startDate: '2026-09-01', endDate: '2026-09-03' });
      expect(createRes.status).toBe(201);
      const leaveRequestId = createRes.body.data.id;

      const selfReview = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestId}/review`)
        .set('Authorization', bearer(employee.accessToken))
        .send({ status: 'approved' });
      expect(selfReview.status).toBe(403);

      const hrReview = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestId}/review`)
        .set('Authorization', bearer(hr.accessToken))
        .send({ status: 'approved' });
      expect(hrReview.status).toBe(200);
      expect(hrReview.body.data.status).toBe('approved');

      const notifications = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', bearer(employee.accessToken));
      expect(notifications.status).toBe(200);
      const match = notifications.body.data.find(
        (n: { type: string; payload: { leaveRequestId: string } }) =>
          n.type === 'leave_request_reviewed' && n.payload.leaveRequestId === leaveRequestId,
      );
      expect(match).toBeTruthy();
    });

    it('another employee cannot cancel someone else\'s pending request (403); the owner can', async () => {
      const owner = await registerAndLogin(app);
      const other = await registerAndLogin(app);

      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(owner.accessToken))
        .send({ type: 'sick', startDate: '2026-10-01', endDate: '2026-10-02' });
      const leaveRequestId = createRes.body.data.id;

      const otherCancel = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestId}/cancel`)
        .set('Authorization', bearer(other.accessToken));
      expect(otherCancel.status).toBe(403);

      const ownerCancel = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestId}/cancel`)
        .set('Authorization', bearer(owner.accessToken));
      expect(ownerCancel.status).toBe(200);
      expect(ownerCancel.body.data.status).toBe('cancelled');
    });
  });
});
