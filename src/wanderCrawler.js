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
                    
                    // Try to find article content using common selectors
                    const articleSelectors = 'article, .article, .content, .post, .entry, main, .main-content, .story-body, .article-body, .post-content';
                    const articleElement = document.querySelector(articleSelectors);
                    const mainText = articleElement ? 
                        articleElement.innerText.trim().slice(0, 5000) : 
                        document.body.innerText.trim().slice(0, 5000);
                    
                    return {
                        url: window.location.href,
                        title: document.title,
                        description: document.querySelector('meta[name="description"]')?.content || '',
                        text: document.body.innerText.slice(0, 1000), // First 1k chars for compatibility
                        wordCount: document.body.innerText.split(/\s+/).length,
                        linkCount: links.length,
                        imageCount: images.length,
                        headings: {
                            h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()).slice(0, 5),
                            h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()).slice(0, 5),
                            h3: Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim()).slice(0, 5)
                        },
                        
                        // Full article content extraction
                        articleContent: {
                            mainText: mainText,
                            
                            // Extract paragraphs from article area
                            paragraphs: Array.from(document.querySelectorAll('article p, .article p, .content p, .post p, .entry p, main p'))
                                .map(p => p.textContent.trim())
                                .filter(p => p.length > 20)
                                .slice(0, 20),
                            
                            // Extract code blocks (useful for GitHub and tech content)
                            codeBlocks: Array.from(document.querySelectorAll('pre, code, .code, .highlight'))
                                .map(code => code.textContent.trim())
                                .filter(code => code.length > 10)
                                .slice(0, 10),
                            
                            // Extract images with metadata
                            images: Array.from(document.querySelectorAll('img')).map(img => ({
                                src: img.src,
                                alt: img.alt,
                                title: img.title
                            })).slice(0, 10)
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
