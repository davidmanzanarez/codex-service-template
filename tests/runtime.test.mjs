import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
const { createApp } = await import('../packages/server/dist/app.js');
const { initializeDatabase, sqlite } = await import('../packages/server/dist/db/index.js');
initializeDatabase();

test('built frontend and readiness use the same production entrypoint paths', async () => {
  const app = createApp();
  const page = await app.request('/items');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /<div id="root">/);
  assert.equal((await app.request('/api/health')).status, 200);
  sqlite.close();
  assert.equal((await app.request('/api/health')).status, 503);
});
