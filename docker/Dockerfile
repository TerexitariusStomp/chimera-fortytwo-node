# Multi-stage build for Chimera-Fortytwo Node
# Stage 1: Build TypeScript
# Stage 2: Python inference bridge (optional)
# Stage 3: Runtime

# ─── Stage 1: TypeScript Build ──────────────────────────────────────────────
FROM node:20-alpine AS ts-builder

WORKDIR /build

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY config ./config
RUN npm run build

# ─── Stage 2: Python Bridge (Optional) ──────────────────────────────────────
FROM python:3.11-slim AS py-bridge

WORKDIR /bridge
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY models/inference_bridge.py ./
EXPOSE 5000

# ─── Stage 3: Runtime ───────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Security: run as non-root
RUN addgroup -g 1000 appgroup && adduser -u 1000 -G appgroup -D appuser

WORKDIR /app

# Copy built artifacts
COPY --from=ts-builder /build/dist ./dist
COPY --from=ts-builder /build/node_modules ./node_modules
COPY --from=ts-builder /build/package*.json ./
COPY --from=ts-builder /build/config ./config

# Create model cache dir with correct ownership
RUN mkdir -p /app/models/cache && chown -R appuser:appgroup /app

USER appuser:appgroup

EXPOSE 8080

ENV NODE_ENV=production
ENV LOG_FORMAT=json

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => r.statusCode===200?process.exit(0):process.exit(1))"

CMD ["node", "dist/src/node/index.js"]
