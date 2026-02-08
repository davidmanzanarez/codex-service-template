# Codex Service Template

A full-stack Hono + Vite + SQLite service template designed for a **hub-and-services** architecture on a single VPS. Clone it once per service, replace placeholder names, and you have a production-ready microservice with auth, rate limiting, metrics, Docker, and CI/CD.

## Who is this for?

This template is built for a specific (and practical) deployment pattern: **one central auth hub running N independent services**, all on a single VPS behind a reverse proxy. Instead of each service implementing its own OAuth flow, user management, and session handling, a single **Hub** service owns authentication and issues JWTs. Every service cloned from this template delegates auth to that Hub.

```
┌─────────────────────────────────────────────────────────────┐
│  Single VPS (Docker Compose + reverse proxy)                │
│                                                             │
│   ┌─────────┐    ┌───────────┐   ┌───────────┐             │
│   │   Hub   │    │ Service A │   │ Service B │  ...         │
│   │ (auth)  │    │(this tmpl)│   │(this tmpl)│             │
│   │ OAuth   │    │ Hono+Vite │   │ Hono+Vite │             │
│   │ Google  │    │  SQLite   │   │  SQLite   │             │
│   │ JWT     │    │           │   │           │             │
│   └────┬────┘    └─────┬─────┘   └─────┬─────┘             │
│        │               │               │                    │
│        └───── shared Docker network ────┘                   │
│                                                             │
│   ┌──────────────────────────────────┐                      │
│   │  Reverse proxy (Caddy/nginx)     │                      │
│   │  hub.example.com  → Hub:4000     │                      │
│   │  app-a.example.com → A:3000     │                      │
│   │  app-b.example.com → B:3000     │                      │
│   └──────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

**How it works:**
- The **Hub** is a separate service you build/deploy once. It handles OAuth (e.g. Google), creates JWTs (HS256), and manages user sessions. All services share the same `JWT_SECRET` so they can verify tokens issued by the Hub.
- Each **service** (cloned from this template) has its own SQLite database, its own API, and its own frontend. It never touches OAuth directly — it just validates the JWT cookie that the Hub set.
- A shared `HUB_SECRET` lets the Hub call each service's `/api/hub/summary` endpoint to aggregate metrics into a central dashboard.
- Setting `COOKIE_DOMAIN` to your root domain (e.g. `.example.com`) enables cross-subdomain SSO — log in once at the Hub, and every service recognizes the session.

This template does **not** include the Hub itself — it's the per-service side of the pattern. You bring your own auth hub (or build one).

## Quick Start

```bash
git clone https://github.com/youruser/codex-service-template.git my-service
cd my-service
cp .env.example .env
npm install
npm run dev
```

Server runs on http://localhost:3000, web dev server on http://localhost:3001.

## Architecture (single service)

```
Browser ──→ Vite (dev:3001) ──proxy──→ Hono (3000) ──→ SQLite
                                          │
                                    @codex/shared
                                   (auth, rate limit, metrics)
                                          │
                                    Hub (separate service)
                                   (OAuth + JWT issuance)
```

In production, a single Node process serves both the API and the built frontend static files. No ports are exposed to the host — services communicate over Docker's internal network, and only the reverse proxy binds to ports 80/443.

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

In a typical setup, you have one `docker-compose.yml` that runs the Hub, a reverse proxy, and all your services on a shared Docker network. Each service cloned from this template gets its own entry. No host port bindings are needed — only the reverse proxy exposes ports 80/443.

Add to your `docker-compose.yml`:

```yaml
services:
  # Your auth hub (not included in this template)
  hub:
    build: ./hub
    container_name: hub
    environment:
      - JWT_SECRET=${JWT_SECRET}
    networks:
      - app-network

  # A service cloned from this template
  my-service:
    build:
      context: ./my-service
      dockerfile: Dockerfile
    container_name: my-service
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=${JWT_SECRET}        # Must match the Hub
      - HUB_URL=http://hub:4000         # Docker internal DNS
      - HUB_SECRET=${HUB_SECRET}
      - OWNER_USER_ID=${OWNER_USER_ID}
    volumes:
      - my-service-data:/app/data
    networks:
      - app-network
    restart: unless-stopped

  # Reverse proxy routes subdomains to containers
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    networks:
      - app-network

networks:
  app-network:

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

Since this service doesn't handle OAuth itself, authentication is a redirect loop with the Hub:

1. User visits this service and clicks "Login"
2. Frontend redirects to the Hub's OAuth endpoint (`HUB_PUBLIC_URL/api/auth/google?returnTo=...`)
3. Hub handles the full OAuth flow (e.g. Google sign-in) and creates a signed JWT (HS256)
4. Hub redirects back to this service's callback (`SELF_URL/api/auth/callback`) with the JWT
5. The `@codex/shared` auth middleware sets the JWT as an HttpOnly cookie
6. All subsequent requests include the cookie automatically — no tokens in localStorage
7. `requireAuth` middleware verifies the JWT signature using the shared `JWT_SECRET`

**Key env vars for auth:**
| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Shared secret between Hub and all services — must match |
| `HUB_URL` | Internal Docker network URL for server-to-server calls (e.g. `http://hub:4000`) |
| `HUB_PUBLIC_URL` | Browser-facing URL for OAuth redirects (e.g. `https://hub.example.com`) |
| `SELF_URL` | This service's public URL, used as the OAuth callback destination |
| `COOKIE_DOMAIN` | Set to root domain (e.g. `.example.com`) for cross-subdomain SSO |

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

When running multiple services behind one Hub, it's useful to have a central dashboard that shows the status of each service at a glance. Each service exposes a `GET /api/hub/summary` endpoint that the Hub can poll to aggregate metrics.

This endpoint is protected by the shared `HUB_SECRET` (passed as `X-Hub-Secret` header), so only the Hub can call it — it's not accessible to end users.

Customize the response to return metrics relevant to your service's domain:

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

If you don't need a central dashboard, you can safely remove this endpoint from `app.ts` and the `HUB_SECRET` env var.
