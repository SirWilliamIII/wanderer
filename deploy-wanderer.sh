#!/bin/bash
# deploy-wanderer.sh - Deploy Wanderer to Fly.io (3 Regions)

set -euo pipefail

echo "🚀 Deploying Wanderer to Fly.io (Sydney, Chicago, Frankfurt)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Fly CLI
if ! command -v fly &> /dev/null; then
    echo "Installing Fly CLI..."
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
fi

# Login check
if ! fly auth whoami &> /dev/null; then
    echo "Please login to Fly.io:"
    fly auth login
fi

# Generate unique app name with wanderer prefix
APP_NAME="wanderer-$(date +%s)"
echo -e "${BLUE}📱 Creating app: ${APP_NAME}${NC}"

# Create fly.toml for Wanderer
cat > fly.toml << EOF
app = "${APP_NAME}"
primary_region = "ord"

[build]
  dockerfile = "Containerfile"

[env]
  NODE_ENV = "production"
  CRAWLEE_PURGE_ON_START = "true"
  CRAWLEE_LOG_LEVEL = "INFO"
  APP_NAME = "wanderer"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 3
  max_machines_running = 9

  [[http_service.http_checks]]
    interval = "30s"
    timeout = "10s"
    path = "/health"

[vm]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 1024

[[statics]]
  guest_path = "/app/storage"
  url_prefix = "/storage"
EOF

# Launch the app
echo -e "${BLUE}🏗️  Launching Wanderer...${NC}"
fly launch --name "$APP_NAME" --no-deploy --copy-config

# Set secrets
echo -e "${BLUE}🔐 Setting up secrets...${NC}"
ENCRYPTION_KEY=$(openssl rand -hex 32)
fly secrets set \
  SCRAPER_ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  SCRAPER_TARGETS="https://httpbin.org/html,https://quotes.toscrape.com" \
  --app "$APP_NAME"

# Deploy
echo -e "${BLUE}📦 Building and deploying...${NC}"
fly deploy --app "$APP_NAME"

# Scale to 3 regions
echo -e "${BLUE}🌍 Scaling to 3 regions...${NC}"
fly scale count ord=1 syd=1 fra=1 --app "$APP_NAME"

# Wait and test
echo -e "${YELLOW}⏳ Waiting for deployment...${NC}"
sleep 30

echo -e "${BLUE}🔍 Testing deployment...${NC}"
if curl -sf "https://${APP_NAME}.fly.dev/health"; then
    echo -e "${GREEN}✅ Wanderer deployed successfully!${NC}"
else
    echo "❌ Health check failed"
fi

echo ""
echo -e "${GREEN}🎉 Wanderer is now wandering the web from 3 regions!${NC}"
echo "📍 Regions: Chicago (ord), Sydney (syd), Frankfurt (fra)"
echo "🔗 URL: https://${APP_NAME}.fly.dev"
echo "📊 Status: fly status --app $APP_NAME"
echo "📝 Logs: fly logs --app $APP_NAME"
echo "⚡ Scale up: fly scale count ord=2 syd=2 fra=2 --app $APP_NAME"
echo ""
echo "🕷️  Start scraping:"
echo "curl -X POST https://${APP_NAME}.fly.dev/api/scrape \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"mode\": \"wander\", \"targets\": [\"https://example.com\"]}'"

---

#!/bin/bash
# local-wanderer.sh - Run Wanderer locally with Podman

echo "🏠 Starting Wanderer locally with Podman"

# Generate unique container names
TIMESTAMP=$(date +%s)

# Create .env if it doesn't exist
if [[ ! -f .env ]]; then
    echo "🔐 Creating .env file..."
    cat > .env << EOF
SCRAPER_ENCRYPTION_KEY=$(openssl rand -hex 32)
SCRAPER_TARGETS=https://httpbin.org/html,https://quotes.toscrape.com
NODE_ENV=development
EOF
fi

# Build Wanderer image
echo "🔨 Building Wanderer image..."
podman build -t wanderer:latest -f Containerfile .

# Run 3 regional instances
echo "🌍 Starting 3 regional instances..."

# Sydney
podman run -d \
  --name "wanderer-sydney-${TIMESTAMP}" \
  --env-file .env \
  -e REGION=sydney \
  -e TIMEZONE=Australia/Sydney \
  -p 3001:3000 \
  wanderer:latest &

# Chicago  
podman run -d \
  --name "wanderer-chicago-${TIMESTAMP}" \
  --env-file .env \
  -e REGION=chicago \
  -e TIMEZONE=America/Chicago \
  -p 3002:3000 \
  wanderer:latest &

# Frankfurt
podman run -d \
  --name "wanderer-frankfurt-${TIMESTAMP}" \
  --env-file .env \
  -e REGION=frankfurt \
  -e TIMEZONE=Europe/Berlin \
  -p 3003:3000 \
  wanderer:latest &

# Wait for containers to start
echo "⏳ Waiting for Wanderer instances to start..."
sleep 20

# Health checks
echo "🔍 Checking Wanderer health..."
regions=("Sydney:3001" "Chicago:3002" "Frankfurt:3003")

for region in "${regions[@]}"; do
    name=$(echo $region | cut -d: -f1)
    port=$(echo $region | cut -d: -f2)
    
    if curl -sf "http://localhost:${port}/health" > /dev/null; then
        echo "✅ $name Wanderer: Ready"
    else
        echo "❌ $name Wanderer: Failed"
    fi
done

echo ""
echo "🎉 Wanderer is ready to explore!"
echo "🔗 Access points:"
echo "  • Sydney:    http://localhost:3001"
echo "  • Chicago:   http://localhost:3002"
echo "  • Frankfurt: http://localhost:3003"
echo ""
echo "📝 View logs: podman logs wanderer-sydney-${TIMESTAMP}"
echo "🛑 Stop all:  podman stop \$(podman ps -q --filter name=wanderer)"

---

#!/bin/bash
# wanderer-status.sh - Monitor Wanderer deployment

clear
echo "📊 Wanderer Status Dashboard"
echo "=============================="

# Function to check if running on Fly.io or locally
check_deployment_type() {
    if fly apps list 2>/dev/null | grep -q wanderer; then
        echo "☁️  Deployment: Fly.io"
        return 0
    elif podman ps | grep -q wanderer; then
        echo "🏠 Deployment: Local (Podman)"
        return 1
    else
        echo "❌ No Wanderer deployment found"
        exit 1
    fi
}

if check_deployment_type; then
    # Fly.io deployment
    APP_NAME=$(fly apps list | grep wanderer | head -1 | awk '{print $1}')
    echo "📱 App: $APP_NAME"
    echo ""
    
    echo "🌍 Regional Status:"
    fly status --app "$APP_NAME"
    
    echo ""
    echo "📊 Recent Activity:"
    fly logs --app "$APP_NAME" | tail -10
    
else
    # Local Podman deployment
    echo ""
    echo "🏠 Local Containers:"
    podman ps --filter name=wanderer --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo "📊 Resource Usage:"
    podman stats --no-stream --filter name=wanderer --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    
    echo ""
    echo "🔍 Health Status:"
    for port in 3001 3002 3003; do
        region=$([ $port -eq 3001 ] && echo "Sydney" || [ $port -eq 3002 ] && echo "Chicago" || echo "Frankfurt")
        if curl -sf "http://localhost:${port}/health" >/dev/null 2>&1; then
            echo "✅ $region (localhost:$port)"
        else
            echo "❌ $region (localhost:$port)"
        fi
    done
fi

echo ""
echo "🔄 Auto-refresh in 30s (Ctrl+C to exit)"
