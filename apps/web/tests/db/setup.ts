import { execSync } from 'node:child_process';

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('TEST_DATABASE_URL is required for database integration tests');
}
if (!/ricer_test/.test(url)) {
  throw new Error('Refusing to run: TEST_DATABASE_URL must point at a *ricer_test* database');
}
process.env.DATABASE_URL = url;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'db-test-secret-'.padEnd(64, 'x');
process.env.REFRESH_TOKEN_PEPPER = process.env.REFRESH_TOKEN_PEPPER || 'db-test-pepper-'.padEnd(64, 'y');
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.KV_REST_API_URL;
process.env.NOTIFICATIONS_MODE = 'test';

// Unique indexes (idempotency keys, CINs) are part of what is under test.
execSync('npx prisma db push --skip-generate --accept-data-loss', { env: process.env, stdio: 'ignore' });
