# Wanderer - Professional Web Scraper

A professional web scraping framework with two modes: wander (aggressive exploration) and strict (respectful targeted scraping).

## Quick Start

### Using Podman

```bash
# Build the container
podman build -t wanderer .

# Run in strict mode (default)
podman run --rm wanderer

# Run in wander mode  
podman run --rm -e WANDERER_MODE=wander wanderer

# Run with custom targets
podman run --rm -e WANDERER_TARGETS="https://example.com,https://httpbin.org" wanderer

# Using podman-compose
podman-compose up
```

### Environment Variables

- `WANDERER_MODE`: 'strict' or 'wander' (default: strict)
- `WANDERER_TARGETS`: Comma-separated URLs to scrape
- `WANDERER_ENCRYPTION_KEY`: 64-character hex encryption key
- `BASIC_PROXIES`: Comma-separated proxy URLs
- `PREMIUM_PROXIES`: Comma-separated premium proxy URLs

## Modes

### Strict Mode
- Respectful crawling with rate limiting
- Follows robots.txt patterns
- Lower concurrency
- Focused content extraction

### Wander Mode  
- Aggressive link discovery
- High concurrency
- Deep exploration
- Comprehensive data extraction

## Security Features

- Data encryption for sensitive information
- Anonymous request headers
- Proxy rotation support
- Tor integration in Docker deployment
- PII sanitization

## Development

```bash
npm install
npm start
```

## Deployment

The project includes configurations for:
- Podman/Docker containers
- AWS ECS via Terraform
- Vercel serverless
- Railway
- Fly.io

## Known Issues

- Health check endpoint not implemented
- Missing test suite
- Requires manual encryption key management