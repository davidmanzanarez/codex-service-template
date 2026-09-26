# Codex Service Template

<p align="center">
  <a href="https://github.com/davidmanzanarez/codex-service-template/actions/workflows/ci.yml"><img src="https://github.com/davidmanzanarez/codex-service-template/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-3b82f6.svg" alt="License: MIT"></a>
  <a href=".nvmrc"><img src="https://img.shields.io/badge/node-22-3b82f6.svg" alt="Node 22"></a>
</p>

<p align="center">
  <a href="docs/demo/codex-service-template-demo.mp4"><img src="docs/demo/codex-service-template-demo.gif" width="100%" alt="codex-service-template in 20 seconds: use the template, run it, sign in through a Hub, create an item, rename items to your own domain, the built-in safeguards, CI, and a one-service deploy."></a>
</p>
<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/davidmanzanarez/codex-service-template@main/docs/demo/codex-service-template-demo.mp4"><b>&#9654; Watch with sound</b></a> &middot; 20 s &middot; the real template app, run locally with a demo user
</p>

A TypeScript starter for a Hono API, React/Vite frontend, and SQLite database behind a shared authentication Hub. It demonstrates the per-service side of a small VPS deployment: independent images and data volumes, a shared Docker network, and a reverse proxy as the only public entrypoint.

> [!NOTE]
> This repository is a demo and a blueprint. It pins down one layout for a small service so that new services, including ones a coding agent builds from it, come out the same way every time. It is a starting point, not a showcase of production engineering.

This repository is an **example**, not a runtime dependency of services created from it. Updating it does not update those services. The Hub and reverse proxy are not included. The `Codex` name here refers to this service suite; running the example does not require an AI API.

## What you get

- A Hono API and a React/Vite app in one repository, served from one container.
- Sign-in through your Hub. The service checks the Hub's HttpOnly cookie itself and never handles a password.
- Per-user data in SQLite. The example filters every read and write by the signed-in user's ID.
- Owner-only mode behind one variable, `OWNER_USER_ID`.
- Rate limits and request metrics from `@codex/shared`, plus a CSRF guard.
- `GET /api/health` for probes, and `GET /api/hub/summary` so your Hub can show a number from this service.
- CI that typechecks, runs the regression tests, builds the Docker image and smoke-tests the running container.
- An opt-in workflow that publishes the image to GHCR with an immutable `@sha256` reference, for deploys and rollbacks.
- A non-root image that drains requests and closes SQLite when it stops.

## What you can build

Anything that is a list of things per person. The example entity is `items`: a title, a description and a status. Rename it to runs, books, recipes or trips, change the fields, and the sign-in, storage, CI and deploy path stay as they are. The same layout runs seven services behind one Hub.

## Architecture

```text
Browser → reverse proxy → service container (Hono + built React app)
                             ├─ SQLite on a persistent volume
                             └─ @codex/shared: auth, rate limits, request metrics
Browser → Hub → shared-domain HttpOnly cookie → service callback
Hub → service /api/hub/summary (shared secret + target user ID)

GitHub Actions → build image → GHCR → server pulls an immutable digest
```

Each service owns its data and deployment lifecycle. The Hub owns OAuth and user admission. All user-session verifiers share an HS256 signing secret: compromise of any verifier therefore affects the entire trust domain. This is a small trusted-suite pattern, not an isolation boundary between untrusted tenants.

## Quick start

Use GitHub's **Use this template**, then clone your new repository:

```sh
cd my-service
nvm install
nvm use
cp .env.example .env
npm ci
npm run dev
```

Node 22 is used locally, in CI, and in the container. The API listens on `http://localhost:3000`; Vite on `http://localhost:3001` proxies `/api` to it. A compatible Hub must run separately for login; the health endpoint works without it. Match the Hub's development `JWT_SECRET` and `HUB_SECRET` in `.env`. Use the same hostname (for example, `localhost`) across both applications so the cookie is shared in development.

```sh
npm run typecheck  # both server and web
npm test           # builds both workspaces, then runs regression tests
npm start          # serve the built API and frontend
```

Configuration and asset paths resolve from the project directory, regardless of the working directory used to launch the process. `data/` contains the default database and is ignored by Git and Docker builds. Tests use in-memory databases.

## Authentication contract

1. The frontend navigates to the service's `/api/auth/login` route. No auth URLs or secrets are baked into the frontend bundle.
2. The service redirects to `HUB_PUBLIC_URL/api/auth/google` with its configured callback URL. Caller-supplied redirect destinations are ignored.
3. The Hub authenticates the user, checks its callback allowlist, and sets `auth_token` as an HttpOnly, Secure, SameSite=Lax cookie on the shared parent domain.
4. The Hub redirects to `SELF_URL/api/auth/callback`. The callback verifies the **cookie**. JWT query parameters are not accepted.
5. The service verifies subsequent session cookies locally. Set `OWNER_USER_ID` to restrict access to one Hub user; leave it empty for user-scoped, multi-user access.

Configure the same `COOKIE_DOMAIN` on the Hub and service, and deploy them on sibling subdomains. Unrelated domains need a different authentication exchange; this example does not implement one. Logout clears the shared cookie but does not implement server-side token revocation.

Agent tokens cannot authenticate to ordinary user routes. Agent write endpoints are intentionally absent. If adding them, use the shared library's separate agent middleware with explicit audience, scope, and grant checks; do not reuse user-session middleware.

`@codex/shared` is pinned to a reviewed commit. To upgrade it, update the pin and lockfile together, then run the regression suite. A shared-library change is not automatically inherited by an existing service.

## Configuration

Copy `.env.example` for development. Inject production values at runtime; never commit `.env` or pass secrets as Docker build arguments.

| Variable | Contract |
| --- | --- |
| `NODE_ENV` | `production` enables startup guards and secure cookies |
| `PORT` | Valid TCP port; defaults to `3000` |
| `JWT_SECRET` | Must match Hub; production requires a non-placeholder value of at least 32 characters |
| `HUB_SECRET` | Separate secret for Hub summaries; same production guard |
| `HUB_PUBLIC_URL` | Public Hub origin, not its internal Docker address |
| `SELF_URL` | This service's public origin; callback is `/api/auth/callback` |
| `FRONTEND_URL` | Frontend origin; normally equal to `SELF_URL` in production |
| `COOKIE_DOMAIN` | Shared parent domain, for example `.example.com` |
| `OWNER_USER_ID` | Optional Hub user ID for owner-only access |
| `CORS_ORIGINS` | Additional exact origins, comma-separated; no wildcard |
| `DB_PATH` | Defaults to `data/my-service.db` under the project root |
| `SERVICE_IMAGE` | Compose image reference; use the published digest |

All three public URL variables are required HTTPS origins in production. CORS allows the service/frontend origins plus explicit additions; localhost is not automatically trusted in production. The example also rejects cross-origin simple form submissions with CSRF middleware. CORS alone is not authentication.

## API and operations

- `GET /api/health`: database readiness, `200` or `503`. No authentication or rate-limit budget required.
- `/api/auth/*`: session introspection, login, callback, and logout.
- `/api/items`: authenticated CRUD, scoped to the current user.
- `GET /api/hub/summary`: item count for `X-User-Id`, authenticated by `X-Hub-Secret`. Owner-only mode also restricts the target user.
- Unknown `/api/*` routes return JSON `404`; frontend routes fall back to the SPA.

The example rate limits are adjustable defaults. One middleware selects each endpoint's policy, avoiding double-counting nested auth requests. Health and Hub polling are excluded from in-memory request metrics. These metrics reset on restart and are not an authoritative visitor counter; use reverse-proxy access logs for external traffic.

Keep service ports private. The shared IP helper assumes a trusted reverse proxy controls `X-Forwarded-For`/`X-Real-IP`. Configure the proxy to overwrite or sanitize incoming forwarding headers, and review the helper before introducing another proxy/CDN hop.

## Images and deployment

CI runs typechecks, regression tests, a Docker build, and a production-container health smoke test. It never deploys. The former SSH/server-build workflow has been replaced by an **opt-in, manually dispatched image publisher**:

1. In your derived repository, set repository variable `ENABLE_IMAGE_PUBLISHING=true`.
2. Run **Publish image** on `main`. It validates and builds that exact revision on the GitHub runner, then pushes `ghcr.io/<owner>/<repo>:<commit>` for `linux/amd64`.
3. Copy the immutable `SERVICE_IMAGE=...@sha256:...` reference from the workflow summary. Change the platform if your server uses another architecture.
4. Authenticate the server to GHCR if the package is private. Keep registry credentials on the server; do not store them in this repository.
5. Merge `compose.example.yml` into your Hub/proxy Compose project, provide production environment values, and route your service's domain to `my-service:3000`.
6. Pull and restart only this service:

```sh
docker compose pull my-service
docker compose up -d --no-build --no-deps my-service
docker compose exec -T my-service node -e \
  "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
```

The standalone Compose example needs an existing Hub and a proxy on the same network. It intentionally publishes no host ports. No SSH secrets, droplet paths, automatic production deployment, or live infrastructure identifiers are embedded in this repository.

For rollback, retain the previous image digest and repeat pull/up with that reference. Database migrations must remain compatible with the rollback image, or require a tested restore. Do not prune the rollback image during deployment.

The image runs as UID/GID `1001`; named volumes initialize with the image's data-directory ownership. If using bind mounts or an existing volume, provision write access for that user. SIGTERM drains requests and closes SQLite, with a ten-second shutdown deadline.

## Persistence and backups

The volume survives container replacement; it is not a backup. Schedule SQLite's online backup API or `sqlite3 .backup`, store a copy off-host, and periodically test restoration into a separate volume. Copying only a live `.db` file can omit writes still in its WAL. Database files and secrets must never enter Git, build contexts, or images.

The sample table is initialized with `CREATE TABLE IF NOT EXISTS`; it is not a migration system. Add versioned migrations before evolving a real schema, and back up before running them. If your service adds attachments, include them in its backup and restore procedure.

## Customize

| Replace | With |
| --- | --- |
| `my-service`, `@my-service/server`, `@my-service/web` | Your service and workspace names |
| `My Service` and entrypoint banner | Your application title |
| `items` schema, routes, pages, and summary | Your domain model |
| `3000` / `3001` | Your local API/frontend ports, including Vite's proxy target |
| Compose service, volume, and network names | Your infrastructure's names |

Server code lives in `packages/server/src`; web code in `packages/web/src`. Register protected routes with `requireAuth`, filter database reads and writes by `getUser(c).id`, and place API handlers before the JSON catch-all. Extend the example's input validation and add pagination/body limits appropriate to your domain before exposing a real workload.

After renaming workspaces, run `npm install` to update the lockfile, then `npm run typecheck` and `npm test`. Keep contributions small and focused, with a regression test for changed behavior. Do not include production data, credentials, or private infrastructure details in issues or patches.

## License

MIT. See [LICENSE](LICENSE).
