import {
  createRateLimitStore,
  rateLimiter as sharedRateLimiter,
  type RateLimitConfig,
  type RateLimitOptions,
} from '@codex/shared';

export type { RateLimitConfig, RateLimitOptions };

const rateLimitStore = createRateLimitStore();

export function rateLimiter(options: RateLimitOptions) {
  return sharedRateLimiter(rateLimitStore, options);
}
