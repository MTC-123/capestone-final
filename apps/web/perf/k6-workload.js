/**
 * RICER load test — the proposal's 10 / 25 / 50 concurrent-user scenarios.
 *
 * Mixed workload per iteration: an official refreshes the operating picture
 * (incidents, reports, dispatch teams, health) and, every tenth iteration, a
 * resident files a report. Run against a production build seeded with
 * `npm run prisma:seed && npm run prisma:seed:load` (1,000 synthetic incidents).
 *
 *   k6 run -e BASE_URL=http://localhost:3100 perf/k6-workload.js
 *
 * Results are test conditions on the declared machine, not promised capacity.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3100';
const readLatency = new Trend('read_latency', true);
const writeLatency = new Trend('write_latency', true);

export const options = {
  scenarios: {
    users_10: { executor: 'constant-vus', vus: 10, duration: '60s', startTime: '0s', tags: { load: '10' } },
    users_25: { executor: 'constant-vus', vus: 25, duration: '60s', startTime: '65s', tags: { load: '25' } },
    users_50: { executor: 'constant-vus', vus: 50, duration: '60s', startTime: '130s', tags: { load: '50' } },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{load:10}': ['p(95)<800'],
    'http_req_duration{load:25}': ['p(95)<1200'],
    'http_req_duration{load:50}': ['p(95)<2000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
};

function signIn(cin, ip) {
  const res = http.post(`${BASE}/api/auth/signin`, JSON.stringify({ cin, password: 'password123' }), {
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
  });
  check(res, { 'signed in': (r) => r.status === 200 });
  return res.cookies['auth-token'] && res.cookies['auth-token'][0].value;
}

export function setup() {
  return { official: signIn('CD789012', '10.200.0.1'), resident: signIn('AB123456', '10.200.0.2') };
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function (tokens) {
  // Each virtual user gets its own client address so per-client rate limits
  // model distinct people rather than one abusive client.
  const ip = `10.201.${Math.floor(__VU / 250)}.${__VU % 250}`;
  const official = { headers: { Authorization: `Bearer ${tokens.official}`, 'X-Forwarded-For': ip } };

  const reads = http.batch([
    ['GET', `${BASE}/api/geo/incidents`, null, { ...official, tags: { name: 'incidents' } }],
    ['GET', `${BASE}/api/reports?limit=20`, null, { ...official, tags: { name: 'reports' } }],
    ['GET', `${BASE}/api/dispatch/teams`, null, { ...official, tags: { name: 'teams' } }],
    ['GET', `${BASE}/api/health`, null, { tags: { name: 'health' } }],
  ]);
  for (const r of reads) {
    readLatency.add(r.timings.duration);
    check(r, { 'read ok': (x) => x.status === 200 });
  }

  if (__ITER % 10 === 0) {
    const body = JSON.stringify({
      clientSubmissionId: uuid(),
      latitude: 33.3 + Math.random() * 0.4,
      longitude: -5.4 + Math.random() * 0.5,
      description: `[LOAD] k6 report VU${__VU} iteration ${__ITER}`,
      capturedAt: new Date().toISOString(),
    });
    const res = http.post(`${BASE}/api/reports`, body, {
      headers: { Authorization: `Bearer ${tokens.resident}`, 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      tags: { name: 'report_create' },
    });
    writeLatency.add(res.timings.duration);
    check(res, { 'report accepted': (x) => x.status === 201 || x.status === 200 });
  }

  sleep(1 + Math.random());
}
