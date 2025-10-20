# Simple single-stage (multi-stage unnecessary for small app) using stable LTS
FROM node:22-alpine AS base
WORKDIR /app

# Install prod dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && apk add --no-cache curl

# Copy source
COPY server.js ./
COPY index.html ./
COPY styles.css ./
COPY script.js ./
COPY data ./data

# Create non-root user for security
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3000
VOLUME ["/app/data"]
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD curl -fsS "http://localhost:${PORT}/api/coins" > /dev/null || exit 1

CMD ["node", "server.js"]
