# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app

# Git dependency + native SQLite fallback build; these stay out of runtime.
RUN apk add --no-cache git python3 make g++
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/web/package*.json ./packages/web/
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts && \
    # npm may nest a workspace's deps (drizzle-orm 0.45 lands in packages/server/node_modules);
    # make sure the dir exists so the COPY below never fails, empty or not.
    mkdir -p packages/server/node_modules

FROM node:22-alpine AS production
WORKDIR /app
# eMudhra intermediate-key compromise (Oct 2026): Node's built-in root store still trusts the cracked
# intermediates, so verify TLS against Alpine's CA bundle, upgraded at build time, instead.
RUN apk upgrade --no-cache ca-certificates-bundle && \
    apk add --no-cache libstdc++ && \
    addgroup -g 1001 -S appuser && adduser -S -u 1001 -G appuser appuser && \
    mkdir -p /app/data && chown appuser:appuser /app/data
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=builder /app/packages/web/package.json ./packages/web/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist
USER appuser
ENV NODE_ENV=production PORT=3000 NODE_OPTIONS=--use-openssl-ca
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "packages/server/dist/index.js"]
