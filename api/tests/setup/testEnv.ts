/**
 * Runs before every test file's own imports are evaluated (vitest
 * `setupFiles`). Its only job is to stamp process.env with test-specific
 * overrides BEFORE `src/config/env.ts` (which does `import 'dotenv/config'`
 * at module scope) gets pulled in by anything the test file imports.
 *
 * dotenv's default `.config()` never overwrites a variable that's already
 * present in `process.env` — so anything we set here "wins" over `.env`
 * without needing to touch `.env`/`.env.example` or any source file.
 *
 * Test isolation strategy: a dedicated physical database (`phishy_hub_test`,
 * see tests/setup/globalSetup.ts) is dropped and recreated once per `npm
 * test` run, migrated + demo-seeded fresh. Individual tests don't need to
 * clean up after themselves for the suite to be repeatable — only within a
 * single run must they avoid colliding with each other (unique emails/etc.),
 * which is handled in tests/helpers/factories.ts. The real dev/demo database
 * (`phishy_hub`) is never touched by this suite.
 */
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'phishy_hub_test';

// Generous rate limits so a test file that legitimately fires many
// login/register/refresh calls in a short window (e.g. the concurrent
// refresh race regression test) never gets a false-negative 429 from
// express-rate-limit — rate limiting itself is out of scope for this suite.
process.env.RATE_LIMIT_MAX = '1000000';
process.env.AUTH_RATE_LIMIT_MAX = '1000000';

// Small upload cap so the "reject oversized upload" test doesn't need to
// push tens of megabytes through supertest to trip the limit.
process.env.MAX_UPLOAD_SIZE_MB = '2';

// Quiet down pino during the run; flip to 'info'/'debug' locally when
// diagnosing a failure.
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL || 'silent';
