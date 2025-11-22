# Multi-stage Dockerfile for Node.js-based API
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY api/package.json ./api/
COPY app/package.json ./app/
COPY shared/package.json ./shared/

# Install dependencies using Bun
RUN bun install --frozen-lockfile

# Production stage
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Install tsx globally
RUN npm install -g tsx

# Copy dependencies and package files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/api/package.json ./api/package.json
COPY --from=deps /app/shared/package.json ./shared/package.json

# Copy source files
COPY api ./api
COPY shared ./shared
COPY tsconfig.json ./

# Expose port
EXPOSE 9006

# Run with tsx
CMD ["tsx", "api/presentation/http/server.ts"]
