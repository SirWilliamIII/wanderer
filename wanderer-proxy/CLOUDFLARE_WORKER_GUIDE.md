# Complete Guide to Creating a Cloudflare Worker

This guide walks you through creating a Cloudflare Worker from scratch, step by step.

## Prerequisites

1. **Node.js and npm installed**
   ```bash
   node --version  # Should be 16.x or higher
   npm --version   # Should be 6.x or higher
   ```

2. **Cloudflare Account**
   - Sign up at https://dash.cloudflare.com/sign-up
   - No credit card required for free tier

## Step 1: Install Wrangler CLI

Wrangler is Cloudflare's command-line tool for managing Workers.

```bash
npm install -g wrangler
# or use npx (no installation needed)
npx wrangler --version
```

## Step 2: Create a New Worker Project

### Option A: Using Wrangler Init (TypeScript)
```bash
npx wrangler init my-worker --yes
cd my-worker
```

### Option B: Manual Setup (JavaScript)
```bash
mkdir my-worker
cd my-worker
npm init -y
```

## Step 3: Configure Your Worker

Create `wrangler.toml` in your project root:

```toml
name = "my-worker"              # Your worker name (must be unique)
main = "src/worker.js"          # Entry point for your worker
workers_dev = true              # Deploy to workers.dev subdomain
compatibility_date = "2025-07-19"  # Use latest compatibility date

[observability]
enabled = true                  # Enable logging and metrics

# Optional configurations:

# Environment variables
# [vars]
# API_KEY = "your-api-key"

# KV Namespace (key-value storage)
# [[kv_namespaces]]
# binding = "MY_KV"
# id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Durable Objects
# [[durable_objects.bindings]]
# name = "MY_DO"
# class_name = "MyDurableObject"

# R2 Bucket (object storage)
# [[r2_buckets]]
# binding = "MY_BUCKET"
# bucket_name = "my-bucket"

# D1 Database
# [[d1_databases]]
# binding = "DB"
# database_name = "my-database"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Step 4: Write Your Worker Code

Create `src/worker.js`:

```javascript
export default {
  async fetch(request, env, ctx) {
    // Your worker logic here
    return new Response('Hello World!', {
      headers: { 'content-type': 'text/plain' },
    });
  },
};
```

### Understanding the Parameters:

- **request**: The incoming HTTP request object
  - `request.url` - The full URL
  - `request.method` - HTTP method (GET, POST, etc.)
  - `request.headers` - Request headers
  - `request.body` - Request body (for POST/PUT)

- **env**: Environment bindings
  - Contains KV namespaces, Durable Objects, secrets, etc.
  - Example: `env.MY_KV.get('key')`

- **ctx**: Context object
  - `ctx.waitUntil()` - For background tasks
  - `ctx.passThroughOnException()` - For error handling

## Step 5: Test Locally

Run your worker locally:

```bash
npx wrangler dev
```

This will:
- Start a local server (usually on http://localhost:8787)
- Hot reload on file changes
- Show console logs in terminal

### Testing with curl:
```bash
# GET request
curl http://localhost:8787

# POST request with JSON
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# With query parameters
curl "http://localhost:8787?param=value"
```

## Step 6: Authenticate with Cloudflare

```bash
npx wrangler login
```

This will:
1. Open your browser
2. Ask you to authorize Wrangler
3. Save credentials locally

## Step 7: Deploy Your Worker

### First Deployment:
```bash
npx wrangler deploy
```

This will:
- Bundle your code
- Upload to Cloudflare
- Give you a URL like: https://my-worker.username.workers.dev

### Update Deployment:
```bash
npx wrangler deploy
```

## Step 8: Manage Your Worker

### View Logs:
```bash
npx wrangler tail
```

### Delete Worker:
```bash
npx wrangler delete
```

### List Workers:
```bash
npx wrangler list
```

## Advanced Features

### 1. Custom Domain
Add to `wrangler.toml`:
```toml
routes = [
  { pattern = "example.com/*", zone_name = "example.com" }
]
```

### 2. Environment Variables
```toml
[vars]
API_KEY = "default-key"

[env.production.vars]
API_KEY = "production-key"

[env.staging.vars]
API_KEY = "staging-key"
```

Deploy to specific environment:
```bash
npx wrangler deploy --env production
```

### 3. Secrets (Sensitive Data)
```bash
npx wrangler secret put MY_SECRET
```

Access in code:
```javascript
const secret = env.MY_SECRET;
```

### 4. KV Storage
Create namespace:
```bash
npx wrangler kv:namespace create "MY_KV"
```

Use in code:
```javascript
// Write
await env.MY_KV.put('key', 'value');

// Read
const value = await env.MY_KV.get('key');

// Delete
await env.MY_KV.delete('key');

// List
const list = await env.MY_KV.list();
```

### 5. Scheduled Workers (Cron)
Add to `wrangler.toml`:
```toml
[triggers]
crons = ["0 */4 * * *"]  # Every 4 hours
```

Add handler:
```javascript
export default {
  async scheduled(event, env, ctx) {
    // Cron job logic
  },
  async fetch(request, env, ctx) {
    // HTTP handler
  }
};
```

## Example: CORS Proxy Worker

Here's a complete example of a CORS proxy worker:

```javascript
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        }
      });
    }

    // Get target URL from query parameter
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing url parameter', { status: 400 });
    }

    try {
      // Forward the request
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });

      // Add CORS headers to response
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');

      return newResponse;
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
};
```

## Debugging Tips

1. **Use console.log()**
   - Logs appear in `wrangler dev` terminal
   - Use `wrangler tail` for production logs

2. **Check wrangler.toml**
   - Ensure `main` points to correct file
   - Verify `compatibility_date` is valid

3. **Common Errors:**
   - "Script not found" - Check `main` path in wrangler.toml
   - "Unauthorized" - Run `wrangler login`
   - "Name already taken" - Change worker name in wrangler.toml

4. **Performance Tips:**
   - Workers have 10ms CPU time limit (50ms for paid plans)
   - Max 128MB memory
   - 1MB script size limit
   - Use `ctx.waitUntil()` for background tasks

## Testing Your Worker

Create a test file `test.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Worker Test</title>
</head>
<body>
    <h1>Test Your Worker</h1>
    <button onclick="testWorker()">Test Request</button>
    <pre id="result"></pre>

    <script>
    async function testWorker() {
        try {
            const response = await fetch('http://localhost:8787');
            const text = await response.text();
            document.getElementById('result').textContent = text;
        } catch (error) {
            document.getElementById('result').textContent = 'Error: ' + error.message;
        }
    }
    </script>
</body>
</html>
```

## Resources

- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Workers Examples](https://developers.cloudflare.com/workers/examples/)
- [Workers Discord](https://discord.gg/cloudflaredev)

## Summary

1. Install Wrangler: `npm install -g wrangler`
2. Create project: `npx wrangler init my-worker`
3. Configure: Edit `wrangler.toml`
4. Write code: Create worker in `src/worker.js`
5. Test: `npx wrangler dev`
6. Login: `npx wrangler login`
7. Deploy: `npx wrangler deploy`

That's it! You now have a working Cloudflare Worker.
