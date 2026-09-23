import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
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
  app.use('*', logger());
  app.use('*', metricsLogger('my-service'));

  app.use('*', cors({
    origin: env.corsOrigins,
    credentials: true,
  }));

  // Rate limiting
  app.use('/api/*', rateLimiter({ limit: 300, window: 60 }));
  app.use('/api/auth/*', rateLimiter({ limit: 30, window: 60 }));

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
  app.get('/api/health', (c) => c.json({
    status: 'ok',
    service: 'my-service',
    timestamp: new Date().toISOString(),
  }));

  // Hub summary endpoint (requires shared secret)
  app.get('/api/hub/summary', async (c) => {
    const hubSecret = c.req.header('X-Hub-Secret');
    if (!hubSecret || hubSecret !== env.hubSecret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.header('X-User-Id');
    if (!userId) {
      return c.json({ error: 'Missing user ID' }, 400);
    }

    // TODO: Replace with your own metrics
    return c.json({
      service: 'my-service',
      lastUpdated: new Date().toISOString(),
      status: 'healthy',
      metrics: {
        primary: { label: 'Items', value: 0, trend: 'stable' },
        secondary: [],
      },
    });
  });

  // Protected API routes
  app.use('/api/items/*', requireAuth);
  app.route('/api/items', itemsRoutes);

  // Serve frontend (production)
  const webDistPath = env.webDistPath;
  app.use('/*', serveStatic({ root: webDistPath }));
  app.get('*', serveStatic({ path: `${webDistPath}/index.html` }));

  return app;
}
