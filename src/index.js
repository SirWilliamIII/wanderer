// src/index.js
import { ScraperManager } from './ScraperManager.js';
import { createWanderCrawler } from './wanderCrawler.js';
import { createStrictCrawler } from './strictCrawler.js';
import { ScrapedData } from './models.js';

async function main() {
    console.log('🚀 Starting Multi-Mode Web Scraper');
    
    // Configuration - can come from env vars, CLI args, or config file
    const config = {
        mode: process.env.WANDERER_MODE || 'strict', // 'wander' or 'strict'
        
        // Target URLs
        targets: process.env.WANDERER_TARGETS?.split(',') || [
            'https://example.com',
            'https://www.whitehouse.gov/',
            'https://github.com/trending',
            'https://formula1.com/'
        ],
        
        // Custom proxy configuration (optional)
        proxies: {
            basic: process.env.BASIC_PROXIES?.split(',') || [],
            premium: process.env.PREMIUM_PROXIES?.split(',') || []
        }
    };
    
// Example proxy tiers (not used directly, for reference)
// const PROXY_TIERS = {
//   basic: [
//       'http://proxy1.example.com:8080',
//       'http://proxy2.example.com:8080'
//   ],
//   premium: [
//       'http://premium1.proxy.com:8080'
//   ]
// };
    
    
    let scraperManager;
    
    try {
        // Initialize the scraper manager
        scraperManager = new ScraperManager(config);
        globalScraperManager = scraperManager; // For cleanup on shutdown
        
        // Wait for database connection
        await scraperManager.initDatabase();
        
        // Create the appropriate crawler based on mode
        let crawler;
        if (config.mode === 'wander') {
            crawler = createWanderCrawler(scraperManager);
            console.log('WANDER MODE: Aggressive discovery enabled');
            console.log('   • Following all links');
            console.log('   • High concurrency');
            console.log('   • Deep exploration');
        } else {
            crawler = createStrictCrawler(scraperManager);
            console.log('STRICT MODE: Respectful & targeted scraping');
            console.log('   • Respecting robots.txt patterns');
            console.log('   • Lower concurrency');
            console.log('   • Focused content extraction');
        }
        
        // Start the crawling process
        console.log(`\n🏃 Starting crawler with ${config.targets.length} target(s)...`);
        const startTime = Date.now();
        
        await crawler.run(config.targets);
        
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        // Get results summary from MongoDB
        console.log('\n✅ Scraping completed!');
        console.log(`⏱️  Duration: ${duration}s`);
        
        if (scraperManager.dbConnected) {
            try {
                const totalCount = await ScrapedData.countDocuments();
                const successfulCount = await ScrapedData.countDocuments({ status: { $ne: 'failed' } });
                const failedCount = await ScrapedData.countDocuments({ status: 'failed' });
                
                console.log(`📊 Total items scraped: ${totalCount}`);
                
                if (config.mode === 'wander') {
                    const linkStats = await ScrapedData.aggregate([
                        { $match: { status: { $ne: 'failed' } } },
                        { $group: { 
                            _id: null, 
                            totalLinks: { $sum: '$linkCount' },
                            avgDepth: { $avg: '$depth' }
                        }}
                    ]);
                    
                    if (linkStats.length > 0) {
                        console.log(`🔗 Total links discovered: ${linkStats[0].totalLinks || 0}`);
                        console.log(`📏 Average crawl depth: ${(linkStats[0].avgDepth || 0).toFixed(1)}`);
                    }
                } else {
                    const productStats = await ScrapedData.aggregate([
                        { $match: { status: { $ne: 'failed' } } },
                        { $group: { 
                            _id: null, 
                            totalProducts: { $sum: { $size: { $ifNull: ['$products', []] } } },
                            totalHeadings: { $sum: { $add: [
                                { $size: { $ifNull: ['$headings.h1', []] } },
                                { $size: { $ifNull: ['$headings.h2', []] } }
                            ]}}
                        }}
                    ]);
                    
                    if (productStats.length > 0) {
                        console.log(`🛍️  Products found: ${productStats[0].totalProducts || 0}`);
                        console.log(`📝 Headings extracted: ${productStats[0].totalHeadings || 0}`);
                    }
                }
                
                // Show failure rate
                if (totalCount > 0) {
                    const successRate = ((successfulCount / totalCount) * 100).toFixed(1);
                    console.log(`✅ Success rate: ${successRate}%`);
                    
                    if (failedCount > 0) {
                        console.log(`❌ Failed requests: ${failedCount}`);
                    }
                }
                
                console.log(`\n💾 Data saved to MongoDB: wanderer database`);
            } catch (dbError) {
                console.log('⚠️  Could not retrieve statistics from database:', dbError.message);
            }
        } else {
            console.log('💾 Data was logged to console (database not connected)');
        }
        
    } catch (error) {
        console.error('💥 Scraper failed:', error);
        if (scraperManager) {
            await scraperManager.closeDatabase();
        }
        process.exit(1);
    } finally {
        // Cleanup database connection
        if (scraperManager) {
            await scraperManager.closeDatabase();
        }
    }
}

// Global reference for cleanup
let globalScraperManager = null;

// Handle graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    if (globalScraperManager) {
        await globalScraperManager.closeDatabase();
    }
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the scraper
main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
