import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './config.js';
import { initializeDatabase, sqlite } from './db/index.js';

const banner = `
\x1b[36m┌────────────────────────────────────────┐
│                                        │
│  M Y   S E R V I C E                   │
│  Hono + Vite + SQLite                  │
│                                        │
└────────────────────────────────────────┘\x1b[0m
`;

async function main() {
  console.log(banner);

  initializeDatabase();

  const app = createApp();

  const server = serve({
    fetch: app.fetch,
    port: env.port,
  }, (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
    console.log(`Environment: ${env.nodeEnv}`);
    if (env.debugMode) {
      console.log('Debug mode: enabled');
    }
  });

  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    server.close(() => {
      sqlite.close();
      clearTimeout(deadline);
      process.exit(0);
    });
    if ('closeIdleConnections' in server) server.closeIdleConnections();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
