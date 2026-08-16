import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from './helpers/testServer';
import { registerAndLogin, loginDemoUser, bearer } from './helpers/factories';
import type { AuthedSession } from './helpers/factories';
import { DEMO_USERS } from './helpers/demoUsers';

/**
 * Modül 5 — two-stage leave approval chain (leaveRequest.service.ts),
 * mirrors the style of tests/messageFeatures.test.ts. Uses the seeded demo
 * departments (Engineering has a manager, dev1; Support has none — see
 * src/database/seeders/20260101000100-demo-seed.js) rather than creating
 * new departments, since department creation is admin/hr-only and the seed
 * data already exercises both the managed and unmanaged paths.
 */
describe('leave request approval chain', () => {
  let app: Express;
  let admin: AuthedSession;
  let hr: AuthedSession;
  let dev1: AuthedSession; // seeded manager of Engineering
  let engineeringDeptId: string;
  let supportDeptId: string;

  beforeAll(async () => {
    app = buildApp();
    admin = await loginDemoUser(app, DEMO_USERS.admin);
    hr = await loginDemoUser(app, DEMO_USERS.hr);
    dev1 = await loginDemoUser(app, DEMO_USERS.dev1);

    const departments = await request(app)
      .get('/api/v1/departments?pageSize=50')
      .set('Authorization', bearer(admin.accessToken));
    const engineering = departments.body.data.find((d: { name: string }) => d.name === 'Engineering');
    const support = departments.body.data.find((d: { name: string }) => d.name === 'Support');
    expect(engineering).toBeTruthy();
    expect(support).toBeTruthy();
    engineeringDeptId = engineering.id;
    supportDeptId = support.id;
  });

  describe('auto-skip to manager_approved when the department has no manager', () => {
    it('a request from a department with no manager (Support) is created directly as manager_approved', async () => {
      const requester = await registerAndLogin(app, { departmentId: supportDeptId });

      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(requester.accessToken))
        .send({ type: 'annual', startDate: '2027-01-04', endDate: '2027-01-05' });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('manager_approved');
    });

    it('a request from a user with no department at all is also auto-skipped', async () => {
      const requester = await registerAndLogin(app);

      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(requester.accessToken))
        .send({ type: 'annual', startDate: '2027-01-06', endDate: '2027-01-07' });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('manager_approved');
    });
  });

  describe('managed department (Engineering, manager = dev1) — normal two-stage chain', () => {
    it('stays pending at creation, a non-manager/non-hr/non-admin cannot review it (403), the two-stage happy path ends in approved', async () => {
      const requester = await registerAndLogin(app, { departmentId: engineeringDeptId });
      const outsider = await registerAndLogin(app);

      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(requester.accessToken))
        .send({ type: 'annual', startDate: '2027-02-01', endDate: '2027-02-03' });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.status).toBe('pending');
      const leaveRequestId = createRes.body.data.id;

      // Not the department manager, not hr/admin -> 403.
      const outsiderReview = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestId}/review`)
        .set('Authorization', bearer(outsider.accessToken))
        .send({ decision: 'approve' });
      expect(outsiderReview.status).toBe(403);

      // Stage 1: the department manager approves -> manager_approved.
      const managerReview = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestId}/review`)
        .set('Authorization', bearer(dev1.accessToken))
        .send({ decision: 'approve', reviewNote: 'Looks fine to me' });
      expect(managerReview.status).toBe(200);
      expect(managerReview.body.data.status).toBe('manager_approved');

      // hr/admin cannot be skipped at stage 1 by a non-manager, but stage 2 is hr/admin-only:
      // the manager themselves can no longer act on it now that it's manager_approved.
      const managerSecondAttempt = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestId}/review`)
        .set('Authorization', bearer(dev1.accessToken))
        .send({ decision: 'approve' });
      expect(managerSecondAttempt.status).toBe(403);

      // Stage 2: hr gives the final approval -> approved.
      const hrReview = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestId}/review`)
        .set('Authorization', bearer(hr.accessToken))
        .send({ decision: 'approve' });
      expect(hrReview.status).toBe(200);
      expect(hrReview.body.data.status).toBe('approved');
    });

    it('the manager can reject at stage 1', async () => {
      const requester = await registerAndLogin(app, { departmentId: engineeringDeptId });

      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(requester.accessToken))
        .send({ type: 'sick', startDate: '2027-02-10', endDate: '2027-02-10' });
      const leaveRequestId = createRes.body.data.id;

      const rejectRes = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestId}/review`)
        .set('Authorization', bearer(dev1.accessToken))
        .send({ decision: 'reject', reviewNote: 'Not enough coverage that day' });
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('rejected');
    });
  });

  describe('overlap validation on create', () => {
    it('rejects (400) a new request whose date range overlaps an existing pending/manager_approved/approved request', async () => {
      const requester = await registerAndLogin(app);

      const first = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(requester.accessToken))
        .send({ type: 'annual', startDate: '2027-03-10', endDate: '2027-03-15' });
      expect(first.status).toBe(201);

      // Fully overlapping.
      const overlapExact = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(requester.accessToken))
        .send({ type: 'sick', startDate: '2027-03-10', endDate: '2027-03-15' });
      expect(overlapExact.status).toBe(400);

      // Partial overlap (tail end of the new range touches the start of the existing one).
      const overlapPartial = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(requester.accessToken))
        .send({ type: 'unpaid', startDate: '2027-03-05', endDate: '2027-03-10' });
      expect(overlapPartial.status).toBe(400);

      // Non-overlapping — should succeed.
      const noOverlap = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(requester.accessToken))
        .send({ type: 'other', startDate: '2027-03-16', endDate: '2027-03-17' });
      expect(noOverlap.status).toBe(201);
    });
  });

  describe('GET /leave-calendar', () => {
    it('never includes a `reason` field in its response shape', async () => {
      const requester = await registerAndLogin(app, { departmentId: engineeringDeptId });

      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', bearer(requester.accessToken))
        .send({
          type: 'annual',
          startDate: '2027-04-01',
          endDate: '2027-04-02',
          reason: 'A very private medical reason that must never leak into the team calendar',
        });
      expect(createRes.status).toBe(201);

      const calendarRes = await request(app)
        .get(`/api/v1/leave-calendar?from=2027-04-01&to=2027-04-30&departmentId=${engineeringDeptId}`)
        .set('Authorization', bearer(requester.accessToken));
      expect(calendarRes.status).toBe(200);
      expect(calendarRes.body.data.length).toBeGreaterThan(0);

      for (const entry of calendarRes.body.data) {
        expect(entry.reason).toBeUndefined();
        expect(entry.reviewNote).toBeUndefined();
      }
      const match = calendarRes.body.data.find((e: { id: string }) => e.id === createRes.body.data.id);
      expect(match).toBeTruthy();
      expect(Object.keys(match).sort()).toEqual(['endDate', 'id', 'startDate', 'status', 'type', 'user', 'userId'].sort());
    });

    it('rejects a date range wider than ~92 days (400)', async () => {
      const requester = await registerAndLogin(app, { departmentId: engineeringDeptId });
      const res = await request(app)
        .get(`/api/v1/leave-calendar?from=2027-01-01&to=2027-12-31&departmentId=${engineeringDeptId}`)
        .set('Authorization', bearer(requester.accessToken));
      expect(res.status).toBe(400);
    });
  });

  describe('GET /leave-requests/balance', () => {
    it('only the annual type has a non-null remainingDays; self can view their own balance', async () => {
      const res = await request(app)
        .get('/api/v1/leave-requests/balance')
        .set('Authorization', bearer(dev1.accessToken));
      expect(res.status).toBe(200);
      const annual = res.body.data.find((e: { type: string }) => e.type === 'annual');
      expect(annual.remainingDays).not.toBeNull();
      const sick = res.body.data.find((e: { type: string }) => e.type === 'sick');
      expect(sick.remainingDays).toBeNull();
    });

    it('a non-manager/non-hr/non-admin cannot view another user\'s balance (403)', async () => {
      const outsider = await registerAndLogin(app);
      const res = await request(app)
        .get(`/api/v1/leave-requests/balance?userId=${dev1.userId}`)
        .set('Authorization', bearer(outsider.accessToken));
      expect(res.status).toBe(403);
    });
  });
});
