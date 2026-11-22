import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/healthz`, { tags: { endpoint: 'healthz' } });
  check(health, {
    'healthz responde HTTP 200': (r) => r.status === 200,
    'healthz informa estado ok': (r) => {
      try { return r.json('status') === 'ok'; } catch (_) { return false; }
    },
  });

  const config = http.get(`${BASE_URL}/api/config`, { tags: { endpoint: 'config' } });
  check(config, {
    'config responde HTTP 200': (r) => r.status === 200,
  });

  sleep(1);
}
