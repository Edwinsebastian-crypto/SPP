import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '2m', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/healthz`, { tags: { endpoint: 'healthz' } });
  check(health, { 'healthz HTTP 200': (r) => r.status === 200 });

  const config = http.get(`${BASE_URL}/api/config`, { tags: { endpoint: 'config' } });
  check(config, { 'config HTTP 200': (r) => r.status === 200 });

  sleep(1);
}
