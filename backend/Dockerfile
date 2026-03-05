# Backend Dockerfile
# The frontend is deployed separately (e.g. via symlink or static hosting).
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source files
COPY src/ ./src/

# Create uploads directory
RUN mkdir -p ./uploads

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

CMD ["node", "src/server.js"]
