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
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:22-alpine AS production
WORKDIR /app
RUN apk add --no-cache libstdc++ && \
    addgroup -g 1001 -S appuser && adduser -S -u 1001 -G appuser appuser && \
    mkdir -p /app/data && chown appuser:appuser /app/data
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/web/package.json ./packages/web/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist
USER appuser
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "packages/server/dist/index.js"]
