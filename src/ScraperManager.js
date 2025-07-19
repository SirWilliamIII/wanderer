// src/ScraperManager.js
import { ProxyConfiguration } from 'crawlee';
import { WANDERER_CONFIG } from './config.js';
import mongoose from 'mongoose';
import { ScrapedData } from './models.js';

export class ScraperManager {
    constructor(options = {}) {
        this.mode = options.mode || 'strict';
        this.customProxies = options.proxies || {};
        this.targets = options.targets || [];
        this.dbConnected = false;
        
        // Initialize proxy configuration
        this.proxyConfig = this.setupProxies();
        
        // Session pool configuration (using latest v3.13 API)
        this.useSessionPool = true;
        this.sessionPoolOptions = {
            maxPoolSize: this.mode === 'wander' ? 50 : 20,
        };
        
        console.log(`🔧 ScraperManager initialized in ${this.mode.toUpperCase()} mode`);
        
        // Initialize database connection
        this.initDatabase();
    }
    
    setupProxies() {
        const basicProxies = this.customProxies.basic || [];
        const premiumProxies = this.customProxies.premium || [];
        
        // Add some free public proxies for testing (use with caution)
        const freeProxies = [
            // These are examples - replace with working proxies
            // 'http://proxy1.example.com:8080',
            // 'http://proxy2.example.com:3128'
        ];
        
        // Combine free proxies with basic tier
        const allBasicProxies = [...freeProxies, ...basicProxies].filter(Boolean);
        
        // Only create ProxyConfiguration if we actually have proxies
        if (allBasicProxies.length === 0 && premiumProxies.length === 0) {
            console.log('🌐 No proxies configured - using direct connection');
            return null; // No proxy configuration
        }
        
        const tieredProxies = [[null]]; // Start with no proxy
        
        if (allBasicProxies.length > 0) {
            tieredProxies.push(allBasicProxies);
            console.log(`🔄 Basic proxy tier: ${allBasicProxies.length} proxies`);
        }
        
        if (premiumProxies.length > 0) {
            tieredProxies.push(premiumProxies);
            console.log(`💎 Premium proxy tier: ${premiumProxies.length} proxies`);
        }
        
        console.log(`🔄 Proxy tiers configured: ${tieredProxies.length - 1} tier(s)`);
        return new ProxyConfiguration({
            tieredProxyUrls: tieredProxies
        });
    }
    
    getConfig() {
        return this.mode === 'wander' 
            ? WANDERER_CONFIG.WANDER 
            : WANDERER_CONFIG.STRICT;
    }
    
    // Utility to check if URL should be skipped
    shouldSkipUrl(url) {
        if (this.mode !== 'strict') return false;
        
        return WANDERER_CONFIG.RESTRICTED_PATTERNS.some(pattern => 
            url.toLowerCase().includes(pattern)
        );
    }
    
    // Generate random delay for human-like behavior
    getRandomDelay() {
        const config = this.getConfig();
        const min = config.minDelayBetweenRequests;
        const max = config.maxDelayBetweenRequests;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // Log with mode prefix
    log(level, message, data = {}) {
        const prefix = `[${this.mode.toUpperCase()}]`;
        console[level](`${prefix} ${message}`, data);
    }
    
    // Initialize MongoDB connection
    async initDatabase() {
        try {
            const dbConfig = WANDERER_CONFIG.DATABASE;
            await mongoose.connect(dbConfig.url, dbConfig.options);
            this.dbConnected = true;
            console.log('🗄️  MongoDB connected successfully');
        } catch (error) {
            console.error('❌ MongoDB connection failed:', error.message);
            console.log('📁 Falling back to local file storage');
            this.dbConnected = false;
        }
    }
    
    // Simple document classification
    classifyDocument(data) {
        const text = `${data.title || ''} ${data.description || ''} ${data.text || ''}`.toLowerCase();
        const url = (data.url || '').toLowerCase();
        
        // GitHub-specific classification (highest priority)
        if (url.includes('github.com') || url.includes('github.io') || 
            text.includes('github') || text.includes('repository') || 
            text.includes('pull request') || text.includes('commit') ||
            text.includes('open source') || text.includes('git clone')) {
            return 'github';
        }
        
        // Sports
        if (url.includes('espn.com') || url.includes('theathletic.com') || 
            url.includes('bleacherreport.com') || url.includes('skysports.com') ||
            url.includes('formula1.com') || url.includes('pgatour.com') ||
            url.includes('/sport') || text.includes('sports') || 
            text.includes('football') || text.includes('basketball') ||
            text.includes('baseball') || text.includes('soccer') ||
            text.includes('tennis') || text.includes('golf') ||
            text.includes('championship') || text.includes('league') ||
            text.includes('athlete') || text.includes('match') ||
            text.includes('tournament') || text.includes('playoff')) {
            return 'sports';
        }
        
        // Science
        if (url.includes('nature.com') || url.includes('science.org') || 
            url.includes('scientificamerican.com') || url.includes('sciencedaily.com') ||
            text.includes('research') || text.includes('study shows') ||
            text.includes('scientists') || text.includes('researchers') ||
            text.includes('scientific') || text.includes('experiment') ||
            text.includes('discovery') || text.includes('peer review') ||
            text.includes('journal') || text.includes('hypothesis')) {
            return 'science';
        }
        
        // Rabbit hole - interesting/unusual content
        if (url.includes('atlasobscura.com') || url.includes('mentalfloss.com') || 
            url.includes('ridiculouslyinteresting.com') ||
            text.includes('weird') || text.includes('unusual') ||
            text.includes('bizarre') || text.includes('mystery') ||
            text.includes('fascinating') || text.includes('strange') ||
            text.includes('curious') || text.includes('obscure')) {
            return 'rabbit_hole';
        }
        
        // Big Technology companies
        if (url.includes('apple.com') || url.includes('microsoft.com') || 
            url.includes('google.com') || url.includes('amazon.com') ||
            url.includes('meta.com') || url.includes('facebook.com') ||
            url.includes('twitter.com') || url.includes('x.com') ||
            url.includes('tesla.com') || url.includes('netflix.com') ||
            url.includes('techcrunch.com') || url.includes('theverge.com') ||
            url.includes('arstechnica.com') || url.includes('wired.com') ||
            url.includes('technologyreview.com') || url.includes('stackoverflow.com') ||
            text.includes('artificial intelligence') || text.includes('machine learning') ||
            text.includes('cloud computing') || text.includes('tech earnings') ||
            text.includes('startup') || text.includes('silicon valley')) {
            return 'big_technology';
        }
        
        // Local news
        if (url.includes('newsbreak.com') || url.includes('news.google.com') ||
            url.includes('smartnews.com') || url.includes('apple.com/apple-news') ||
            (text.includes('local') && text.includes('news')) ||
            text.includes('neighborhood') || text.includes('community news') ||
            text.includes('city council') || text.includes('school board')) {
            return 'local_news';
        }
        
        // Local area data (geographic, weather, etc.)
        if (text.includes('weather') || text.includes('traffic') || 
            text.includes('restaurant') || text.includes('yelp') ||
            text.includes('tripadvisor') || text.includes('city guide') ||
            text.includes('events near') || text.includes('things to do') ||
            url.includes('.gov') || text.includes('government')) {
            return 'local_area_data';
        }
        
        // E-commerce
        if (data.products?.length > 0 || text.includes('price') || 
            text.includes('buy now') || text.includes('add to cart') ||
            url.includes('shop') || url.includes('store') ||
            url.includes('amazon.com') || url.includes('ebay.com') ||
            url.includes('etsy.com') || url.includes('walmart.com')) {
            return 'ecommerce';
        }
        
        // News articles (general news)
        if (text.includes('news') || text.includes('article') || url.includes('news') ||
            text.includes('breaking') || text.includes('report') || 
            text.includes('journalist') || url.includes('reuters.com') ||
            url.includes('apnews.com') || url.includes('bbc.com/news') ||
            url.includes('wsj.com/news')) {
            return 'news';
        }
        
        // Documentation
        if (text.includes('api') || text.includes('documentation') || url.includes('docs') ||
            text.includes('tutorial') || text.includes('guide') || 
            text.includes('reference') || text.includes('developer') ||
            url.includes('developer.') || url.includes('/docs/')) {
            return 'docs';
        }
        
        // Forums and discussions
        if (text.includes('forum') || text.includes('discussion') || url.includes('forum') ||
            text.includes('reddit') || text.includes('comment') || 
            text.includes('thread') || text.includes('reply') ||
            url.includes('reddit.com') || url.includes('news.ycombinator.com')) {
            return 'forum';
        }
        
        return 'general';
    }

    // Get dynamic collection name
    async getCollectionName(category, mode) {
        const date = new Date().toISOString().slice(0, 7); // YYYY-MM
        const baseName = `${mode}_${category}_${date}`;
        
        // Check if we need to create a new collection (simple threshold)
        try {
            const count = await ScrapedData.countDocuments({ category, mode });
            if (count > WANDERER_CONFIG.CLASSIFICATION.COLLECTION_SIZE_THRESHOLD) {
                const suffix = Math.floor(count / 1000);
                return `${baseName}_${suffix}`;
            }
        } catch (error) {
            this.log('warn', 'Could not check collection size', error);
        }
        
        return baseName;
    }

    // Save scraped data to MongoDB with classification
    // Ensure indexes on url and timestamp fields (run once per app start)
    static async ensureIndexes() {
      try {
        await ScrapedData.collection.createIndex({ url: 1 });
        await ScrapedData.collection.createIndex({ timestamp: -1 });
      } catch (error) {
        console.warn('⚠️  Failed to create indexes:', error.message);
      }
    }

    // Batch insert buffer
    _batchBuffer = [];
    _batchTimer = null;
    _batchSize = 20; // Tune as needed
    _batchDelay = 1000; // ms

    async saveData(data) {
      if (!this.dbConnected) {
        // Fallback to console logging if database is not connected
        console.log('📁 Saving to local storage (DB not connected):', data.url);
        return;
      }

      try {
        // Add simple classification
        const category = this.classifyDocument(data);
        const enrichedData = {
          ...data,
          category,
          collectionHint: await this.getCollectionName(category, data.mode || this.mode)
        };

        // Batch insert logic
        this._batchBuffer.push(enrichedData);

        if (this._batchBuffer.length >= this._batchSize) {
          await this.flushBatch();
        } else if (!this._batchTimer) {
          this._batchTimer = setTimeout(() => this.flushBatch(), this._batchDelay);
        }
      } catch (error) {
        this.log('error', `Failed to queue data for MongoDB: ${data.url}`, error);
      }
    }

    async flushBatch() {
      if (!this.dbConnected || this._batchBuffer.length === 0) {
        this._batchTimer = null;
        return;
      }
      const batch = this._batchBuffer.splice(0, this._batchBuffer.length);
      this._batchTimer = null;
      try {
        await ScrapedData.insertMany(batch, { ordered: false });
        this.log('info', `💾 Batch saved to MongoDB [${batch.length} items]`);
      } catch (error) {
        this.log('error', 'Failed to batch save data to MongoDB', error);
      }
    }
    
    // Check if URL was already scraped recently
    async isUrlRecentlyScraped(url, hours = 24) {
        if (!this.dbConnected) return false;
        
        try {
            const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
            const existing = await ScrapedData.findOne({
                url: url,
                timestamp: { $gte: cutoff },
                status: 'success'
            });
            return !!existing;
        } catch (error) {
            this.log('error', 'Failed to check URL in database', error);
            return false;
        }
    }
    
    // Close database connection
    async closeDatabase() {
        if (this.dbConnected) {
            await mongoose.connection.close();
            console.log('🗄️  MongoDB connection closed');
        }
    }
}
