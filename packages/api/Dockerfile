# syntax=docker/dockerfile:1.4

# Stage 1: Dependencies
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy all package files for workspace resolution
COPY package.json bun.lock ./
COPY packages/api/package.json ./packages/api/
COPY packages/app/package.json ./packages/app/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN bun install --frozen-lockfile

# Stage 2: Builder
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage (hoisted to root)
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY package.json ./
COPY tsconfig.json tsconfig.base.json ./
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared

# Compile for production (minified bundle)
RUN bun build packages/api/presentation/http/server.ts \
    --target=bun \
    --minify \
    --sourcemap \
    --outdir=./dist/api

# Stage 3: Production Runner
FROM oven/bun:1-alpine AS runner

ENV NODE_ENV=production
ENV BUN_ENV=production

WORKDIR /app

RUN addgroup -g 1001 -S appgroup && adduser -S -u 1001 -G appgroup appuser

# Copy compiled bytecode and dependencies
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist/api ./dist/api
COPY --from=builder --chown=appuser:appgroup /app/packages/shared ./packages/shared
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

USER appuser

EXPOSE 9006

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9006/api/health || exit 1

CMD ["bun", "dist/api/server.js"]
