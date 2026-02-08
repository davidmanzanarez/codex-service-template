import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from '@hono/node-server/serve-static';
import { createAuthRoutes } from '@codex/shared';
import { env } from './config.js';

import itemsRoutes from './routes/items.js';
import { requireAuth } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { metricsLogger } from './middleware/metrics.js';

export function createApp() {
  const app = new Hono();

  // Middleware
  app.use('*', logger());
  app.use('*', metricsLogger('my-service'));

  const corsOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:4001',
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
  ].filter(Boolean);

  app.use('*', cors({
    origin: corsOrigins,
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
  const webDistPath = process.env.NODE_ENV === 'production'
    ? './packages/web/dist'
    : '../web/dist';
  app.use('/*', serveStatic({ root: webDistPath }));
  app.get('*', serveStatic({ path: `${webDistPath}/index.html` }));

  return app;
}
