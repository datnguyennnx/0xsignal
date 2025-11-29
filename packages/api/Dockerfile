# Multi-stage Dockerfile for Bun-based API
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY packages/api/package.json ./packages/api/
COPY packages/app/package.json ./packages/app/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies using Bun
RUN bun install --frozen-lockfile

# Production stage
FROM oven/bun:1-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy dependencies and package files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source files
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared
COPY tsconfig.json tsconfig.base.json ./

# Expose port
EXPOSE 9006

# Run with bun
CMD ["bun", "run", "packages/api/presentation/http/server.ts"]
