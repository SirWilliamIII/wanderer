# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wanderer is a professional web scraping framework with two operational modes:
- **Wander Mode**: Aggressive exploration for comprehensive link discovery
- **Strict Mode**: Respectful, targeted scraping that follows robots.txt patterns

## Common Development Commands

### Running the Project
```bash
# Run in default strict mode
npm start

# Run in wander mode
npm run wander

# Run web application with API
npm run webapp

# Run monitoring dashboard
npm run dashboard

# Test proxy connections
npm run test-proxies

# Fetch new proxies
npm run get-proxies
```

### Container Operations
```bash
# Build container
podman build -t wanderer .

# Run with specific mode
podman run --rm -e WANDERER_MODE=wander wanderer

# Run with custom targets
podman run --rm -e WANDERER_TARGETS="https://example.com" wanderer

# Using compose
podman-compose up
```

### Cloudflare Worker Proxy (in wanderer-proxy/)
```bash
cd wanderer-proxy
npm run dev    # Local development
npm run deploy # Deploy to Cloudflare
```

## High-Level Architecture

### Core Components

1. **ScraperManager** (`src/ScraperManager.js`)
   - Central orchestration class that manages all scraping operations
   - Handles proxy rotation, session pools, and fingerprint randomization
   - Manages database connections and collection splitting
   - Implements rate limiting and delay strategies

2. **Crawler Implementations**
   - `wanderCrawler.js`: Aggressive mode with high concurrency and deep exploration
   - `strictCrawler.js`: Respectful mode with rate limiting and robots.txt compliance
   - Both use Playwright for browser automation via Crawlee framework

3. **Data Persistence**
   - MongoDB via Mongoose with automatic collection splitting when threshold reached
   - Document classification into categories (ecommerce, news, docs, etc.)
   - Encryption support for sensitive data fields

4. **Web Interface**
   - `webapp.js`: Express server with API endpoints for scraping control
   - `dashboard.js`: Real-time WebSocket-based monitoring dashboard
   - HTML templates in `src/templates/` for UI

### Key Design Patterns

1. **Proxy Management**
   - Two-tier system: basic (free) and premium (authenticated) proxies
   - Automatic rotation with session persistence
   - Fallback to direct connection if all proxies fail

2. **Security & Anonymity**
   - Browser fingerprint randomization per session
   - Anonymous request headers
   - Tor integration in containerized deployments
   - Optional data encryption for sensitive fields

3. **Configuration**
   - Environment-based configuration via `.env` file
   - Mode-specific settings (wander vs strict)
   - External API integration for enhanced dashboard features

### Important Considerations

1. **Database**: Requires MongoDB running locally or accessible via `MONGODB_URL`
2. **Proxies**: Configure `BASIC_PROXIES` and `PREMIUM_PROXIES` in `.env` for rotation
3. **Encryption**: Set `WANDERER_ENCRYPTION_KEY` (64-char hex) for data encryption
4. **External APIs**: Optional integration with NewsAPI, OpenWeather, and Alpha Vantage for dashboard

### Topic Starting Points

The project includes predefined starting URLs for different content categories in `src/topicStartingPoints.js`. These serve as entry points for discovering content in wander mode:

**Categories with Starting Points**:
- `ecommerce`: Amazon, eBay, Etsy, Walmart, etc.
- `news`: Reuters, AP, BBC, WSJ (reliable sources)
- `local_news`: NewsBreak, Google News, SmartNews, Apple News
- `big_technology`: TechCrunch, The Verge, Ars Technica, plus major tech companies
- `sports`: ESPN, The Athletic, Sky Sports, Formula 1, PGA
- `science`: Nature, Science Magazine, Scientific American, Science Daily
- `rabbit_hole`: Atlas Obscura, Mental Floss, Reddit (unusual/interesting content)
- `docs`: MDN, Python docs, Node.js docs, etc.
- `forum`: Reddit, Stack Overflow, Hacker News, Dev.to
- `github`: GitHub trending, explore, topics, collections

The classification system in `ScraperManager.js` automatically categorizes scraped content into these topics based on URL patterns and content analysis.

### Project Structure
```
wanderer/
├── src/
│   ├── index.js          # Main crawler entry point
│   ├── webapp.js         # Web application server
│   ├── dashboard.js      # Monitoring dashboard
│   ├── ScraperManager.js # Core orchestration logic
│   ├── wanderCrawler.js  # Aggressive crawler implementation
│   ├── strictCrawler.js  # Respectful crawler implementation
│   ├── models.js         # MongoDB schemas
│   ├── config.js         # Configuration management
│   └── templates/        # HTML templates for web UI
├── wanderer-proxy/       # Cloudflare Worker CORS proxy
└── storage/              # Local data storage (gitignored)
```

### Mode Differences

**Wander Mode**:
- High concurrency (10+ concurrent pages)
- Aggressive retry strategy
- Deep link exploration
- No rate limiting
- Ignores robots.txt
- Extracts complete article content without restrictions
- Maximum stealth techniques (fingerprint randomization, proxy rotation, Tor)
- User assumes full responsibility for ethical usage

**Strict Mode**:
- Low concurrency (2-3 pages)
- Respectful delays between requests
- Follows robots.txt patterns
- Focused content extraction
- Suitable for production use