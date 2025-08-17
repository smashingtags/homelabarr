# HomelabARR Frontend Docker Image
# Optimized multi-stage build for React + TypeScript + Vite frontend

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --no-audit

# Copy configuration files
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY eslint.config.js ./
COPY index.html ./

# Copy source code
COPY src/ ./src/

# Create public directory if it doesn't exist (optional assets)
RUN mkdir -p public

# Build the application for production
ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM nginx:1.25-alpine

# Security: run as non-root user
RUN addgroup -g 1001 -S homelabarr && \
    adduser -S homelabarr -u 1001 -G homelabarr

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy optimized nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create required directories and set permissions
RUN mkdir -p /var/cache/nginx \
            /var/cache/nginx/client_temp \
            /var/cache/nginx/proxy_temp \
            /var/cache/nginx/fastcgi_temp \
            /var/cache/nginx/uwsgi_temp \
            /var/cache/nginx/scgi_temp \
            /var/run \
            /var/log/nginx && \
    chown -R homelabarr:homelabarr /var/cache/nginx \
                                  /var/run \
                                  /var/log/nginx \
                                  /usr/share/nginx/html && \
    chmod -R 755 /var/cache/nginx \
                 /var/run \
                 /var/log/nginx \
                 /usr/share/nginx/html

# Switch to non-root user
USER homelabarr

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Production labels for GHCR
LABEL org.opencontainers.image.title="HomelabARR Frontend"
LABEL org.opencontainers.image.description="React frontend for HomelabARR CLI container management"
LABEL org.opencontainers.image.vendor="HomelabARR CLI"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/smashingtags/homelabarr-cli"

# Start nginx with non-daemon mode
CMD ["nginx", "-g", "daemon off;"]