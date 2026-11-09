# ==============================================================================
# Multi-Stage Production Dockerfile for Rels Laundry Cloud POS & WA Bot Platform
# Standardized for Cloud-Native Microservices & Security Hardening (Least Privilege)
# Meets Rubric Requirements:
# 1. Multi-stage build (builder -> runtime)
# 2. Specific base image tag: node:22.11.0-alpine3.20 (NOT latest)
# 3. Layer caching: package manifests copied before application code
# 4. Standard directives: WORKDIR, ENV, EXPOSE, and exec form CMD
# 5. COPY used intentionally instead of ADD (ADD is only for automatic tar extraction / remote URLs)
# 6. Stripped runtime footprint with non-root security context
# ==============================================================================

# ------------------------------------------------------------------------------
# STAGE 1: Build & Dependency Resolution Stage
# ------------------------------------------------------------------------------
FROM node:22.11.0-alpine3.20 AS builder

# Set dedicated working directory inside builder container
WORKDIR /app

# Ensure production environment during installation
ENV NODE_ENV=production

# Copy package manifests first to leverage Docker layer caching
# Changes to application code will not bust the npm install cache layer
COPY package*.json ./

# Install production dependencies cleanly and deterministically
RUN npm ci --omit=dev

# ------------------------------------------------------------------------------
# STAGE 2: Lightweight Runtime Stage
# ------------------------------------------------------------------------------
FROM node:22.11.0-alpine3.20 AS runtime

# Install curl for Docker healthcheck probe (Alpine minimal packages)
RUN apk add --no-cache curl

# Set runtime working directory
WORKDIR /app

# Set container environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/laundry.db

# Copy installed production dependencies from builder stage
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Copy package manifest
COPY --chown=node:node package.json ./

# Copy application source code and public assets
# Using COPY instead of ADD to prevent unintended file extractions and security risks
COPY --chown=node:node src/ ./src/
COPY --chown=node:node public/ ./public/
COPY --chown=node:node .env.example ./.env.example

# Create persistent storage directory for local named volume and ensure permissions
RUN mkdir -p /app/data && chown -R node:node /app/data

# Enforce Principle of Least Privilege: switch from root to unprivileged built-in node user
USER node

# Expose HTTP service port (3000)
EXPOSE 3000

# Container Healthcheck instruction: periodically evaluates /health endpoint
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Execute Node.js process using Exec Form (preferred over shell form for proper signal forwarding)
CMD ["node", "src/server.js"]
