// src/ProxyFetcher.js
import axios from 'axios';

export class ProxyFetcher {
    constructor() {
        this.timeout = 5000;
    }

    // Get free proxies from public APIs
    async getFreeProxies() {
        const sources = [
            this.getProxyScrapeProxies(),
            this.getProxyListProxies(),
            this.getFreeProxyListProxies()
        ];

        const results = await Promise.allSettled(sources);
        const allProxies = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                allProxies.push(...result.value);
                console.log(`✅ Source ${index + 1}: ${result.value.length} proxies`);
            } else {
                console.log(`❌ Source ${index + 1}: ${result.reason.message}`);
            }
        });

        // Remove duplicates
        const uniqueProxies = [...new Set(allProxies)];
        console.log(`📊 Total unique proxies found: ${uniqueProxies.length}`);
        
        return uniqueProxies;
    }

    // ProxyScrape.com API
    async getProxyScrapeProxies() {
        try {
            const response = await axios.get('https://api.proxyscrape.com/v2/', {
                params: {
                    request: 'getproxies',
                    format: 'textplain',
                    protocol: 'http',
                    timeout: 10000,
                    country: 'all',
                    ssl: 'no',
                    anonymity: 'all'
                },
                timeout: this.timeout
            });

            return response.data
                .split('\n')
                .filter(line => line.trim())
                .map(line => `http://${line.trim()}`);
        } catch (error) {
            throw new Error(`ProxyScrape API failed: ${error.message}`);
        }
    }

    // ProxyList.geonode.com API
    async getProxyListProxies() {
        try {
            const response = await axios.get('https://proxylist.geonode.com/api/proxy-list', {
                params: {
                    limit: 100,
                    page: 1,
                    sort_by: 'lastChecked',
                    sort_type: 'desc',
                    protocols: 'http,https'
                },
                timeout: this.timeout
            });

            return response.data.data
                .filter(proxy => proxy.protocols.includes('http'))
                .map(proxy => `http://${proxy.ip}:${proxy.port}`);
        } catch (error) {
            throw new Error(`ProxyList API failed: ${error.message}`);
        }
    }

    // FreeProxyList.net (web scraping)
    async getFreeProxyListProxies() {
        try {
            // This would require web scraping, which is more complex
            // For now, return empty array
            console.log('⚠️  FreeProxyList.net requires web scraping - skipping');
            return [];
        } catch (error) {
            throw new Error(`FreeProxyList scraping failed: ${error.message}`);
        }
    }

    // Test and filter working proxies
    async getWorkingProxies(maxProxies = 10) {
        console.log('🔍 Fetching free proxies...');
        const proxies = await this.getFreeProxies();
        
        if (proxies.length === 0) {
            console.log('❌ No proxies found from free sources');
            return [];
        }

        console.log(`🧪 Testing ${Math.min(proxies.length, maxProxies)} proxies...`);
        
        // Import ProxyTester
        const { ProxyTester } = await import('./ProxyTester.js');
        const tester = new ProxyTester();
        
        // Test a subset of proxies
        const testProxies = proxies.slice(0, maxProxies);
        const results = await tester.testProxies(testProxies);
        
        return results.working.map(result => result.proxy);
    }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const fetcher = new ProxyFetcher();
    
    fetcher.getWorkingProxies(20).then(workingProxies => {
        if (workingProxies.length > 0) {
            console.log('\n🎉 Working proxies found:');
            workingProxies.forEach(proxy => console.log(`  ${proxy}`));
            
            console.log('\n💡 To use these proxies:');
            console.log(`export BASIC_PROXIES="${workingProxies.join(',')}"`);
            console.log('npm run strict');
        } else {
            console.log('\n⚠️  No working free proxies found.');
            console.log('Consider using premium proxy services for better reliability.');
        }
    }).catch(error => {
        console.error('❌ Error:', error.message);
    });
}