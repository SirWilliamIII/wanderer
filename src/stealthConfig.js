// src/stealthConfig.js - Advanced Anonymization
export const STEALTH_CONFIG = {
    // Residential-like user agents (rotate every request)
    USER_AGENTS: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],

    // Human-like browsing patterns
    BEHAVIORAL_PATTERNS: {
        // Random delays between actions (milliseconds)
        MIN_DELAY: 800,
        MAX_DELAY: 4000,
        
        // Scroll behavior simulation
        SCROLL_PATTERNS: [
            { distance: 300, delay: 500 },
            { distance: 500, delay: 800 },
            { distance: 800, delay: 1200 }
        ],
        
        // Mouse movement simulation
        MOUSE_MOVEMENTS: true,
        
        // Random page interaction before scraping
        RANDOM_INTERACTIONS: true
    },

    // DNS over HTTPS for privacy
    DNS_SERVERS: [
        'https://1.1.1.1/dns-query', // Cloudflare
        'https://8.8.8.8/dns-query', // Google
        'https://9.9.9.9/dns-query'  // Quad9
    ],

    // Browser fingerprint randomization
    FINGERPRINT_OPTIONS: {
        // Randomize viewport sizes
        VIEWPORTS: [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1440, height: 900 },
            { width: 1536, height: 864 }
        ],
        
        // Randomize timezones
        TIMEZONES: [
            'America/New_York',
            'America/Los_Angeles', 
            'Europe/London',
            'Europe/Berlin',
            'Asia/Tokyo'
        ],
        
        // Randomize languages
        LANGUAGES: [
            'en-US,en;q=0.9',
            'en-GB,en;q=0.9',
            'en-CA,en;q=0.9'
        ]
    },

    // Advanced headers to look more human
    STEALTH_HEADERS: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'DNT': '1',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
    },

    // TLS fingerprint randomization
    TLS_CONFIG: {
        // Randomize TLS versions
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        
        // Randomize cipher suites
        ciphers: [
            'TLS_AES_128_GCM_SHA256',
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256'
        ]
    },

    // Request timing patterns
    TIMING_PATTERNS: {
        // Mimic human reading time
        READING_TIME_PER_WORD: 200, // milliseconds
        
        // Random think time between requests
        MIN_THINK_TIME: 2000,
        MAX_THINK_TIME: 8000,
        
        // Pause longer on certain content types
        CONTENT_PAUSE_MULTIPLIERS: {
            'text/html': 1.0,
            'application/json': 0.3,
            'image/*': 0.1
        }
    }
};

// Generate random fingerprint for each session
export function generateRandomFingerprint() {
    const viewport = STEALTH_CONFIG.FINGERPRINT_OPTIONS.VIEWPORTS[
        Math.floor(Math.random() * STEALTH_CONFIG.FINGERPRINT_OPTIONS.VIEWPORTS.length)
    ];
    
    const timezone = STEALTH_CONFIG.FINGERPRINT_OPTIONS.TIMEZONES[
        Math.floor(Math.random() * STEALTH_CONFIG.FINGERPRINT_OPTIONS.TIMEZONES.length)
    ];
    
    const language = STEALTH_CONFIG.FINGERPRINT_OPTIONS.LANGUAGES[
        Math.floor(Math.random() * STEALTH_CONFIG.FINGERPRINT_OPTIONS.LANGUAGES.length)
    ];
    
    return {
        viewport,
        timezone,
        language,
        userAgent: STEALTH_CONFIG.USER_AGENTS[
            Math.floor(Math.random() * STEALTH_CONFIG.USER_AGENTS.length)
        ]
    };
}

// Human-like delay generator
export function getHumanDelay(baseDelay = 1000) {
    const variation = 0.3; // 30% variation
    const min = baseDelay * (1 - variation);
    const max = baseDelay * (1 + variation);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

