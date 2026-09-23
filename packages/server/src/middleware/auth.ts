import {
  createAuthMiddleware,
  type AuthUser,
  type AuthMiddlewareConfig,
} from '@codex/shared';
import { env } from '../config.js';

export type { AuthUser };

const authConfig: AuthMiddlewareConfig = {
  jwtSecret: env.jwtSecret,
  hubPublicUrl: env.hubPublicUrl,
  frontendUrl: env.frontendUrl,
  ownerUserId: env.ownerUserId,
};

const { requireAuth, optionalAuth, getUser } = createAuthMiddleware(authConfig);

export { requireAuth, optionalAuth, getUser };
