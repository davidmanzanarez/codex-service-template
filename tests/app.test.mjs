import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-only-signing-key';
process.env.HUB_SECRET = 'test-only-hub-key';
process.env.OWNER_USER_ID = '';
const { createApp } = await import('../packages/server/dist/app.js');
const { initializeDatabase, sqlite } = await import('../packages/server/dist/db/index.js');
const { getRecentMetrics, resetMetrics } = await import('../packages/server/dist/middleware/metrics.js');
initializeDatabase();
after(() => sqlite.close());
const app = createApp();
const cookie = id => `auth_token=${jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;

test('login is runtime-configured and ignores user-supplied redirects', async () => {
  const response = await app.request('/api/auth/login?returnTo=https://untrusted.example');
  const url = new URL(response.headers.get('location'));
  assert.equal(url.origin, 'http://localhost:4000');
  assert.equal(url.searchParams.get('returnTo'), 'http://localhost:3000/api/auth/callback');
});

test('auth requests consume one rate-limit slot each', async () => {
  for (let i = 1; i <= 30; i++) {
    const response = await app.request('/api/auth/me', { headers: { 'x-forwarded-for': '192.0.2.10' } });
    assert.equal(response.status, 200, `request ${i}`);
  }
  assert.equal((await app.request('/api/auth/me', { headers: { 'x-forwarded-for': '192.0.2.10' } })).status, 429);
});

test('health probes stay out of traffic metrics and rate limits', async () => {
  resetMetrics();
  const response = await app.request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-ratelimit-limit'), null);
  assert.equal(getRecentMetrics().length, 0);
});

test('API misses return JSON and unsafe cross-origin forms are rejected', async () => {
  const missing = await app.request('/api/missing');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Not found' });
  const csrf = await app.request('/api/auth/logout', { method: 'POST', headers: {
    origin: 'https://untrusted.example', 'content-type': 'application/x-www-form-urlencoded',
  }, body: '' });
  assert.equal(csrf.status, 403);
});

test('CRUD and Hub summaries remain isolated by user', async () => {
  const created = await app.request('/api/items', { method: 'POST', headers: {
    cookie: cookie('alice'), 'content-type': 'application/json',
  }, body: JSON.stringify({ title: 'Private item' }) });
  assert.equal(created.status, 201);
  const { item } = await created.json();
  const other = { cookie: cookie('bob'), 'content-type': 'application/json' };
  assert.deepEqual(await (await app.request('/api/items', { headers: other })).json(), { items: [] });
  assert.equal((await app.request(`/api/items/${item.id}`, {
    method: 'PATCH', headers: other, body: JSON.stringify({ title: 'Not mine' }),
  })).status, 404);
  assert.equal((await app.request('/api/hub/summary')).status, 401);
  for (const [id, total] of [['alice', 1], ['bob', 0]]) {
    const summary = await app.request('/api/hub/summary', { headers: {
      'x-hub-secret': process.env.HUB_SECRET, 'x-user-id': id,
    } });
    assert.equal((await summary.json()).metrics.primary.value, total);
  }
});
