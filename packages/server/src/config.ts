import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// src/ and dist/ have the same depth: npm workspace and container entrypoints
// must resolve the same .env, database, and frontend assets.
export const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
config({ path: resolve(projectRoot, '.env') });

const isProd = process.env.NODE_ENV === 'production';

function secret(name: string, developmentValue: string): string {
  const value = process.env[name]?.trim();
  if (isProd && (!value || value.length < 32 || value === developmentValue || value.startsWith('your-'))) {
    throw new Error(`${name} must be a non-placeholder secret of at least 32 characters in production`);
  }
  return value || developmentValue;
}

function origin(name: string, developmentValue: string): string {
  const value = process.env[name]?.trim() || (isProd ? '' : developmentValue);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an absolute URL`); }
  if (!['http:', 'https:'].includes(url.protocol) || (isProd && url.protocol !== 'https:') ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an origin (HTTPS in production), without credentials, path, query, or fragment`);
  }
  return url.origin;
}

const port = Number(process.env.PORT || '3000');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}
const selfUrl = origin('SELF_URL', 'http://localhost:3000');
const frontendUrl = origin('FRONTEND_URL', 'http://localhost:3001');
const extraOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
for (const value of extraOrigins) {
  const url = new URL(value);
  if (url.origin !== value || !['http:', 'https:'].includes(url.protocol) || (isProd && url.protocol !== 'https:')) {
    throw new Error('CORS_ORIGINS must contain exact origins (HTTPS in production)');
  }
}

export const env = {
  port,
  nodeEnv: process.env.NODE_ENV || 'development',
  debugMode: process.env.DEBUG_MODE === 'true',
  dbPath: process.env.DB_PATH || resolve(projectRoot, 'data/my-service.db'),
  webDistPath: resolve(projectRoot, 'packages/web/dist'),
  jwtSecret: secret('JWT_SECRET', 'dev-secret-change-me'),
  hubSecret: secret('HUB_SECRET', 'dev-hub-secret-change-in-production'),
  hubPublicUrl: origin('HUB_PUBLIC_URL', 'http://localhost:4000'),
  selfUrl,
  frontendUrl,
  corsOrigins: [...new Set([selfUrl, frontendUrl, ...extraOrigins])],
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  // Leave unset for a multi-user service; set to the Hub user ID for owner-only access.
  ownerUserId: process.env.OWNER_USER_ID || undefined,
};
