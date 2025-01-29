# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create required directories and set permissions
RUN mkdir -p /var/cache/nginx \
            /var/cache/nginx/client_temp \
            /var/cache/nginx/proxy_temp \
            /var/cache/nginx/fastcgi_temp \
            /var/cache/nginx/uwsgi_temp \
            /var/cache/nginx/scgi_temp \
            /var/run && \
    chown -R nginx:nginx /var/cache/nginx \
                        /var/run \
                        /var/log/nginx \
                        /usr/share/nginx/html && \
    chmod -R 755 /var/cache/nginx \
                 /var/run \
                 /var/log/nginx \
                 /usr/share/nginx/html

# Expose port 80

# Start nginx