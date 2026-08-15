import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/setup/globalSetup.ts'],
    setupFiles: ['./tests/setup/testEnv.ts'],
    // Integration suite against a real Postgres + MinIO — run test files
    // sequentially. They share one physical test database, and some tests
    // (refresh rotation/reuse) are inherently stateful; parallel files would
    // race each other for no real speed win at this suite's size.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    reporters: ['default'],
  },
});
