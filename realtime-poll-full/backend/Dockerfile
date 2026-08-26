# Stage 1: Base image
FROM node:20-alpine AS runner

WORKDIR /app

# Define production environment
ENV NODE_ENV=production
ENV PORT=4000

# Copy package descriptors
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY src/ ./src/

# Expose HTTP port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start the production server
CMD ["node", "src/index.js"]
