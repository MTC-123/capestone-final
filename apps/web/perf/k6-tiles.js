import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    tiles: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 200,
      maxVUs: 2000,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<350'],
  },
};

export default function () {
  const baseUrl = __ENV.BASE_URL ?? 'http://localhost:3000';
  const token = __ENV.ACCESS_TOKEN ?? '';
  const z = 5;
  const x = 16;
  const y = 11;

  const res = http.get(`${baseUrl}/api/tiles/osm/${z}/${x}/${y}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    tags: { name: 'osm_tile' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has cache header': (r) => !!r.headers['X-Cache'] || !!r.headers['x-cache'],
  });

  sleep(0.01);
}

