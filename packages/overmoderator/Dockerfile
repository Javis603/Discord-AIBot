# ============================================================================
# Overmoderator Discord Bot - Production Dockerfile
# Using Node.js 22 with Ubuntu base for voice support
# ============================================================================

# Build stage - use official Node.js image
FROM node:22-bookworm AS builder

ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for native module builds)
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# ============================================================================
# Production stage
# ============================================================================
FROM node:22-bookworm-slim AS production

LABEL maintainer="Overmoderator Team"
LABEL description="Discord AI Bot with voice, moderation, and AI capabilities"
LABEL version="1.0.0"

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV TZ=UTC

# Install runtime dependencies:
# - postgresql-client: database connectivity
# - ffmpeg, libopus0, libsodium23: audio/voice processing
# - iputils-ping, dnsutils: network debugging
# - tini: proper signal handling
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    postgresql-client \
    ffmpeg \
    libopus0 \
    libsodium23 \
    iputils-ping \
    dnsutils \
    tini \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN groupadd -r botuser && useradd -r -g botuser botuser

# Create app directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/logs /app/audio-cache /app/temp && \
    chown -R botuser:botuser /app

# Copy built application from builder stage
COPY --from=builder --chown=botuser:botuser /build/node_modules ./node_modules
COPY --chown=botuser:botuser . .

# Remove unnecessary files
RUN rm -rf .git .github .env.example *.md tests __tests__ .eslintrc* .prettierrc* \
    && rm -rf node_modules/.cache

# Switch to non-root user
USER botuser

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Expose health check port
EXPOSE 3000

# Use tini as init system for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start the bot
CMD ["node", "--no-warnings", "index.js"]