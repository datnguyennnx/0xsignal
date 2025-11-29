# Multi-stage Dockerfile for Vite-based Frontend
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
COPY packages/api/package.json ./packages/api/
COPY packages/app/package.json ./packages/app/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile

# Copy source files
COPY packages/app ./packages/app
COPY packages/shared ./packages/shared
COPY tsconfig.json tsconfig.base.json ./

# Build the application
WORKDIR /app/packages/app
RUN bun run build

# Production stage with nginx
FROM nginx:alpine AS runner

# Copy built files
COPY --from=builder /app/packages/app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
