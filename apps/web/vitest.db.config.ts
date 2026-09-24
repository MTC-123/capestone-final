import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Integration tests against a real MongoDB replica set (no Prisma mocks):
 * concurrency, idempotency and authentication flows whose correctness
 * depends on the database's own guarantees.
 *
 *   TEST_DATABASE_URL="mongodb://localhost:27017/ricer_test?replicaSet=rs0&directConnection=true" npm run test:db
 */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'node',
    include: ['./tests/db/**/*.test.ts'],
    setupFiles: ['./tests/db/setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
