import 'dotenv/config';
import { Client } from 'pg';
import { execSync } from 'child_process';

/**
 * Vitest `globalSetup`: runs exactly once, before any test file/worker
 * starts, in the main process — so process.env changes made here are
 * inherited by the worker threads vitest spawns afterward (Node copies the
 * parent's env into a Worker at construction time).
 *
 * Responsibility: give the suite a clean, fully-migrated, demo-seeded
 * database of its own (`phishy_hub_test` by default), completely separate
 * from the `phishy_hub` dev/demo database declared in `.env`. Dropping +
 * recreating it on every run means individual tests don't need their own
 * teardown logic to keep the suite repeatable — only intra-run isolation
 * (unique emails etc., see tests/helpers/factories.ts) matters.
 */

const TEST_DB_NAME = process.env.TEST_DB_NAME || 'phishy_hub_test';

export default async function globalSetup(): Promise<void> {
  const host = requireEnv('DB_HOST');
  const port = Number(requireEnv('DB_PORT'));
  const user = requireEnv('DB_USER');
  const password = requireEnv('DB_PASSWORD');

  const admin = new Client({ host, port, user, password, database: 'postgres' });
  await admin.connect();
  try {
    // WITH (FORCE) (Postgres 13+) drops even if a previous crashed run left
    // connections open — this repo's docker-compose pins postgres:15-alpine.
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } finally {
    await admin.end();
  }

  const childEnv = { ...process.env, DB_NAME: TEST_DB_NAME, NODE_ENV: 'test' };

  // sequelize-cli reads its connection info from src/database/config.js,
  // which itself reads DB_* from process.env — overriding DB_NAME in the
  // child's env is enough to point it at the test database without editing
  // .env or .sequelizerc.
  run('npx --no-install sequelize-cli db:migrate', childEnv);
  run('npx --no-install sequelize-cli db:seed:all', childEnv);

  // Propagate to the parent process so it's inherited by worker threads too.
  process.env.DB_NAME = TEST_DB_NAME;

  // eslint-disable-next-line no-console
  console.log(`[globalSetup] test database "${TEST_DB_NAME}" migrated + seeded`);
}

function run(command: string, env: NodeJS.ProcessEnv): void {
  execSync(command, { cwd: process.cwd(), env, stdio: 'inherit', shell: true });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[globalSetup] missing required env var: ${name}`);
  return value;
}
