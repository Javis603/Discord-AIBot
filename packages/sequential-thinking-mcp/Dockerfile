FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.0.0

# Copy package files
COPY package.json ./

# Install production dependencies
RUN pnpm install --prod

# Copy built dist
COPY dist/ ./dist/

# Volume for session state backup
VOLUME ["/app/data"]

# MCP server uses stdio — keep stdin open for MCP client connections
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD pgrep -f "node dist/index.js" || exit 1

# Keep stdin open so the stdio MCP transport stays alive
CMD ["node", "dist/index.js"]
