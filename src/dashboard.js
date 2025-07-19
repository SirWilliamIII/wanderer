// src/dashboard.js - Web dashboard for monitoring scraper stats
import express from 'express';
import { WebSocketServer } from 'ws';
import { readFileSync, existsSync, watchFile } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// API endpoint for stats
app.get('/api/stats', (req, res) => {
    try {
        const stats = getScraperStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve the dashboard HTML
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Wanderer Scraper Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a1a; color: #ffffff; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #4CAF50; font-size: 2.5em; margin-bottom: 10px; }
        .status { display: inline-block; padding: 5px 15px; border-radius: 15px; font-size: 0.9em; margin-left: 10px; }
        .status.running { background: #4CAF50; color: white; }
        .status.stopped { background: #f44336; color: white; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #2a2a2a; padding: 20px; border-radius: 10px; border: 1px solid #333; }
        .stat-card h3 { color: #4CAF50; margin-bottom: 15px; font-size: 1.1em; }
        .stat-value { font-size: 2em; font-weight: bold; color: #ffffff; margin-bottom: 5px; }
        .stat-label { color: #aaa; font-size: 0.9em; }
        
        .progress-bar { width: 100%; height: 8px; background: #333; border-radius: 4px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); transition: width 0.3s ease; }
        
        .sessions-section { margin-top: 30px; }
        .sessions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }
        .session-card { background: #2a2a2a; padding: 15px; border-radius: 8px; border: 1px solid #333; }
        .session-id { color: #4CAF50; font-weight: bold; margin-bottom: 10px; }
        .session-stats { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .session-stats span { color: #aaa; }
        
        .log-section { margin-top: 30px; }
        .log-container { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; height: 300px; overflow-y: auto; padding: 15px; font-family: 'Courier New', monospace; }
        .log-entry { margin-bottom: 8px; padding: 5px; border-radius: 3px; }
        .log-entry.info { color: #4CAF50; }
        .log-entry.error { color: #f44336; background: rgba(244, 67, 54, 0.1); }
        .log-entry.warn { color: #ff9800; }
        
        .refresh-btn { background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-bottom: 20px; }
        .refresh-btn:hover { background: #45a049; }
        
        .auto-refresh { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .auto-refresh input { margin-right: 5px; }
        .auto-refresh label { color: #aaa; }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: 1fr; }
            .sessions-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Wanderer Scraper Dashboard</h1>
            <span id="status" class="status stopped">Stopped</span>
        </div>
        
        <div class="auto-refresh">
            <input type="checkbox" id="autoRefresh" checked>
            <label for="autoRefresh">Auto-refresh (5s)</label>
            <button class="refresh-btn" onclick="loadStats()">Refresh Now</button>
        </div>
        
        <div class="stats-grid" id="statsGrid">
            <!-- Stats will be populated here -->
        </div>
        
        <div class="sessions-section">
            <h2>Active Sessions</h2>
            <div class="sessions-grid" id="sessionsGrid">
                <!-- Sessions will be populated here -->
            </div>
        </div>
        
        <div class="log-section">
            <h2>Live Logs</h2>
            <div class="log-container" id="logContainer">
                <div class="log-entry info">Dashboard started - waiting for scraper data...</div>
            </div>
        </div>
    </div>

    <script>
        let autoRefreshInterval;
        
        async function loadStats() {
            try {
                const response = await fetch('/api/stats');
                const data = await response.json();
                
                if (data.error) {
                    updateStatus('stopped');
                    addLog('error', \`Error: \${data.error}\`);
                    return;
                }
                
                updateStatus(data.crawler?.status || 'stopped');
                updateStatsGrid(data.crawler || {});
                updateSessionsGrid(data.sessions || []);
                
            } catch (error) {
                updateStatus('stopped');
                addLog('error', \`Failed to load stats: \${error.message}\`);
            }
        }
        
        function updateStatus(status) {
            const statusEl = document.getElementById('status');
            statusEl.className = \`status \${status}\`;
            statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
        
        function updateStatsGrid(stats) {
            const grid = document.getElementById('statsGrid');
            const runtime = stats.crawlerRuntimeMillis ? (stats.crawlerRuntimeMillis / 1000).toFixed(0) + 's' : '0s';
            const successRate = stats.requestsTotal > 0 ? ((stats.requestsFinished / stats.requestsTotal) * 100).toFixed(1) : '0';
            
            grid.innerHTML = \`
                <div class="stat-card">
                    <h3>📊 Requests</h3>
                    <div class="stat-value">\${stats.requestsFinished || 0}</div>
                    <div class="stat-label">Finished</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: \${successRate}%"></div>
                    </div>
                    <div class="stat-label">Success Rate: \${successRate}%</div>
                </div>
                
                <div class="stat-card">
                    <h3>⚡ Performance</h3>
                    <div class="stat-value">\${stats.requestsFinishedPerMinute || 0}</div>
                    <div class="stat-label">Requests/min</div>
                    <div class="stat-value">\${stats.requestAvgFinishedDurationMillis ? (stats.requestAvgFinishedDurationMillis / 1000).toFixed(1) + 's' : '0s'}</div>
                    <div class="stat-label">Avg Duration</div>
                </div>
                
                <div class="stat-card">
                    <h3>⏱️ Runtime</h3>
                    <div class="stat-value">\${runtime}</div>
                    <div class="stat-label">Total Runtime</div>
                    <div class="stat-value">\${stats.requestsFailed || 0}</div>
                    <div class="stat-label">Failed Requests</div>
                </div>
                
                <div class="stat-card">
                    <h3>🔄 Activity</h3>
                    <div class="stat-value">\${stats.requestsTotal || 0}</div>
                    <div class="stat-label">Total Requests</div>
                    <div class="stat-value">\${stats.requestsRetries || 0}</div>
                    <div class="stat-label">Retries</div>
                </div>
            \`;
        }
        
        function updateSessionsGrid(sessions) {
            const grid = document.getElementById('sessionsGrid');
            if (!sessions.length) {
                grid.innerHTML = '<div class="session-card">No active sessions</div>';
                return;
            }
            
            grid.innerHTML = sessions.slice(0, 6).map(session => \`
                <div class="session-card">
                    <div class="session-id">\${session.id}</div>
                    <div class="session-stats">
                        <span>Usage:</span>
                        <span>\${session.usageCount}/\${session.maxUsageCount}</span>
                    </div>
                    <div class="session-stats">
                        <span>Error Score:</span>
                        <span>\${session.errorScore}</span>
                    </div>
                    <div class="session-stats">
                        <span>Cookies:</span>
                        <span>\${session.cookieJar?.cookies?.length || 0}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: \${(session.usageCount / session.maxUsageCount) * 100}%"></div>
                    </div>
                </div>
            \`).join('');
        }
        
        function addLog(type, message) {
            const container = document.getElementById('logContainer');
            const entry = document.createElement('div');
            entry.className = \`log-entry \${type}\`;
            entry.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
            container.appendChild(entry);
            container.scrollTop = container.scrollHeight;
            
            // Keep only last 100 entries
            while (container.children.length > 100) {
                container.removeChild(container.firstChild);
            }
        }
        
        // Auto-refresh functionality
        document.getElementById('autoRefresh').addEventListener('change', function(e) {
            if (e.target.checked) {
                autoRefreshInterval = setInterval(loadStats, 5000);
            } else {
                clearInterval(autoRefreshInterval);
            }
        });
        
        // Initial load
        loadStats();
        autoRefreshInterval = setInterval(loadStats, 5000);
    </script>
</body>
</html>
    `);
});

// Read scraper statistics from storage files
function getScraperStats() {
    const basePath = join(__dirname, '../storage/key_value_stores/default');
    const statsPath = join(basePath, 'SDK_CRAWLER_STATISTICS_0.json');
    const sessionsPath = join(basePath, 'SDK_SESSION_POOL_STATE.json');
    
    let stats = {};
    
    // Read crawler statistics
    if (existsSync(statsPath)) {
        try {
            const statsData = JSON.parse(readFileSync(statsPath, 'utf8'));
            stats.crawler = {
                ...statsData,
                status: statsData.crawlerFinishedAt ? 'stopped' : 'running'
            };
        } catch (error) {
            console.error('Error reading crawler stats:', error);
        }
    }
    
    // Read session pool state
    if (existsSync(sessionsPath)) {
        try {
            const sessionsData = JSON.parse(readFileSync(sessionsPath, 'utf8'));
            stats.sessions = sessionsData.sessions || [];
        } catch (error) {
            console.error('Error reading sessions:', error);
        }
    }
    
    return stats;
}

// Start the server
const server = app.listen(PORT, () => {
    console.log(`🚀 Wanderer Dashboard running at http://localhost:${PORT}`);
    console.log(`📊 Monitoring scraper statistics in real-time`);
});

// WebSocket for real-time updates (future enhancement)
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
    console.log('Dashboard client connected');
    
    // Send initial stats
    ws.send(JSON.stringify(getScraperStats()));
    
    ws.on('close', () => {
        console.log('Dashboard client disconnected');
    });
});

// Watch for file changes and broadcast updates
const basePath = join(__dirname, '../storage/key_value_stores/default');
const statsPath = join(basePath, 'SDK_CRAWLER_STATISTICS_0.json');

if (existsSync(statsPath)) {
    watchFile(statsPath, () => {
        const stats = getScraperStats();
        wss.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(JSON.stringify(stats));
            }
        });
    });
}