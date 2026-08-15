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

    const departments = [
      { id: randomUUID(), name: 'Engineering' },
      { id: randomUUID(), name: 'Sales' },
      { id: randomUUID(), name: 'Human Resources' },
      { id: randomUUID(), name: 'Support' },
    ];
    await queryInterface.bulkInsert(
      'departments',
      departments.map((d) => ({
        id: d.id,
        organization_id: orgId,
        name: d.name,
        created_at: now,
        updated_at: now,
      })),
    );
    const [engineering, sales, hr, support] = departments;

    const users = [
      {
        id: randomUUID(),
        email: 'admin@phishyhub.local',
        first_name: 'Ada',
        last_name: 'Admin',
        role: 'admin',
        department_id: engineering.id,
      },
      {
        id: randomUUID(),
        email: 'hr@phishyhub.local',
        first_name: 'Hana',
        last_name: 'Reyes',
        role: 'hr',
        department_id: hr.id,
      },
      {
        id: randomUUID(),
        email: 'dev1@phishyhub.local',
        first_name: 'Devon',
        last_name: 'Osei',
        role: 'developer',
        department_id: engineering.id,
      },
      {
        id: randomUUID(),
        email: 'dev2@phishyhub.local',
        first_name: 'Dana',
        last_name: 'Ivanov',
        role: 'developer',
        department_id: engineering.id,
      },
      {
        id: randomUUID(),
        email: 'sales1@phishyhub.local',
        first_name: 'Sam',
        last_name: 'Salazar',
        role: 'sales',
        department_id: sales.id,
      },
      {
        id: randomUUID(),
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

    const [admin, , dev1, dev2] = users;

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

    // eslint-disable-next-line no-console
    console.log(`\nSeeded demo data. All demo users share the password: ${DEMO_PASSWORD}`);
    // eslint-disable-next-line no-console
    console.log(users.map((u) => `  - ${u.email} (${u.role})`).join('\n'));
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('messages', null, {});
    await queryInterface.bulkDelete('channel_members', null, {});
    await queryInterface.bulkDelete('channels', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('departments', null, {});
    await queryInterface.bulkDelete('organizations', null, {});
  },
};
