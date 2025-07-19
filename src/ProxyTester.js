// src/ProxyTester.js
import axios from 'axios';

export class ProxyTester {
    constructor() {
        this.testUrl = 'http://httpbin.org/ip';
        this.timeout = 10000; // 10 seconds
    }

    async testProxy(proxyUrl) {
        try {
            const startTime = Date.now();
            
            // Parse proxy URL
            const proxyConfig = this.parseProxyUrl(proxyUrl);
            
            const response = await axios.get(this.testUrl, {
                proxy: proxyConfig,
                timeout: this.timeout,
                validateStatus: (status) => status === 200
            });
            
            const responseTime = Date.now() - startTime;
            
            return {
                proxy: proxyUrl,
                status: 'working',
                responseTime,
                ip: response.data.origin,
                success: true
            };
            
        } catch (error) {
            return {
                proxy: proxyUrl,
                status: 'failed',
                error: error.message,
                success: false
            };
        }
    }

    parseProxyUrl(proxyUrl) {
        try {
            const url = new URL(proxyUrl);
            return {
                protocol: url.protocol.replace(':', ''),
                host: url.hostname,
                port: parseInt(url.port) || 8080,
                auth: url.username && url.password ? {
                    username: url.username,
                    password: url.password
                } : undefined
            };
        } catch (error) {
            throw new Error(`Invalid proxy URL: ${proxyUrl}`);
        }
    }

    async testProxies(proxies) {
        console.log(`🧪 Testing ${proxies.length} proxies...`);
        
        const results = await Promise.allSettled(
            proxies.map(proxy => this.testProxy(proxy))
        );
        
        const workingProxies = [];
        const failedProxies = [];
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const testResult = result.value;
                if (testResult.success) {
                    workingProxies.push(testResult);
                    console.log(`✅ ${testResult.proxy} - ${testResult.responseTime}ms - IP: ${testResult.ip}`);
                } else {
                    failedProxies.push(testResult);
                    console.log(`❌ ${testResult.proxy} - ${testResult.error}`);
                }
            } else {
                failedProxies.push({
                    proxy: proxies[index],
                    error: result.reason.message,
                    success: false
                });
                console.log(`❌ ${proxies[index]} - ${result.reason.message}`);
            }
        });
        
        console.log(`\n📊 Test Results:`);
        console.log(`✅ Working: ${workingProxies.length}`);
        console.log(`❌ Failed: ${failedProxies.length}`);
        console.log(`📈 Success Rate: ${((workingProxies.length / proxies.length) * 100).toFixed(1)}%`);
        
        return {
            working: workingProxies,
            failed: failedProxies,
            successRate: workingProxies.length / proxies.length
        };
    }

    // Get some free proxies for testing (use with caution)
    async getFreeProxies() {
        const freeProxies = [
            // These are examples - you'll need to find working ones
            'http://proxy1.example.com:8080',
            'http://proxy2.example.com:3128',
            'http://proxy3.example.com:80'
        ];
        
        console.log('⚠️  Using example proxies - replace with working ones');
        return freeProxies;
    }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new ProxyTester();
    
    // Test proxies from environment variables
    const basicProxies = process.env.BASIC_PROXIES?.split(',') || [];
    const premiumProxies = process.env.PREMIUM_PROXIES?.split(',') || [];
    
    if (basicProxies.length === 0 && premiumProxies.length === 0) {
        console.log('No proxies configured. Set BASIC_PROXIES or PREMIUM_PROXIES environment variables.');
        console.log('Example: export BASIC_PROXIES="http://proxy1.com:8080,http://proxy2.com:3128"');
        process.exit(1);
    }
    
    const allProxies = [...basicProxies, ...premiumProxies].filter(Boolean);
    
    tester.testProxies(allProxies).then(results => {
        if (results.working.length > 0) {
            console.log('\n🎉 Working proxies found! You can use these in your scraper.');
        } else {
            console.log('\n⚠️  No working proxies found. Check your proxy URLs and try again.');
        }
    });
}