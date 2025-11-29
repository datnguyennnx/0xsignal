# syntax=docker/dockerfile:1.4

# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy all package files for workspace resolution
COPY package.json bun.lock ./
COPY packages/api/package.json ./packages/api/
COPY packages/app/package.json ./packages/app/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN bun install --frozen-lockfile

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage (hoisted to root)
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY package.json ./
COPY tsconfig.json tsconfig.base.json ./
COPY packages/app ./packages/app
COPY packages/shared ./packages/shared

# Build the application
WORKDIR /app/packages/app
RUN bun run build

# =============================================================================
# Stage 3: Production with hardened nginx
# =============================================================================
FROM nginx:1.27-alpine-slim AS runner

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY packages/app/nginx.conf /etc/nginx/nginx.conf

# Copy built files
COPY --from=builder /app/packages/app/dist /usr/share/nginx/html

# Security: Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && find /usr/share/nginx/html -type f -exec chmod 644 {} \; \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
