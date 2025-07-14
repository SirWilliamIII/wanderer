// src/encryption.js - Data Security & Encryption
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export class SecureStorage {
    constructor(encryptionKey = null) {
        // Use provided key or generate from environment
        this.encryptionKey = encryptionKey || this.generateEncryptionKey();
        this.algorithm = 'aes-256-gcm';
        this.ivLength = 16;
        this.tagLength = 16;
    }

    generateEncryptionKey() {
        // Try to get key from environment first
        if (process.env.WANDERER_ENCRYPTION_KEY) {
            return Buffer.from(process.env.WANDERER_ENCRYPTION_KEY, 'hex');
        }
        
        // Generate new key and save to .env file
        const key = crypto.randomBytes(32);
        console.log('🔐 Generated new encryption key. Add to .env:');
        console.log(`WANDERER_ENCRYPTION_KEY=[YOUR_KEY_HERE]`);
        // Security: Don't log the actual key
        return key;
    }

    // Encrypt sensitive data before storage
    encrypt(data) {
        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const tag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            tag: tag.toString('hex'),
            timestamp: new Date().toISOString()
        };
    }

    // Decrypt data when reading
    decrypt(encryptedData) {
        const { encrypted, iv, tag } = encryptedData;
        
        const decipher = crypto.createDecipheriv(
            this.algorithm, 
            this.encryptionKey, 
            Buffer.from(iv, 'hex')
        );
        
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }

    // Hash sensitive URLs/data for logging
    hashData(data, salt = '') {
        return crypto
            .createHash('sha256')
            .update(data + salt)
            .digest('hex')
            .substring(0, 12); // Short hash for logs
    }

    // Secure file storage
    async saveEncrypted(filePath, data) {
        const encryptedData = this.encrypt(data);
        const dir = path.dirname(filePath);
        
        // Ensure directory exists
        await fs.mkdir(dir, { recursive: true });
        
        // Write encrypted file
        await fs.writeFile(
            filePath + '.enc', 
            JSON.stringify(encryptedData, null, 2)
        );
        
        return filePath + '.enc';
    }

    // Secure file reading
    async loadEncrypted(filePath) {
        const encryptedData = JSON.parse(
            await fs.readFile(filePath + '.enc', 'utf8')
        );
        
        return this.decrypt(encryptedData);
    }
}

// Anonymized logging utilities
export class AnonymizedLogger {
    constructor(secureStorage) {
        this.storage = secureStorage;
        this.urlHashCache = new Map();
    }

    // Log URLs anonymously
    logUrl(url, level = 'info') {
        if (!this.urlHashCache.has(url)) {
            this.urlHashCache.set(url, this.storage.hashData(url));
        }
        
        const hashedUrl = this.urlHashCache.get(url);
        const domain = new URL(url).hostname;
        
        console[level](`🔗 Processing: ${domain}/...${hashedUrl}`);
    }

    // Log with encrypted context
    logWithContext(message, sensitiveData = {}) {
        const publicData = { ...sensitiveData };
        delete publicData.cookies;
        delete publicData.tokens;
        delete publicData.passwords;
        
        console.info(message, publicData);
        
        // Store sensitive data encrypted separately if needed
        if (Object.keys(sensitiveData).length > Object.keys(publicData).length) {
            const contextHash = this.storage.hashData(JSON.stringify(sensitiveData));
            console.debug(`🔐 Sensitive context: ${contextHash}`);
        }
    }
}

// Network anonymization
export class NetworkAnonymizer {
    constructor() {
        this.proxyRotationIndex = 0;
    }

    // Generate realistic request intervals
    getAnonymousDelay() {
        // Mimic human behavior - longer delays during "work hours"
        const hour = new Date().getHours();
        const isWorkHours = hour >= 9 && hour <= 17;
        
        const baseDelay = isWorkHours ? 3000 : 1500;
        const variance = 0.4; // 40% variation
        
        return Math.floor(
            baseDelay * (1 + (Math.random() - 0.5) * variance)
        );
    }

    // Rotate through multiple proxy sources
    async getNextProxy(proxySources = []) {
        if (proxySources.length === 0) return null;
        
        const proxy = proxySources[this.proxyRotationIndex % proxySources.length];
        this.proxyRotationIndex++;
        
        return proxy;
    }

    // Generate anonymized headers with realistic variations
    generateAnonymousHeaders(baseHeaders = {}) {
        const variations = {
            'Accept-Language': [
                'en-US,en;q=0.9',
                'en-GB,en;q=0.8,fr;q=0.6',
                'en-CA,en;q=0.9,fr;q=0.8'
            ],
            'Accept-Encoding': [
                'gzip, deflate, br',
                'gzip, deflate',
                'gzip, deflate, br, zstd'
            ]
        };
        
        const anonymizedHeaders = { ...baseHeaders };
        
        // Randomly vary some headers
        Object.keys(variations).forEach(header => {
            if (Math.random() > 0.7) { // 30% chance to vary
                const options = variations[header];
                anonymizedHeaders[header] = options[
                    Math.floor(Math.random() * options.length)
                ];
            }
        });
        
        return anonymizedHeaders;
    }
}

// Data sanitization before storage
export class DataSanitizer {
    constructor() {
        this.sensitivePatterns = [
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
            /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,           // credit cards
            /\b\d{3}-\d{2}-\d{4}\b/g,                               // SSNs
            /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g // phones
        ];
    }

    // Remove/mask sensitive data from scraped content
    sanitizeData(data) {
        if (typeof data === 'string') {
            return this.sanitizeText(data);
        }
        
        if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                sanitized[key] = this.sanitizeData(value);
            }
            return sanitized;
        }
        
        return data;
    }

    sanitizeText(text) {
        let sanitized = text;
        
        this.sensitivePatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        });
        
        return sanitized;
    }

    // Remove metadata that could identify the scraper
    removeFingerprints(data) {
        const cleaned = { ...data };
        
        // Remove potentially identifying metadata
        delete cleaned.userAgent;
        delete cleaned.clientIP;
        delete cleaned.sessionId;
        delete cleaned.crawlerVersion;
        
        // Add noise to timing data
        if (cleaned.timestamp) {
            const original = new Date(cleaned.timestamp);
            const noise = Math.floor(Math.random() * 60000); // ±30 seconds
            cleaned.timestamp = new Date(original.getTime() + noise).toISOString();
        }
        
        return cleaned;
    }
}

