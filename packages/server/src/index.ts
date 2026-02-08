import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './config.js';
import { initializeDatabase } from './db/index.js';

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

  serve({
    fetch: app.fetch,
    port: env.port,
  }, (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
    console.log(`Environment: ${env.nodeEnv}`);
    if (env.debugMode) {
      console.log('Debug mode: enabled');
    }
  });
}

main().catch(console.error);
