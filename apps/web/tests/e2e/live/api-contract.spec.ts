/**
 * API contract sweep. Discovers every route under src/app/api and calls each
 * exported method as an anonymous visitor, a resident and an official, then
 * checks the properties every endpoint must hold:
 *
 *  - no 5xx (except proxies whose upstream is down: 502/503/504)
 *  - nothing is public unless it is on the explicit public list
 *  - residents never reach official-only APIs
 *  - errors are problem+json with a code, and never carry a stack trace
 *  - signed-in responses are never cacheable by a shared (CDN) cache
 *  - hardening headers on every response
 *  - latency budget (p95) for endpoints that do not call third parties
 *
 * Mutating methods are sent with an empty body and non-existent ids, so they
 * exercise validation and authorisation without changing data. They run only
 * against a local server unless API_SWEEP_WRITES=1.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { test, expect } from './fixtures';

const API_ROOT = join(__dirname, '../../../src/app/api');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type Method = (typeof METHODS)[number];
const FAKE_ID = '0000000000000000000000ff';

/** Deliberately public: status, open environmental data, and the auth entry points. */
const PUBLIC = [
  /^\/api\/health$/,
  /^\/api\/weather(\/|$)/,
  /^\/api\/risk\/(grid|predict)$/,
  /^\/api\/(effis|cams|population)\//,
  /^\/api\/ndvi\/latest-date$/,
  /^\/api\/auth\/(signin|signup|token|logout)$/,
];
/** Proxies for third-party services: an upstream outage may surface as 502/503/504. */
const EXTERNAL = [/^\/api\/(weather|effis|cams|population|ndvi|risk|geocode|detections|firms)(\/|$)/, /^\/api\/dispatch\/(route|isochrones)$/];
/**
 * Resident accounts must never get a success from these. (Public statistics
 * under /api/analytics and the incident/infrastructure map feeds are open to
 * residents by design.)
 */
const OFFICIAL_ONLY = [
  /^\/api\/admin\//,
  /^\/api\/coordination\//,
  /^\/api\/operations\//,
  /^\/api\/dispatch\//,
  /^\/api\/fire-records(\/|$)/,
  /^\/api\/equipment(-audits)?(\/|$)/,
  /^\/api\/debriefings(\/|$)/,
  /^\/api\/notifications\/deliveries$/,
  /^\/api\/geo\/(vehicles|resources)$/,
  /^\/api\/(vehicles|retardant|infrastructure)(\/|$)/,
];
/** Covered by dedicated tests; sweeping them would end the session or needs a QStash signature. */
const SKIP = [/^\/api\/auth\//, /^\/api\/test\//, /^\/api\/notifications\/deliver$/];

interface Endpoint { path: string; methods: Method[] }
function discover(dir = API_ROOT): Endpoint[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return discover(full);
    if (name !== 'route.ts') return [];
    const source = readFileSync(full, 'utf8');
    const methods = METHODS.filter((m) => new RegExp(`export (const|async function) ${m}\\b`).test(source));
    const path = '/api/' + relative(API_ROOT, dir).split('/').map((seg) => (seg.startsWith('[') ? FAKE_ID : seg)).join('/');
    return [{ path: path.replace(/\/$/, ''), methods }];
  });
}

const matches = (list: RegExp[], path: string) => list.some((re) => re.test(path.replace(FAKE_ID, 'x')) || re.test(path));

interface Result { persona: string; method: Method; path: string; status: number; ms: number; cache: string | null; nosniff: boolean; problem: boolean; stack: boolean }

test.describe.configure({ mode: 'serial' });

test('every API endpoint honours the contract', async ({ baseURL }, testInfo) => {
  test.setTimeout(600_000);
  const local = /localhost|127\.0\.0\.1/.test(baseURL ?? '');
  const writes = local || process.env.API_SWEEP_WRITES === '1';
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const headers = bypass ? { 'x-vercel-protection-bypass': bypass } : undefined;

  // Dedicated seeded accounts, so the sweep never spends the rate-limit budget
  // of the demo personas the browser suites use (AB123456 / CD789012).
  const signedIn = async (cin: string) => {
    const ctx = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: headers });
    const res = await ctx.post('/api/auth/signin', { data: { cin, password: 'password123' } });
    expect(res.status(), `sign in ${cin}`).toBe(200);
    return ctx;
  };
  const personas: Record<string, APIRequestContext> = {
    anonymous: await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: headers }),
    resident: await signedIn('EF345678'),
    official: await signedIn('QR901234'),
  };

  const endpoints = discover().filter((e) => !matches(SKIP, e.path));
  const results: Result[] = [];
  for (const { path, methods } of endpoints) {
    for (const method of methods) {
      if (method !== 'GET' && !writes) continue;
      for (const [persona, ctx] of Object.entries(personas)) {
        const call = () => ctx.fetch(path, { method, ...(method === 'GET' ? {} : { data: {} }), failOnStatusCode: false, maxRedirects: 0 });
        let started = Date.now();
        let res = await call();
        // The sweep itself trips per-user rate limits; honour Retry-After, then measure the real answer.
        for (let tries = 0; res.status() === 429 && tries < 3; tries++) {
          const wait = Math.min(Number(res.headers()['retry-after'] ?? 5), 65);
          await new Promise((r) => setTimeout(r, wait * 1000));
          started = Date.now();
          res = await call();
        }
        const ms = Date.now() - started;
        const type = res.headers()['content-type'] ?? '';
        const body = type.includes('json') ? await res.text() : '';
        results.push({
          persona, method, path, status: res.status(), ms,
          cache: res.headers()['cache-control'] ?? null,
          nosniff: res.headers()['x-content-type-options'] === 'nosniff',
          problem: res.status() < 400 || (type.includes('json') && /"code"\s*:/.test(body)),
          stack: /"stack"\s*:|\n\s+at .+\.(js|ts):\d+/.test(body),
        });
      }
    }
  }
  await Promise.all(Object.values(personas).map((c) => c.dispose()));

  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/api-contract.json', JSON.stringify(results, null, 2));

  const violations: string[] = [];
  const at = (r: Result) => `${r.persona} ${r.method} ${r.path} → ${r.status}`;
  for (const r of results) {
    if (r.status >= 500 && !(matches(EXTERNAL, r.path) && [502, 503, 504].includes(r.status))) violations.push(`5xx: ${at(r)}`);
    if (r.persona === 'anonymous' && r.status < 400 && !matches(PUBLIC, r.path)) violations.push(`public by accident: ${at(r)}`);
    if (r.persona === 'resident' && r.status < 300 && matches(OFFICIAL_ONLY, r.path)) violations.push(`resident reached official API: ${at(r)}`);
    if (r.status >= 400 && !r.problem) violations.push(`error without a problem code: ${at(r)}`);
    // Development builds include stacks on purpose; production must never.
    if (r.stack && !local) violations.push(`stack trace exposed: ${at(r)}`);
    if (r.persona !== 'anonymous' && r.status < 300 && r.cache && /public|s-maxage/.test(r.cache) && !matches(PUBLIC, r.path)) {
      violations.push(`signed-in response is CDN-cacheable (${r.cache}): ${at(r)}`);
    }
    if (!r.nosniff) violations.push(`missing X-Content-Type-Options: ${at(r)}`);
  }

  const internal = results.filter((r) => !matches(EXTERNAL, r.path)).map((r) => r.ms).sort((a, b) => a - b);
  const p95 = internal[Math.floor(internal.length * 0.95)] ?? 0;
  testInfo.annotations.push({ type: 'api-sweep', description: `${results.length} calls, ${endpoints.length} routes, internal p95 ${p95} ms, writes ${writes}` });
  console.log(`API sweep: ${results.length} calls over ${endpoints.length} routes; internal p95 ${p95} ms; writes=${writes}`);

  expect(violations, violations.join('\n')).toEqual([]);
  expect(p95, 'internal endpoint p95 (ms)').toBeLessThan(1500);
});
