# syntax=docker/dockerfile:1.4

# Stage 1: Dependencies (cached)
FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/api/package.json ./packages/api/
COPY packages/app/package.json ./packages/app/
COPY packages/shared/package.json ./packages/shared/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Stage 2: Builder
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json tsconfig.base.json ./
COPY packages/app ./packages/app
COPY packages/shared ./packages/shared

WORKDIR /app/packages/app
RUN bun run build

# Stage 3: Production nginx
FROM nginx:1.27-alpine-slim AS runner

# Remove default config
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy nginx config
COPY packages/app/nginx.conf /etc/nginx/nginx.conf

# Copy built assets
COPY --from=builder /app/packages/app/dist /usr/share/nginx/html

# Security hardening
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && find /usr/share/nginx/html -type f -exec chmod 644 {} \; \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid \
    && rm -rf /var/cache/apk/*

EXPOSE 80

# Fast health check
HEALTHCHECK --interval=10s --timeout=2s --start-period=3s --retries=3 \
    CMD wget -q --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
