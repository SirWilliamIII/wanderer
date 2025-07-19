// Test script for the Cloudflare Worker CORS proxy
import axios from 'axios';
import { WANDERER_CONFIG } from './src/config.js';

console.log('🔍 Testing Cloudflare Worker CORS Proxy...\n');

// Check configuration
console.log('Configuration:');
console.log(`- Proxy Enabled: ${WANDERER_CONFIG.CORS_PROXY.enabled}`);
console.log(`- Proxy URL: ${WANDERER_CONFIG.CORS_PROXY.url}\n`);

// Test 1: Direct proxy test
async function testDirectProxy() {
    console.log('Test 1: Direct proxy request...');
    try {
        const testUrl = 'https://api.github.com/users/github';
        const proxyUrl = `${WANDERER_CONFIG.CORS_PROXY.url}/?url=${encodeURIComponent(testUrl)}`;
        
        const response = await axios.get(proxyUrl, { timeout: 10000 });
        console.log('✅ Direct proxy test PASSED');
        console.log(`   Status: ${response.status}`);
        console.log(`   Data received: ${JSON.stringify(response.data).substring(0, 100)}...`);
        return true;
    } catch (error) {
        console.log('❌ Direct proxy test FAILED');
        console.log(`   Error: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Response: ${error.response.data}`);
        }
        return false;
    }
}

// Test 2: Test with multiple APIs
async function testMultipleAPIs() {
    console.log('\nTest 2: Testing multiple APIs through proxy...');
    
    const testCases = [
        {
            name: 'Hacker News API',
            url: 'https://hacker-news.firebaseio.com/v0/topstories.json'
        },
        {
            name: 'CoinGecko API',
            url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
        },
        {
            name: 'GitHub API',
            url: 'https://api.github.com/search/repositories?q=javascript&sort=stars&per_page=1'
        }
    ];

    let passCount = 0;
    
    for (const test of testCases) {
        try {
            const proxyUrl = `${WANDERER_CONFIG.CORS_PROXY.url}/?url=${encodeURIComponent(test.url)}`;
            const response = await axios.get(proxyUrl, { timeout: 10000 });
            console.log(`✅ ${test.name}: PASSED (Status: ${response.status})`);
            passCount++;
        } catch (error) {
            console.log(`❌ ${test.name}: FAILED (${error.message})`);
        }
    }
    
    return passCount === testCases.length;
}

// Test 3: CORS headers check
async function testCORSHeaders() {
    console.log('\nTest 3: Checking CORS headers...');
    try {
        const testUrl = 'https://api.github.com/';
        const proxyUrl = `${WANDERER_CONFIG.CORS_PROXY.url}/?url=${encodeURIComponent(testUrl)}`;
        
        const response = await axios.get(proxyUrl, { timeout: 10000 });
        const headers = response.headers;
        
        console.log('Response headers:');
        const corsHeaders = [
            'access-control-allow-origin',
            'access-control-allow-methods',
            'access-control-allow-headers'
        ];
        
        let hasAllHeaders = true;
        corsHeaders.forEach(header => {
            const value = headers[header];
            if (value) {
                console.log(`✅ ${header}: ${value}`);
            } else {
                console.log(`❌ ${header}: Missing`);
                hasAllHeaders = false;
            }
        });
        
        return hasAllHeaders;
    } catch (error) {
        console.log('❌ CORS headers test FAILED');
        console.log(`   Error: ${error.message}`);
        return false;
    }
}

// Run all tests
async function runTests() {
    if (!WANDERER_CONFIG.CORS_PROXY.enabled) {
        console.log('⚠️  CORS Proxy is DISABLED in configuration!');
        console.log('   Set USE_CORS_PROXY=true in your .env file to enable it.\n');
        return;
    }

    const test1 = await testDirectProxy();
    const test2 = await testMultipleAPIs();
    const test3 = await testCORSHeaders();
    
    console.log('\n📊 Test Summary:');
    console.log(`- Direct proxy test: ${test1 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`- Multiple APIs test: ${test2 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`- CORS headers test: ${test3 ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (test1 && test2 && test3) {
        console.log('\n🎉 Your Cloudflare Worker is working perfectly!');
    } else {
        console.log('\n⚠️  Some tests failed. Please check:');
        console.log('1. Is the worker deployed? Run: cd wanderer-proxy && npx wrangler deploy');
        console.log('2. Is the URL correct in your .env file?');
        console.log('3. Check the worker logs: cd wanderer-proxy && npx wrangler tail');
    }
}

// Run the tests
runTests().catch(console.error);
