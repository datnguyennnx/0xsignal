# syntax=docker/dockerfile:1.4

# Stage 1: Dependencies (cached layer)
FROM oven/bun:1.3.10-alpine AS deps
WORKDIR /app

# Copy package files for dependency resolution
COPY package.json bun.lock ./
COPY packages/api/package.json ./packages/api/
COPY packages/app/package.json ./packages/app/
COPY packages/auth/package.json ./packages/auth/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies with cache mount (frozen lockfile for reproducibility)
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Stage 2: Builder
FROM oven/bun:1.3.10-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY package.json tsconfig.json tsconfig.base.json ./
COPY packages/api ./packages/api
COPY packages/auth ./packages/auth
COPY packages/shared ./packages/shared

# Fail the image on type errors, as the local build does
RUN bun run --cwd /app/packages/api typecheck

# Build with minification
RUN bun build packages/api/main.ts \
    --target=bun \
    --minify \
    --outdir=./dist

# Same layout as the local build: dist/main.js resolves SQL from dist/sql
RUN mkdir -p ./dist/sql && cp -r packages/auth/src/infrastructure/migrations/sql/. ./dist/sql/

# Stage 3: Production dependencies only
FROM oven/bun:1.3.10-alpine AS prod-deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/api/package.json ./packages/api/
COPY packages/app/package.json ./packages/app/
COPY packages/auth/package.json ./packages/auth/
COPY packages/shared/package.json ./packages/shared/

# Workspace sources are inlined by bun build, so the links to the
# non-copied packages would only dangle in the runner
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --production --frozen-lockfile \
    && rm -rf node_modules/@0xsignal

# Stage 4: Production (minimal image)
FROM oven/bun:1.3.10-alpine AS runner

# Security: non-root user
RUN addgroup -g 1001 -S app && adduser -S -u 1001 -G app app

WORKDIR /app

# Environment
ENV NODE_ENV=production
ENV BUN_ENV=production

# Copy only production artifacts
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules

USER app

EXPOSE 9006

# Optimized health check
HEALTHCHECK --interval=30s --timeout=2s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:9006/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "run", "dist/main.js"]
