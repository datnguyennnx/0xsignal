# syntax=docker/dockerfile:1.4

# Stage 1: Dependencies (cached layer)
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Copy package files for dependency resolution
COPY package.json bun.lock ./
COPY packages/api/package.json ./packages/api/
COPY packages/app/package.json ./packages/app/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Stage 2: Builder
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY package.json tsconfig.json tsconfig.base.json ./
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared

# Build with minification
RUN bun build packages/api/presentation/http/server.ts \
    --target=bun \
    --minify \
    --outdir=./dist/api

# Stage 3: Production (minimal image)
FROM oven/bun:1-alpine AS runner

# Security: non-root user
RUN addgroup -g 1001 -S app && adduser -S -u 1001 -G app app

WORKDIR /app

# Environment
ENV NODE_ENV=production
ENV BUN_ENV=production

# Copy only production artifacts
COPY --from=builder --chown=app:app /app/dist/api ./dist/api
COPY --from=builder --chown=app:app /app/packages/shared ./packages/shared
COPY --from=builder --chown=app:app /app/package.json ./

# Install only production deps (minimal)
COPY --from=deps /app/node_modules ./node_modules

USER app

EXPOSE 9006

# Optimized health check
HEALTHCHECK --interval=30s --timeout=2s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:9006/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "run", "dist/api/server.js"]
