# Multi-stage Dockerfile for Vite-based Frontend
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
COPY api/package.json ./api/
COPY app/package.json ./app/
COPY shared/package.json ./shared/
RUN bun install --frozen-lockfile

# Copy source files
COPY app ./app
COPY shared ./shared
COPY tsconfig.json ./

# Build the application
WORKDIR /app/app
RUN bun run build

# Production stage with nginx
FROM nginx:alpine AS runner

# Copy built files
COPY --from=builder /app/app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
