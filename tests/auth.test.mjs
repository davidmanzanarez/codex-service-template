import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-signing-key';
process.env.OWNER_USER_ID = 'owner';
const { requireAuth, optionalAuth, getUser } = await import('../packages/server/dist/middleware/auth.js');
const { createAuthRoutes } = await import('@codex/shared');
const app = new Hono();
app.get('/api/private', requireAuth, c => c.json(getUser(c)));
app.get('/api/me', optionalAuth, c => c.json({ user: getUser(c) }));
app.route('/auth', createAuthRoutes({
  jwtSecret: process.env.JWT_SECRET, hubPublicUrl: 'http://localhost:4000',
  selfUrl: 'http://localhost:3000', frontendUrl: 'http://localhost:3001',
}));
const cookie = payload => ({ cookie: `auth_token=${jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' })}` });

test('only the configured owner can use user routes', async () => {
  assert.equal((await app.request('/api/private')).status, 401);
  assert.equal((await app.request('/api/private', { headers: cookie({ id: 'owner' }) })).status, 200);
  assert.equal((await app.request('/api/private', { headers: cookie({ id: 'someone-else' }) })).status, 403);
});

test('agent credentials cannot become a user session', async () => {
  const headers = cookie({ id: 'owner', token_use: 'agent' });
  assert.equal((await app.request('/api/private', { headers })).status, 403);
  assert.deepEqual(await (await app.request('/api/me', { headers })).json(), { user: null });
});

test('callback accepts shared cookies, never a JWT query parameter', async () => {
  const headers = cookie({ id: 'owner' });
  const token = headers.cookie.slice('auth_token='.length);
  const queryResponse = await app.request(`/auth/callback?token=${token}`);
  assert.equal(queryResponse.headers.get('set-cookie'), null);
  assert.equal(queryResponse.headers.get('location'), 'http://localhost:3001?error=no_token');
  const response = await app.request('/auth/callback', { headers });
  assert.equal(response.headers.get('location'), 'http://localhost:3001');
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
});
