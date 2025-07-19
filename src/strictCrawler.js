// src/strictCrawler.js
import { CheerioCrawler } from 'crawlee'
import { WANDERER_CONFIG } from './config.js'

export function createStrictCrawler(scraperManager) {
  const config = scraperManager.getConfig()

  // Build crawler options dynamically
  const crawlerOptions = {
    // Session management (v3.13 API)
    useSessionPool: scraperManager.useSessionPool,
    sessionPoolOptions: scraperManager.sessionPoolOptions,
    persistCookiesPerSession: true,

    // Conservative settings for respectful crawling
    maxRequestsPerCrawl: config.maxRequestsPerCrawl,
    maxConcurrency: config.maxConcurrency,
    requestHandlerTimeoutSecs: config.requestHandlerTimeoutSecs,
    maxRequestRetries: 2,

    // Add polite delays
    minConcurrency: 1,

    // Custom headers for each request
    preNavigationHooks: [
      (crawlingContext, gotOptions) => {
        gotOptions.headers = {
          ...gotOptions.headers,
          ...WANDERER_CONFIG.DEFAULT_HEADERS
        }

        // Add User-Agent rotation
        const userAgents = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
        ]
        gotOptions.headers['User-Agent'] =
          userAgents[Math.floor(Math.random() * userAgents.length)]
      }
    ],

    async requestHandler({ $, request, response, enqueueLinks, log, session }) {
      if (response.statusCode === 429) {
        const retryAfter = response.headers['retry-after'] || 60
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
      }
      scraperManager.log('info', `Processing: ${request.url}`)

      try {
        // Respectful delay between requests
        const delay = scraperManager.getRandomDelay()
        await new Promise((resolve) => setTimeout(resolve, delay))

        // Extract structured data with Cheerio
        const data = {
          url: request.url,
          title: $('title').text().trim(),
          description: $('meta[name="description"]').attr('content') || '',
          keywords: $('meta[name="keywords"]').attr('content') || '',

          // Content extraction
          headings: {
            h1: $('h1')
              .map((i, el) => $(el).text().trim())
              .get(),
            h2: $('h2')
              .map((i, el) => $(el).text().trim())
              .get()
              .slice(0, 10),
            h3: $('h3')
              .map((i, el) => $(el).text().trim())
              .get()
              .slice(0, 10)
          },

          // Full article content extraction
          articleContent: {
            // Try common article selectors first
            mainText: $('article, .article, .content, .post, .entry, main, .main-content, .story-body, .article-body, .post-content')
              .first()
              .text()
              .trim()
              .slice(0, 5000) || // Limit to 5000 chars
              $('body').text().trim().slice(0, 5000), // Fallback to body text
            
            // Extract paragraphs separately
            paragraphs: $('article p, .article p, .content p, .post p, .entry p, main p')
              .map((i, el) => $(el).text().trim())
              .get()
              .filter(p => p.length > 20) // Filter out short paragraphs
              .slice(0, 20), // Limit to 20 paragraphs
            
            // Extract any code blocks (for tech articles)
            codeBlocks: $('pre, code, .code, .highlight')
              .map((i, el) => $(el).text().trim())
              .get()
              .filter(code => code.length > 10)
              .slice(0, 10),
            
            // Extract images with alt text
            images: $('img')
              .map((i, el) => ({
                src: $(el).attr('src'),
                alt: $(el).attr('alt'),
                title: $(el).attr('title')
              }))
              .get()
              .slice(0, 10)
          },

          // Navigation and structure
          navigation: $('nav a, .menu a, .navigation a')
            .map((i, el) => $(el).text().trim())
            .get(),

          // Product/article specific (if applicable)
          products: $('.product, .item, .card')
            .map((i, el) => {
              const $item = $(el)
              return {
                title: $item.find('h1, h2, h3, .title, .name').first().text().trim(),
                price: $item.find('.price, .cost, .amount').first().text().trim(),
                link: $item.find('a').first().attr('href')
              }
            })
            .get()
            .slice(0, 20),

          // Metadata
          linkCount: $('a[href]').length,
          imageCount: $('img[src]').length,
          wordCount: $('body').text().split(/\s+/).length,
          timestamp: new Date().toISOString(),
          statusCode: response.statusCode,
          mode: 'strict'
        }

        // Only follow relevant, targeted links
        await enqueueLinks({
          selector: config.selectors,
          strategy: config.linkStrategy,
          transformRequestFunction: (req) => {
            // Skip restricted URLs
            if (scraperManager.shouldSkipUrl(req.url)) {
              scraperManager.log('info', `⏭️  Skipping restricted URL: ${req.url}`)
              return false
            }

            // Add tracking metadata
            req.userData = {
              ...req.userData,
              depth: (request.userData?.depth || 0) + 1,
              parentUrl: request.url,
              discoveredAt: new Date().toISOString()
            }

            // Limit crawl depth for focused scraping
            if (req.userData.depth > 3) {
              return false
            }

            return req
          }
        })

        // Store the extracted data
        await scraperManager.saveData({
          ...data,
          depth: request.userData?.depth || 0,
          parentUrl: request.userData?.parentUrl || null
        })

        if (session) session.markGood()
        scraperManager.log('info', `✅ Extracted data from: ${request.url}`, {
          products: data.products.length,
          headings: data.headings.h1.length + data.headings.h2.length
        })
      } catch (error) {
        scraperManager.log('error', `Failed to process: ${request.url}`, error)
        if (session) session.markBad()
        throw error
      }
    },

    async failedRequestHandler({ request, log, session }) {
      scraperManager.log('error', `❌ Failed after retries: ${request.url}`)

      // Store failure data for analysis
      await scraperManager.saveData({
        url: request.url,
        mode: 'strict',
        status: 'failed',
        errorMessages: request.errorMessages,
        retryCount: request.retryCount,
        timestamp: new Date().toISOString()
      })

      if (session) session.markBad()
    },

    async errorHandler({ error, request, log }) {
      scraperManager.log('error', `💥 Error processing: ${request?.url}`, error)
    }
  }

  // Only add proxy configuration if we have one
  if (scraperManager.proxyConfig) {
    crawlerOptions.proxyConfiguration = scraperManager.proxyConfig
  }

  return new CheerioCrawler(crawlerOptions)
}
