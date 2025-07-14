// src/wanderCrawler.js
import { PlaywrightCrawler } from 'crawlee';
import { WANDERER_CONFIG } from './config.js';

export function createWanderCrawler(scraperManager) {
    const config = scraperManager.getConfig();
    
    // Build crawler options dynamically
    const crawlerOptions = {
        // Session management (v3.13 API)
        useSessionPool: scraperManager.useSessionPool,
        sessionPoolOptions: scraperManager.sessionPoolOptions,
        persistCookiesPerSession: true,
        
        // Aggressive settings for exploration
        maxRequestsPerCrawl: config.maxRequestsPerCrawl,
        maxConcurrency: config.maxConcurrency,
        requestHandlerTimeoutSecs: config.requestHandlerTimeoutSecs,
        maxRequestRetries: 3,
        
        // Browser settings
        launchContext: {
            launchOptions: {
                headless: true,
            },
        },
        
        // Custom headers for each request
        preNavigationHooks: [
            (crawlingContext, gotOptions) => {
                gotOptions.headers = {
                    ...gotOptions.headers,
                    ...WANDERER_CONFIG.DEFAULT_HEADERS
                };
            }
        ],
        
        async requestHandler({ page, request, enqueueLinks, log, session }) {
            scraperManager.log('info', `Processing: ${request.url}`);
            
            try {
                // Wait for page to be fully loaded including JS
                await page.waitForLoadState('networkidle', { timeout: 10000 });
                
                // Add random human-like delay
                const delay = scraperManager.getRandomDelay();
                await page.waitForTimeout(delay);
                
                // Extract comprehensive data
                const data = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a[href]'));
                    const images = Array.from(document.querySelectorAll('img[src]'));
                    
                    return {
                        url: window.location.href,
                        title: document.title,
                        description: document.querySelector('meta[name="description"]')?.content || '',
                        text: document.body.innerText.slice(0, 2000), // First 2k chars
                        wordCount: document.body.innerText.split(/\s+/).length,
                        linkCount: links.length,
                        imageCount: images.length,
                        headings: {
                            h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()).slice(0, 5),
                            h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()).slice(0, 5),
                            h3: Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim()).slice(0, 5)
                        },
                        timestamp: new Date().toISOString(),
                        statusCode: 200 // Successful load
                    };
                });
                
                // Aggressively discover and follow links
                await enqueueLinks({
                    selector: config.selectors,
                    strategy: config.linkStrategy,
                    transformRequestFunction: (req) => {
                        // Add metadata for tracking
                        req.userData = {
                            ...req.userData,
                            depth: (request.userData?.depth || 0) + 1,
                            parentUrl: request.url,
                            discoveredAt: new Date().toISOString()
                        };
                        
                        // Limit crawl depth to prevent infinite loops
                        if (req.userData.depth > 5) {
                            return false;
                        }
                        
                        return req;
                    }
                });
                
                // Store the extracted data
                await scraperManager.saveData({
                    ...data,
                    mode: 'wander',
                    depth: request.userData?.depth || 0,
                    parentUrl: request.userData?.parentUrl || null
                });
                
                if (session) session.markGood();
                scraperManager.log('info', `✅ Extracted data from: ${request.url}`, { 
                    links: data.linkCount, 
                    words: data.wordCount 
                });
                
            } catch (error) {
                scraperManager.log('error', `Failed to process: ${request.url}`, error);
                if (session) session.markBad();
                throw error;
            }
        },
        
        async failedRequestHandler({ request, log, session }) {
            scraperManager.log('error', `❌ Failed after retries: ${request.url}`);
            
            // Store failure data for analysis
            await scraperManager.saveData({
                url: request.url,
                mode: 'wander',
                status: 'failed',
                errorMessages: request.errorMessages,
                retryCount: request.retryCount,
                timestamp: new Date().toISOString()
            });
            
            if (session) session.markBad();
        },
        
        async errorHandler({ error, request, log }) {
            scraperManager.log('error', `💥 Error processing: ${request?.url}`, error);
        }
    };
    
    // Only add proxy configuration if we have one
    if (scraperManager.proxyConfig) {
        crawlerOptions.proxyConfiguration = scraperManager.proxyConfig;
    }
    
    return new PlaywrightCrawler(crawlerOptions);
}