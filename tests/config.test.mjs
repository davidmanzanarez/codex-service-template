import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const moduleUrl = new URL('../packages/server/dist/config.js', import.meta.url).href;
const production = {
  NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(40), HUB_SECRET: 'b'.repeat(40),
  SELF_URL: 'https://app.example.com', FRONTEND_URL: 'https://app.example.com',
  HUB_PUBLIC_URL: 'https://hub.example.com', PORT: '3000', CORS_ORIGINS: '',
};
function config(overrides = {}, cwd = '/') {
  return spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { env } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(env));`],
  { cwd, env: { ...process.env, ...production, ...overrides }, encoding: 'utf8' });
}

test('configuration is independent of the process working directory', () => {
  const root = config({}, new URL('..', import.meta.url));
  const elsewhere = config();
  assert.equal(root.status, 0, root.stderr);
  assert.equal(elsewhere.status, 0, elsewhere.stderr);
  assert.equal(root.stdout, elsewhere.stdout);
  assert.deepEqual(JSON.parse(root.stdout).corsOrigins, ['https://app.example.com']);
});

test('production rejects missing secrets, URL defaults, and invalid ports', () => {
  for (const bad of [{ JWT_SECRET: '' }, { HUB_SECRET: 'your-secret' },
    { HUB_PUBLIC_URL: '' }, { SELF_URL: 'http://app.example.com' },
    { FRONTEND_URL: 'https://app.example.com/path' }, { PORT: 'NaN' }, { PORT: '0' },
    { CORS_ORIGINS: '*' }]) {
    assert.notEqual(config(bad).status, 0, JSON.stringify(bad));
  }
});
