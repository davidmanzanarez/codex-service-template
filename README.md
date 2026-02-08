# Codex Service Template

A full-stack Hono + Vite + SQLite service template with auth, rate limiting, metrics, Docker, and CI/CD — ready for a single VPS deployment.

Clone it, replace placeholder names, and you have a production-ready microservice.

## Quick Start

```bash
git clone https://github.com/youruser/codex-service-template.git my-service
cd my-service
cp .env.example .env
npm install
npm run dev
```

Server runs on http://localhost:3000, web dev server on http://localhost:3001.

## Architecture

```
Browser ──→ Vite (dev:3001) ──proxy──→ Hono (3000) ──→ SQLite
                                          │
                                    @codex/shared
                                     (auth, rate limit, metrics)
                                          │
                                   Auth Service
                                   (OAuth + JWT)
```

In production, a single Node process serves both the API and the built frontend static files.

## Project Structure

```
├── package.json                  # npm workspaces root
├── Dockerfile                    # Multi-stage build (node:20-alpine)
├── .env.example                  # All env vars with placeholders
├── .github/workflows/
│   ├── ci.yml                    # Typecheck + build on push/PR
│   └── deploy.yml                # SSH deploy on CI success
├── packages/
│   ├── server/                   # Hono + SQLite + Drizzle
│   │   └── src/
│   │       ├── index.ts          # Entry point with ASCII banner
│   │       ├── app.ts            # Middleware stack + routes + static serving
│   │       ├── config.ts         # Env loading with production guards
│   │       ├── db/
│   │       │   ├── index.ts      # better-sqlite3 + Drizzle, WAL mode
│   │       │   └── schema.ts     # Drizzle schema (items table)
│   │       ├── middleware/
│   │       │   ├── auth.ts       # @codex/shared auth wrapper
│   │       │   ├── rateLimit.ts  # @codex/shared rate limit wrapper
│   │       │   └── metrics.ts    # @codex/shared metrics wrapper
│   │       └── routes/
│   │           └── items.ts      # Full CRUD example (user-scoped)
│   └── web/                      # React + Vite + Tailwind
│       └── src/
│           ├── main.tsx          # React root + BrowserRouter + AuthProvider
│           ├── App.tsx           # Auth gate, sidebar nav, routes
│           ├── index.css         # Tailwind directives + theme
│           ├── context/
│           │   └── AuthContext.tsx # User state + login/logout
│           ├── api/
│           │   └── client.ts     # Typed fetchApi wrapper + items CRUD
│           └── pages/
│               ├── Dashboard.tsx # Simple stats page
│               └── Items.tsx     # CRUD UI for items entity
└── data/                         # SQLite database (gitignored)
```

## Customization Checklist

Replace these to make the template yours:

| Find | Replace with |
|------|-------------|
| `my-service` | Your service name (e.g. `task-tracker`) |
| `@my-service/server` | `@task-tracker/server` |
| `@my-service/web` | `@task-tracker/web` |
| Port `3000` / `3001` | Your preferred ports |
| `items` table | Your domain entity |
| `/opt/apps/my-service` | Your deploy path in `deploy.yml` |
| ASCII banner in `index.ts` | Your service name/motto |
| `My Service` in `index.html` | Your app title |
| `@codex/shared` GitHub URL | Your own fork if customizing shared libs |

After renaming, run `npm install && npm run build` to verify.

## Deployment

### Docker

```bash
docker build -t my-service .
docker run -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env my-service
```

### Docker Compose (single VPS)

Add to your `docker-compose.yml`:

```yaml
services:
  my-service:
    build:
      context: ./my-service
      dockerfile: Dockerfile
    container_name: my-service
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=${JWT_SECRET}
      - HUB_URL=http://auth-service:4000
      - HUB_SECRET=${HUB_SECRET}
      - OWNER_USER_ID=${OWNER_USER_ID}
    volumes:
      - my-service-data:/app/data
    networks:
      - your-network
    restart: unless-stopped

volumes:
  my-service-data:
```

### GitHub Actions

Set these secrets in your repo:
- `SSH_HOST` — Your server IP
- `SSH_USER` — SSH username
- `SSH_PRIVATE_KEY` — SSH private key

The deploy workflow runs automatically when CI passes on `main`.

## Auth Flow

1. User clicks "Login" -> redirected to Hub (`HUB_PUBLIC_URL`)
2. Hub handles Google OAuth, creates JWT
3. Hub redirects back to `SELF_URL/api/auth/callback` with JWT
4. `@codex/shared` middleware sets HttpOnly cookie
5. Subsequent requests include cookie automatically
6. `requireAuth` middleware validates JWT on protected routes

Cookie domain can be set via `COOKIE_DOMAIN` env var for cross-subdomain SSO.

## Adding Features

### New API Route

1. Create `packages/server/src/routes/widgets.ts`:
```typescript
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { widgets } from '../db/schema.js';
import { getUser } from '../middleware/auth.js';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const app = new Hono();

app.get('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const results = await db.select().from(widgets)
    .where(eq(widgets.userId, user.id));
  return c.json({ widgets: results });
});

export default app;
```

2. Add to `app.ts`:
```typescript
import widgetsRoutes from './routes/widgets.js';
app.use('/api/widgets/*', requireAuth);
app.route('/api/widgets', widgetsRoutes);
```

### New DB Table

1. Add Drizzle schema in `packages/server/src/db/schema.ts`
2. Add `CREATE TABLE IF NOT EXISTS` in `packages/server/src/db/index.ts`

### New Page

1. Create `packages/web/src/pages/Widgets.tsx`
2. Add route in `App.tsx`
3. Add nav item to `NAV_ITEMS` array
4. Add API methods to `client.ts`

## Hub Summary Endpoint

The `/api/hub/summary` endpoint returns metrics for a central dashboard (Hub). It requires the `X-Hub-Secret` header. Customize the metrics to match your domain:

```typescript
return c.json({
  service: 'my-service',
  status: 'healthy',
  metrics: {
    primary: { label: 'Total Items', value: 42, trend: 'up' },
    secondary: [
      { label: 'Active', value: 15 },
      { label: 'Completed', value: 27 },
    ],
  },
});
```
