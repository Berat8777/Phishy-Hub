/**
 * Fixed accounts created by the demo seeder (src/database/seeders/20260101000100-demo-seed.js),
 * which globalSetup.ts also runs against the isolated `phishy_hub_test` database.
 * Safe to log in as these — tests must not mutate their core identity fields
 * (email/password/role), only create new rows that reference them (e.g. a
 * leave request reviewed by HR). See CONTRACT.md §8.
 */
export const DEMO_PASSWORD = 'Password123!';

export const DEMO_USERS = {
  admin: 'admin@phishyhub.local',
  hr: 'hr@phishyhub.local',
  dev1: 'dev1@phishyhub.local',
  dev2: 'dev2@phishyhub.local',
  sales1: 'sales1@phishyhub.local',
  employee1: 'employee1@phishyhub.local',
} as const;
