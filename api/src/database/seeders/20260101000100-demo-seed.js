'use strict';

const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
const DEMO_PASSWORD = 'Password123!';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

    const orgId = randomUUID();
    await queryInterface.bulkInsert('organizations', [
      { id: orgId, name: 'Phishy Hub', slug: 'phishy-hub', created_at: now, updated_at: now },
    ]);

    // User ids are pre-generated here (not left to DB defaults) so a
    // department row can reference its manager's user id at insert time,
    // even though users are only inserted after departments below.
    const userIds = {
      admin: randomUUID(),
      hr: randomUUID(),
      dev1: randomUUID(),
      dev2: randomUUID(),
      sales1: randomUUID(),
      employee1: randomUUID(),
    };

    const departments = [
      // Engineering has a manager (dev1) — exercises the normal two-stage
      // approval chain (manager review, then hr review).
      { id: randomUUID(), name: 'Engineering', managerId: userIds.dev1 },
      // Sales/HR/Support are deliberately left without a manager — exercises
      // the auto-skip-to-manager_approved path in leaveRequest.service.ts.
      { id: randomUUID(), name: 'Sales', managerId: null },
      { id: randomUUID(), name: 'Human Resources', managerId: null },
      { id: randomUUID(), name: 'Support', managerId: null },
    ];
    // Inserted WITHOUT manager_id first — the FK target (users) doesn't
    // exist yet at this point, since User.departmentId requires departments
    // to exist first. manager_id is backfilled via bulkUpdate once users
    // are inserted below.
    await queryInterface.bulkInsert(
      'departments',
      departments.map((d) => ({
        id: d.id,
        organization_id: orgId,
        name: d.name,
        manager_id: null,
        created_at: now,
        updated_at: now,
      })),
    );
    const [engineering, sales, hr, support] = departments;

    const users = [
      {
        id: userIds.admin,
        email: 'admin@phishyhub.local',
        first_name: 'Ada',
        last_name: 'Admin',
        role: 'admin',
        department_id: engineering.id,
      },
      {
        id: userIds.hr,
        email: 'hr@phishyhub.local',
        first_name: 'Hana',
        last_name: 'Reyes',
        role: 'hr',
        department_id: hr.id,
      },
      {
        id: userIds.dev1,
        email: 'dev1@phishyhub.local',
        first_name: 'Devon',
        last_name: 'Osei',
        role: 'developer',
        department_id: engineering.id,
      },
      {
        id: userIds.dev2,
        email: 'dev2@phishyhub.local',
        first_name: 'Dana',
        last_name: 'Ivanov',
        role: 'developer',
        department_id: engineering.id,
      },
      {
        id: userIds.sales1,
        email: 'sales1@phishyhub.local',
        first_name: 'Sam',
        last_name: 'Salazar',
        role: 'sales',
        department_id: sales.id,
      },
      {
        id: userIds.employee1,
        email: 'employee1@phishyhub.local',
        first_name: 'Eli',
        last_name: 'Support',
        role: 'employee',
        department_id: support.id,
      },
    ];

    await queryInterface.bulkInsert(
      'users',
      users.map((u) => ({
        id: u.id,
        email: u.email,
        password_hash: passwordHash,
        first_name: u.first_name,
        last_name: u.last_name,
        role: u.role,
        department_id: u.department_id,
        status: 'active',
        created_at: now,
        updated_at: now,
      })),
    );

    const [admin, hrUser, dev1, dev2, sales1, employee1] = users;

    // Now that dev1 exists, backfill Engineering's manager_id.
    await queryInterface.bulkUpdate(
      'departments',
      { manager_id: dev1.id, updated_at: now },
      { id: engineering.id },
    );

    const generalChannelId = randomUUID();
    const engineeringChannelId = randomUUID();
    await queryInterface.bulkInsert('channels', [
      {
        id: generalChannelId,
        organization_id: orgId,
        name: 'general',
        type: 'public',
        department_id: null,
        created_by: admin.id,
        is_archived: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: engineeringChannelId,
        organization_id: orgId,
        name: 'engineering',
        type: 'private',
        department_id: engineering.id,
        created_by: admin.id,
        is_archived: false,
        created_at: now,
        updated_at: now,
      },
    ]);

    // Everyone is a member of #general; only the Engineering folks + admin
    // are in the private #engineering channel.
    const generalMembers = users.map((u) => ({
      id: randomUUID(),
      channel_id: generalChannelId,
      user_id: u.id,
      channel_role: u.id === admin.id ? 'admin' : 'member',
      joined_at: now,
      created_at: now,
      updated_at: now,
    }));
    const engineeringMembers = [admin, dev1, dev2].map((u) => ({
      id: randomUUID(),
      channel_id: engineeringChannelId,
      user_id: u.id,
      channel_role: u.id === admin.id ? 'admin' : 'member',
      joined_at: now,
      created_at: now,
      updated_at: now,
    }));
    await queryInterface.bulkInsert('channel_members', [...generalMembers, ...engineeringMembers]);

    await queryInterface.bulkInsert('messages', [
      {
        id: randomUUID(),
        channel_id: generalChannelId,
        sender_id: admin.id,
        body: 'Welcome to Phishy Hub! This is the #general channel.',
        type: 'text',
        created_at: now,
        updated_at: now,
      },
    ]);

    // --- Tickets: spread across all 4 statuses / varying priorities / some assigned, some not (Modül 6 demo data) ---
    const tickets = [
      {
        id: randomUUID(),
        title: 'Printer on 3rd floor jammed',
        description: 'Paper jam, tried the obvious fixes already.',
        status: 'open',
        priority: 'high',
        created_by_id: employee1.id,
        assigned_to_id: null,
        department_id: support.id,
      },
      {
        id: randomUUID(),
        title: 'Staging deploy failing on migration step',
        description: 'db:migrate hangs on the leave_balances index build.',
        status: 'in_progress',
        priority: 'medium',
        created_by_id: admin.id,
        assigned_to_id: dev1.id,
        department_id: engineering.id,
      },
      {
        id: randomUUID(),
        title: 'Flaky test in messageFeatures.test.ts',
        description: 'Reaction toggle test fails ~1/20 runs.',
        status: 'resolved',
        priority: 'low',
        created_by_id: dev1.id,
        assigned_to_id: dev2.id,
        department_id: engineering.id,
      },
      {
        id: randomUUID(),
        title: 'Prod API returning 500 on file upload',
        description: 'MinIO bucket policy misconfigured after last deploy.',
        status: 'closed',
        priority: 'urgent',
        created_by_id: dev2.id,
        assigned_to_id: admin.id,
        department_id: engineering.id,
      },
      {
        id: randomUUID(),
        title: 'New CRM trial license request',
        description: null,
        status: 'open',
        priority: 'medium',
        created_by_id: sales1.id,
        assigned_to_id: null,
        department_id: sales.id,
      },
      {
        id: randomUUID(),
        title: 'Demo laptop won’t connect to conference room display',
        description: 'HDMI works, wireless casting does not.',
        status: 'in_progress',
        priority: 'high',
        created_by_id: admin.id,
        assigned_to_id: sales1.id,
        department_id: sales.id,
      },
    ];
    await queryInterface.bulkInsert(
      'tickets',
      tickets.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        created_by_id: t.created_by_id,
        assigned_to_id: t.assigned_to_id,
        department_id: t.department_id,
        created_at: now,
        updated_at: now,
      })),
    );

    // --- Leave requests: spread across the two-stage approval chain (Modül 5 demo data) ---
    // dev2's department (Engineering) has a manager (dev1) -> normal chain.
    // sales1/employee1's departments have no manager -> auto-skip to manager_approved at creation.
    const leaveRequests = [
      {
        // pending: awaiting dev1 (Engineering's manager) at stage 1.
        id: randomUUID(),
        user_id: dev2.id,
        type: 'sick',
        start_date: '2026-09-15',
        end_date: '2026-09-16',
        reason: 'Flu.',
        status: 'pending',
        reviewed_by_id: null,
        reviewed_at: null,
        review_note: null,
      },
      {
        // manager_approved: employee1's department (Support) has no manager -> auto-skipped, awaiting HR.
        id: randomUUID(),
        user_id: employee1.id,
        type: 'annual',
        start_date: '2026-10-05',
        end_date: '2026-10-09',
        reason: 'Family trip.',
        status: 'manager_approved',
        reviewed_by_id: null,
        reviewed_at: null,
        review_note: null,
      },
      {
        // manager_approved: sales1's department (Sales) has no manager -> auto-skipped, awaiting HR.
        id: randomUUID(),
        user_id: sales1.id,
        type: 'unpaid',
        start_date: '2026-11-02',
        end_date: '2026-11-03',
        reason: null,
        status: 'manager_approved',
        reviewed_by_id: null,
        reviewed_at: null,
        review_note: null,
      },
      {
        // approved: full two-stage chain completed (dev1 then hr).
        id: randomUUID(),
        user_id: dev2.id,
        type: 'annual',
        start_date: '2026-08-24',
        end_date: '2026-08-26',
        reason: 'Long weekend.',
        status: 'approved',
        reviewed_by_id: hrUser.id,
        reviewed_at: now,
        review_note: 'Enjoy!',
      },
      {
        // rejected: auto-skipped to manager_approved, then hr rejected.
        id: randomUUID(),
        user_id: employee1.id,
        type: 'other',
        start_date: '2026-09-01',
        end_date: '2026-09-02',
        reason: 'Personal errands.',
        status: 'rejected',
        reviewed_by_id: hrUser.id,
        reviewed_at: now,
        review_note: 'Coverage conflict that week — please resubmit for a different date.',
      },
    ];
    await queryInterface.bulkInsert(
      'leave_requests',
      leaveRequests.map((lr) => ({
        id: lr.id,
        user_id: lr.user_id,
        type: lr.type,
        start_date: lr.start_date,
        end_date: lr.end_date,
        reason: lr.reason,
        status: lr.status,
        reviewed_by_id: lr.reviewed_by_id,
        reviewed_at: lr.reviewed_at,
        review_note: lr.review_note,
        created_at: now,
        updated_at: now,
      })),
    );

    // Audit trail for the two fully/partially-decided requests above (approved + rejected).
    const [, , , approvedLeaveRequest, rejectedLeaveRequest] = leaveRequests;
    await queryInterface.bulkInsert('leave_request_reviews', [
      {
        id: randomUUID(),
        leave_request_id: approvedLeaveRequest.id,
        reviewer_id: dev1.id,
        stage: 'manager',
        decision: 'approve',
        note: null,
        created_at: now,
      },
      {
        id: randomUUID(),
        leave_request_id: approvedLeaveRequest.id,
        reviewer_id: hrUser.id,
        stage: 'hr',
        decision: 'approve',
        note: approvedLeaveRequest.review_note,
        created_at: now,
      },
      {
        id: randomUUID(),
        leave_request_id: rejectedLeaveRequest.id,
        reviewer_id: hrUser.id,
        stage: 'hr',
        decision: 'reject',
        note: rejectedLeaveRequest.review_note,
        created_at: now,
      },
    ]);

    // --- Leave balances: one row per seeded user for the current year (annual entitlement, the only type that deducts) ---
    const currentYear = now.getUTCFullYear();
    await queryInterface.bulkInsert(
      'leave_balances',
      users.map((u) => ({
        id: randomUUID(),
        user_id: u.id,
        year: currentYear,
        type: 'annual',
        entitled_days: 20,
        carried_over_days: 0,
        created_at: now,
        updated_at: now,
      })),
    );

    // eslint-disable-next-line no-console
    console.log(`\nSeeded demo data. All demo users share the password: ${DEMO_PASSWORD}`);
    // eslint-disable-next-line no-console
    console.log(users.map((u) => `  - ${u.email} (${u.role})`).join('\n'));
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('leave_balances', null, {});
    await queryInterface.bulkDelete('leave_request_reviews', null, {});
    await queryInterface.bulkDelete('leave_requests', null, {});
    await queryInterface.bulkDelete('tickets', null, {});
    await queryInterface.bulkDelete('messages', null, {});
    await queryInterface.bulkDelete('channel_members', null, {});
    await queryInterface.bulkDelete('channels', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('departments', null, {});
    await queryInterface.bulkDelete('organizations', null, {});
  },
};
