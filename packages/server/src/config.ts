import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });

function getJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return 'dev-secret-change-me';
}

function getHubSecret(): string {
  if (process.env.HUB_SECRET) {
    return process.env.HUB_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('HUB_SECRET environment variable is required in production');
  }
  return 'dev-hub-secret-change-in-production';
}

const isProd = process.env.NODE_ENV === 'production';

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  debugMode: process.env.DEBUG_MODE === 'true',
  dbPath: isProd ? '/app/data/my-service.db' : resolve(process.cwd(), '../../data/my-service.db'),
  // Auth
  jwtSecret: getJwtSecret(),
  hubUrl: process.env.HUB_URL || 'http://localhost:4000',
  hubPublicUrl: process.env.HUB_PUBLIC_URL || 'http://localhost:4000',
  selfUrl: process.env.SELF_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  cookieDomain: process.env.COOKIE_DOMAIN || (isProd ? undefined : undefined),
  hubSecret: getHubSecret(),
  ownerUserId: process.env.OWNER_USER_ID,
};
