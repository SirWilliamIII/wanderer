// src/config.js
export const WANDERER_CONFIG = {
    // Wander mode - aggressive discovery
    WANDER: {
        maxRequestsPerCrawl: 10000,
        maxConcurrency: 10,
        requestHandlerTimeoutSecs: 60,
        minDelayBetweenRequests: 1000,
        maxDelayBetweenRequests: 3000,
        linkStrategy: 'all',
        selectors: 'a[href]' // Follow all links
    },
    
    // Strict mode - respectful & targeted
    STRICT: {
        maxRequestsPerCrawl: 1000,
        maxConcurrency: 2,
        requestHandlerTimeoutSecs: 30,
        minDelayBetweenRequests: 2000,
        maxDelayBetweenRequests: 5000,
        linkStrategy: 'same-domain',
        selectors: 'a[href*="/product/"], a[href*="/article/"], a[href*="/blog/"]' // Targeted links
    },
    
    // Proxy tiers - add your own proxy URLs here
    PROXY_TIERS: {
        basic: [
            // Add your basic proxy URLs here
            // 'http://proxy1.example.com:8080',
            // 'http://proxy2.example.com:8080'
        ],
        premium: [
            // Add your premium proxy URLs here  
            // 'http://premium1.proxy.com:8080',
            // 'http://premium2.proxy.com:8080'
        ]
    },
    
    // Browser fingerprint options
    FINGERPRINTS: {
        locales: ['en-US', 'en-GB', 'en-CA'],
        operatingSystems: ['windows', 'macos', 'linux'],
        browsers: ['chrome', 'firefox', 'safari']
    },
    
    // Request headers to appear human-like
    DEFAULT_HEADERS: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
    },
    
    // URLs to avoid in strict mode
    RESTRICTED_PATTERNS: [
        '/admin/',
        '/private/',
        '/api/',
        '/login/',
        '/signup/',
        '.pdf',
        '.zip',
        '.exe'
    ],
    
    // MongoDB configuration
    DATABASE: {
        url: process.env.MONGODB_URL || 'mongodb://localhost:27017/wanderer',
        options: {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000
        },
        collections: {
            scraped_data: 'scraped_data'
        }
    },
    
    // Document classification settings (loose thresholds for now)
    CLASSIFICATION: {
        // When to split collections (adjust these later)
        COLLECTION_SIZE_THRESHOLD: parseInt(process.env.COLLECTION_THRESHOLD) || 1000,
        
        // Simple classification categories
        CATEGORIES: ['ecommerce', 'news', 'docs', 'forum', 'general'],
        
        // Auto-create monthly collections
        AUTO_CREATE_COLLECTIONS: true
    }
};
