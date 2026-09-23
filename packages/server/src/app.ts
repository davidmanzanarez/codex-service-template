import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { csrf } from 'hono/csrf';
import { timingSafeEqual } from 'node:crypto';
import { count, eq } from 'drizzle-orm';
import { db, sqlite } from './db/index.js';
import { items } from './db/schema.js';
import { serveStatic } from '@hono/node-server/serve-static';
import { createAuthRoutes } from '@codex/shared';
import { env } from './config.js';

import itemsRoutes from './routes/items.js';
import { requireAuth, optionalAuth, getUser } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { metricsLogger } from './middleware/metrics.js';

export function createApp() {
  const app = new Hono();

  // Middleware
  // Do not put callback parameters into application logs.
  const requestLogger = logger();
  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/api/auth/')) return next();
    return requestLogger(c, next);
  });
  app.use('*', metricsLogger('my-service'));

  app.use('*', cors({
    origin: env.corsOrigins,
    credentials: true,
  }));

  // Health probes must not consume user rate-limit buckets or inflate metrics.
  app.use('/api/*', csrf({ origin: env.corsOrigins }));
  // One middleware chooses the endpoint policy; stacking stores double-counts auth.
  app.use('/api/*', rateLimiter({
    default: { limit: 300, window: 60 },
    endpoints: { '/api/auth': { limit: 30, window: 60 } },
    skip: (c) => c.req.path === '/api/health',
  }));

  // Auth routes (public) - using shared factory
  const authRoutes = createAuthRoutes({
    jwtSecret: env.jwtSecret,
    hubPublicUrl: env.hubPublicUrl,
    selfUrl: env.selfUrl,
    frontendUrl: env.frontendUrl,
    cookieDomain: env.cookieDomain,
  });
  // Apply the same owner/agent admission policy to session introspection.
  app.get('/api/auth/me', optionalAuth, (c) => {
    const user = getUser(c);
    return c.json({ authenticated: !!user, user, loginUrl: '/api/auth/login' });
  });
  // Use the configured callback only; never relay an arbitrary returnTo.
  app.get('/api/auth/login', (c) => {
    const loginUrl = new URL('/api/auth/google', env.hubPublicUrl);
    loginUrl.searchParams.set('returnTo', `${env.selfUrl}/api/auth/callback`);
    return c.redirect(loginUrl.toString());
  });
  app.route('/api/auth', authRoutes);

  // Health check (public)
  app.get('/api/health', (c) => {
    try {
      sqlite.prepare('SELECT 1').get();
      return c.json({ status: 'ok', service: 'my-service', timestamp: new Date().toISOString() });
    } catch {
      return c.json({ status: 'unavailable', service: 'my-service' }, 503);
    }
  });

  // Hub summary endpoint (requires shared secret)
  app.get('/api/hub/summary', async (c) => {
    const hubSecret = c.req.header('X-Hub-Secret');
    const supplied = Buffer.from(hubSecret || '');
    const expected = Buffer.from(env.hubSecret);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.header('X-User-Id');
    if (!userId) {
      return c.json({ error: 'Missing user ID' }, 400);
    }

    if (env.ownerUserId && userId !== env.ownerUserId) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const [{ total }] = db.select({ total: count() }).from(items).where(eq(items.userId, userId)).all();
    return c.json({
      service: 'my-service',
      lastUpdated: new Date().toISOString(),
      status: 'healthy',
      metrics: {
        primary: { label: 'Items', value: total, trend: 'stable' },
        secondary: [],
      },
    });
  });

  // Protected API routes
  app.use('/api/items/*', requireAuth);
  app.route('/api/items', itemsRoutes);

  // API misses must never receive the SPA HTML fallback.
  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

  // Serve frontend (production)
  const webDistPath = env.webDistPath;
  app.use('/*', serveStatic({ root: webDistPath }));
  app.get('*', serveStatic({ path: `${webDistPath}/index.html` }));

  return app;
}
