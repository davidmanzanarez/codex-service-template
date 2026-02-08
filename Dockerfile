# syntax=docker/dockerfile:1
# Multi-stage build with BuildKit caching

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/web/package*.json ./packages/web/

# Install all dependencies with npm cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code
COPY . .

# Build server (TypeScript -> JavaScript)
RUN npm run build -w @my-service/server

# Build web (Vite production build)
RUN npm run build -w @my-service/web

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies with npm cache mount
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/web/package*.json ./packages/web/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Copy built server
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Copy built web (will be served by the server)
COPY --from=builder /app/packages/web/dist ./packages/web/dist

# Create data directory for SQLite and non-root user
RUN addgroup -g 1001 -S appuser && adduser -S -u 1001 appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app

USER appuser

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start server
CMD ["node", "packages/server/dist/index.js"]
