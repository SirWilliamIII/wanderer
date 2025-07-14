# Containerfile - Secure, Anonymous Deployment (Podman-compatible)
FROM node:20-alpine

# Security: Run as non-root user
RUN addgroup -g 1001 -S wanderer && \
    adduser -S wanderer -u 1001

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    tor \
    privoxy \
    curl

# Set up Tor for network anonymization
RUN echo "SocksPort 9050" >> /etc/tor/torrc && \
    echo "ControlPort 9051" >> /etc/tor/torrc && \
    echo "CookieAuthentication 1" >> /etc/tor/torrc

# Configure Privoxy for HTTP proxy over Tor
RUN echo "forward-socks5 / 127.0.0.1:9050 ." >> /etc/privoxy/config && \
    echo "listen-address 127.0.0.1:8118" >> /etc/privoxy/config

# Set up app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with security audit
RUN npm ci --only=production && \
    npm audit fix && \
    npm cache clean --force

# Copy application code
COPY src/ ./src/

# Set ownership to non-root user
RUN chown -R wanderer:wanderer /app

# Switch to non-root user
USER wanderer

# Set environment variables for security
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    CRAWLEE_PURGE_ON_START=true \
    CRAWLEE_LOG_LEVEL=INFO

# Health check (will need to implement /health endpoint)
# HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
#     CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start script with Tor  
CMD ["sh", "-c", "tor & privoxy --no-daemon /etc/privoxy/config & node src/index.js"]

