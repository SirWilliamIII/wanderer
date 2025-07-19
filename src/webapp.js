// src/webapp.js - Main web application with news feed and admin portal
import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import { WebSocketServer } from "ws";
import { readFileSync, existsSync, watchFile } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import { ScrapedData } from "./models.js";
import { WANDERER_CONFIG } from "./config.js";
import { externalDataService } from "./externalData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
let dbConnected = false;
async function connectDB() {
  try {
    await mongoose.connect(
      WANDERER_CONFIG.DATABASE.url,
      WANDERER_CONFIG.DATABASE.options
    );
    dbConnected = true;
    console.log("🗄️  MongoDB connected for web app");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    dbConnected = false;
  }
}

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

// API Routes

// Get recent news articles
app.get("/api/news", async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({ articles: [], message: "Database not connected" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;
    const skip = (page - 1) * limit;

    let query = { status: "success" };
    if (category && category !== "all") {
      query.category = category;
    }

    const articles = await ScrapedData.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .select("url title description headings timestamp category mode")
      .lean();

    const total = await ScrapedData.countDocuments(query);

    res.json({
      articles: articles.map((article) => ({
        id: article._id,
        title: article.title || "Untitled",
        description: article.description || "No description available",
        url: article.url,
        timestamp: article.timestamp,
        category: article.category,
        mode: article.mode,
        headline: article.headings?.h1?.[0] || article.title,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enhanced search with intelligent query detection
app.get("/api/search", async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({ articles: [], message: "Database not connected" });
    }

    const query = req.query.q;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!query) {
      return res.json({ articles: [], message: "No search query provided" });
    }

    // Detect query intent and provide intelligent responses
    const queryIntent = detectQueryIntent(query);

    if (queryIntent.type === "weather") {
      // Handle weather queries
      try {
        let { lat, lon } = req.query;

        // If location is specified in query, try to get coordinates
        if (queryIntent.location) {
          const locationCoords = await getLocationCoordinates(
            queryIntent.location
          );
          if (locationCoords) {
            lat = locationCoords.lat;
            lon = locationCoords.lon;
          }
        }

        const weatherData = await externalDataService.getWeather(
          lat || 40.7128,
          lon || -74.006
        );

        return res.json({
          articles: [
            {
              id: "weather-result",
              title: `Current Weather: ${weatherData.temperature}°C`,
              description: `${weatherData.description} in ${weatherData.location}. Humidity: ${weatherData.humidity}%, Wind: ${weatherData.windSpeed} m/s`,
              url: "#weather",
              timestamp: new Date().toISOString(),
              category: "weather",
              mode: "external",
              headline: `Weather in ${weatherData.location}`,
              isWeatherResult: true,
              weatherData: weatherData,
            },
          ],
          pagination: { page: 1, limit: 1, total: 1, pages: 1 },
          query,
          queryType: "weather",
          message: "Weather information retrieved",
        });
      } catch (error) {
        console.error("Weather API error:", error);
        // Fall through to regular search
      }
    } else if (queryIntent.type === "crypto") {
      // Handle crypto queries
      try {
        const cryptoData = await externalDataService.getCryptoPrices();

        return res.json({
          articles: cryptoData.map((crypto) => ({
            id: `crypto-${crypto.id}`,
            title: `${crypto.name}: $${
              crypto.price ? crypto.price.toFixed(2) : "--"
            }`,
            description: `24h change: ${
              crypto.change24h ? crypto.change24h.toFixed(2) : "0.00"
            }%`,
            url: "#crypto",
            timestamp: new Date().toISOString(),
            category: "crypto",
            mode: "external",
            headline: `${crypto.name} Price`,
            isCryptoResult: true,
            cryptoData: crypto,
          })),
          pagination: {
            page: 1,
            limit: cryptoData.length,
            total: cryptoData.length,
            pages: 1,
          },
          query,
          queryType: "crypto",
          message: "Cryptocurrency prices retrieved",
        });
      } catch (error) {
        console.error("Crypto API error:", error);
        // Fall through to regular search
      }
    } else if (queryIntent.type === "news") {
      // Handle news queries
      try {
        const newsData = await externalDataService.getBreakingNews();

        return res.json({
          articles: newsData.slice(0, limit).map((article) => ({
            id: `news-${Date.now()}-${Math.random()}`,
            title: article.title,
            description: article.description,
            url: article.url,
            timestamp: article.publishedAt,
            category: "news",
            mode: "external",
            headline: article.title,
            isNewsResult: true,
            source: article.source,
            image: article.image,
          })),
          pagination: {
            page: 1,
            limit: limit,
            total: newsData.length,
            pages: 1,
          },
          query,
          queryType: "news",
          message: "Breaking news retrieved",
        });
      } catch (error) {
        console.error("News API error:", error);
        // Fall through to regular search
      }
    } else if (queryIntent.type === "tech") {
      // Handle tech queries
      try {
        const techData = await externalDataService.getTechNews();

        return res.json({
          articles: techData.slice(0, limit).map((article) => ({
            id: `tech-${Date.now()}-${Math.random()}`,
            title: article.title,
            description: article.description,
            url: article.url,
            timestamp: article.publishedAt,
            category: "tech",
            mode: "external",
            headline: article.title,
            isTechResult: true,
            source: article.source,
            image: article.image,
          })),
          pagination: {
            page: 1,
            limit: limit,
            total: techData.length,
            pages: 1,
          },
          query,
          queryType: "tech",
          message: "Tech news retrieved",
        });
      } catch (error) {
        console.error("Tech API error:", error);
        // Fall through to regular search
      }
    } else if (queryIntent.type === "product") {
      // Handle product queries
      try {
        const productInfo = await handleProductQuery(
          queryIntent.product || query
        );

        return res.json({
          articles: [
            {
              id: "product-result",
              title: productInfo.title,
              description: productInfo.description,
              url: productInfo.url || "#product",
              timestamp: new Date().toISOString(),
              category: "product",
              mode: "external",
              headline: productInfo.title,
              isProductResult: true,
              productData: productInfo,
            },
          ],
          pagination: { page: 1, limit: 1, total: 1, pages: 1 },
          query,
          queryType: "product",
          message: "Product information retrieved",
        });
      } catch (error) {
        console.error("Product API error:", error);
        // Fall through to regular search
      }
    } else if (queryIntent.type === "knowledge") {
      // Handle knowledge queries by searching real-time web sources
      try {
        const newsData = await externalDataService.getWorldHeadlines();
        const techData = await externalDataService.getBigTechNews();

        // Search through real-time data for relevant information
        const allData = [...newsData, ...techData];
        const relevantData = allData.filter(
          (item) =>
            item.title
              .toLowerCase()
              .includes(queryIntent.question.toLowerCase()) ||
            item.description
              .toLowerCase()
              .includes(queryIntent.question.toLowerCase())
        );

        if (relevantData.length > 0) {
          return res.json({
            articles: relevantData.slice(0, 5).map((item) => ({
              id: `knowledge-${Date.now()}-${Math.random()}`,
              title: item.title,
              description: item.description,
              url: item.url,
              timestamp: item.publishedAt,
              category: "knowledge",
              mode: "external",
              headline: item.title,
              isKnowledgeResult: true,
              source: item.source,
            })),
            pagination: {
              page: 1,
              limit: relevantData.length,
              total: relevantData.length,
              pages: 1,
            },
            query,
            queryType: "knowledge",
            message: "Real-time information retrieved",
          });
        } else {
          // Fall through to regular search
        }
      } catch (error) {
        console.error("Knowledge API error:", error);
        // Fall through to regular search
      }
    }

    // Default: Search scraped content
    const searchQuery = {
      status: "success",
      $or: [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { text: { $regex: query, $options: "i" } },
        { url: { $regex: query, $options: "i" } },
      ],
    };

    const articles = await ScrapedData.find(searchQuery)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .select("url title description headings timestamp category mode")
      .lean();

    const total = await ScrapedData.countDocuments(searchQuery);

    res.json({
      articles: articles.map((article) => ({
        id: article._id,
        title: article.title || "Untitled",
        description: article.description || "No description available",
        url: article.url,
        timestamp: article.timestamp,
        category: article.category,
        mode: article.mode,
        headline: article.headings?.h1?.[0] || article.title,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      query,
      queryType: "search",
      message:
        total > 0
          ? `Found ${total} results`
          : "No results found in scraped content",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Query intent detection function
function detectQueryIntent(query) {
  const lowerQuery = query.toLowerCase().trim();

  // Weather patterns (including location-specific)
  const weatherPatterns = [
    /what.*weather/i,
    /weather.*like/i,
    /weather.*today/i,
    /weather.*now/i,
    /how.*weather/i,
    /current.*weather/i,
    /weather.*outside/i,
    /weather.*forecast/i,
    /temperature.*now/i,
    /^weather$/i,
    /weather.*in.*\w+/i, // weather in [city]
    /\w+.*weather/i, // [city] weather
  ];

  // Crypto patterns
  const cryptoPatterns = [
    /bitcoin.*price/i,
    /crypto.*price/i,
    /ethereum.*price/i,
    /btc.*price/i,
    /eth.*price/i,
    /cryptocurrency/i,
    /crypto.*market/i,
    /bitcoin.*value/i,
    /^bitcoin$/i,
    /^crypto$/i,
    /^btc$/i,
    /^eth$/i,
  ];

  // News patterns
  const newsPatterns = [
    /breaking.*news/i,
    /latest.*news/i,
    /current.*news/i,
    /news.*today/i,
    /what.*happening/i,
    /recent.*news/i,
    /^news$/i,
    /world.*news/i,
    /headline/i,
  ];

  // Tech patterns
  const techPatterns = [
    /tech.*news/i,
    /technology.*news/i,
    /latest.*tech/i,
    /tech.*update/i,
    /programming.*news/i,
    /software.*news/i,
    /github.*trending/i,
    /developer.*news/i,
    /^tech$/i,
    /startup.*news/i,
  ];

  // Product search patterns
  const productPatterns = [
    /cheapest.*\w+/i,
    /where.*buy.*\w+/i,
    /best.*price.*\w+/i,
    /airpods.*price/i,
    /price.*of.*\w+/i,
    /where.*find.*\w+/i,
    /\w+.*for.*sale/i,
    /buy.*\w+.*online/i,
  ];

  // General knowledge patterns
  const knowledgePatterns = [
    /what.*capital.*of/i,
    /capital.*of.*\w+/i,
    /who.*president/i,
    /current.*president/i,
    /president.*of.*\w+/i,
    /who.*prime.*minister/i,
    /what.*population.*of/i,
    /how.*many.*people.*in/i,
    /when.*founded/i,
    /what.*currency.*of/i,
    /what.*language.*spoken.*in/i,
    /what.*time.*zone.*in/i,
    /what.*is.*\w+/i,
    /who.*is.*\w+/i,
    /where.*is.*\w+/i,
    /how.*big.*is.*\w+/i,
    /definition.*of.*\w+/i,
    /meaning.*of.*\w+/i,
  ];

  // Check patterns
  if (weatherPatterns.some((pattern) => pattern.test(lowerQuery))) {
    return {
      type: "weather",
      confidence: 0.9,
      location: extractLocation(lowerQuery),
    };
  }

  if (cryptoPatterns.some((pattern) => pattern.test(lowerQuery))) {
    return { type: "crypto", confidence: 0.9 };
  }

  if (newsPatterns.some((pattern) => pattern.test(lowerQuery))) {
    return { type: "news", confidence: 0.8 };
  }

  if (techPatterns.some((pattern) => pattern.test(lowerQuery))) {
    return { type: "tech", confidence: 0.8 };
  }

  if (productPatterns.some((pattern) => pattern.test(lowerQuery))) {
    return {
      type: "product",
      confidence: 0.7,
      product: extractProduct(lowerQuery),
    };
  }

  if (knowledgePatterns.some((pattern) => pattern.test(lowerQuery))) {
    return { type: "knowledge", confidence: 0.6, question: lowerQuery };
  }

  return { type: "search", confidence: 0.5 };
}

// Extract location from weather query
function extractLocation(query) {
  const locationPatterns = [
    /weather.*in\s+(\w+)/i,
    /(\w+)\s+weather/i,
    /weather.*(\w+)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Extract product from product query
function extractProduct(query) {
  const productPatterns = [
    /cheapest\s+(\w+)/i,
    /price.*of\s+(\w+)/i,
    /buy\s+(\w+)/i,
    /(\w+)\s+price/i,
    /(\w+)\s+for\s+sale/i,
  ];

  for (const pattern of productPatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Get coordinates for a location using OpenWeatherMap Geocoding API
async function getLocationCoordinates(location) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.error("OpenWeatherMap API key not configured");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        location
      )}&limit=1&appid=${apiKey}`
    );
    const data = await response.json();

    if (data.length > 0) {
      return {
        lat: data[0].lat,
        lon: data[0].lon,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching location coordinates:", error);
    return null;
  }
}

// Handle product queries using real product search
async function handleProductQuery(product) {
  try {
    // Try to find product information from our scraped data first
    if (dbConnected) {
      const productResults = await ScrapedData.find({
        status: "success",
        $or: [
          { title: { $regex: product, $options: "i" } },
          { description: { $regex: product, $options: "i" } },
          { "products.title": { $regex: product, $options: "i" } },
        ],
      })
        .sort({ timestamp: -1 })
        .limit(5)
        .select("url title description products timestamp")
        .lean();

      if (productResults.length > 0) {
        const relevantProducts = [];

        productResults.forEach((result) => {
          if (result.products && result.products.length > 0) {
            result.products.forEach((p) => {
              if (
                p.title &&
                p.title.toLowerCase().includes(product.toLowerCase())
              ) {
                relevantProducts.push({
                  title: p.title,
                  price: p.price,
                  link: p.link,
                  source: result.url,
                });
              }
            });
          }
        });

        if (relevantProducts.length > 0) {
          const topProduct = relevantProducts[0];
          return {
            title: `${product} - Found Products`,
            description: `Found ${
              relevantProducts.length
            } products matching "${product}". Top result: ${topProduct.title} ${
              topProduct.price ? `- ${topProduct.price}` : ""
            }`,
            url: topProduct.link || topProduct.source,
            suggestions: [
              "Check other search results",
              "Compare prices across retailers",
              "Look for customer reviews",
            ],
            products: relevantProducts.slice(0, 3),
          };
        }
      }
    }

    // If no products found in database, provide search suggestions
    const searchUrls = [
      `https://www.amazon.com/s?k=${encodeURIComponent(product)}`,
      `https://www.google.com/search?q=${encodeURIComponent(
        product
      )}+price+buy`,
      `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(
        product
      )}`,
      `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(product)}`,
    ];

    return {
      title: `${product} - Search Results`,
      description: `No specific pricing information found for "${product}" in our scraped data. Try searching these popular retailers for current prices and availability.`,
      url: searchUrls[0],
      suggestions: [
        "Check Amazon for deals",
        "Compare prices on Google Shopping",
        "Look for seasonal sales",
        "Check Best Buy for electronics",
        "Search eBay for used/refurbished options",
      ],
      searchUrls: searchUrls,
    };
  } catch (error) {
    console.error("Error handling product query:", error);
    return {
      title: `${product} - Search Error`,
      description: `Unable to search for "${product}" at this time. Please try again later or search manually.`,
      url: `https://www.google.com/search?q=${encodeURIComponent(
        product
      )}+price`,
      suggestions: [
        "Try searching Google",
        "Check Amazon",
        "Visit manufacturer website",
      ],
    };
  }
}

// Get categories
app.get("/api/categories", async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({ categories: ["general"] });
    }

    const categories = await ScrapedData.distinct("category");
    res.json({ categories: categories.filter(Boolean) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user location from IP
app.get("/api/location", async (req, res) => {
  try {
    // Allow testing with a specific IP via query parameter
    const testIP = req.query.ip;
    
    // Get client IP address
    let clientIP = testIP || req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                     req.ip;

    // Clean up IP address (remove IPv6 prefix if present)
    let cleanIP = clientIP ? clientIP.replace(/^::ffff:/, '') : null;
    
    // For localhost/development, use a default IP for location lookup (unless testing with specific IP)
    if (!testIP && (!cleanIP || cleanIP === '127.0.0.1' || cleanIP === '::1' || cleanIP.startsWith('192.168.') || cleanIP.startsWith('10.') || cleanIP.startsWith('172.'))) {
      // Use 104.28.194.8 as default IP for localhost development
      cleanIP = '104.28.194.8';
    }

    // Use ipinfo.io to get location data
    const response = await fetch(`https://ipinfo.io/${cleanIP}/json`);
    const locationData = await response.json();
    
    if (locationData.loc) {
      const [lat, lon] = locationData.loc.split(',').map(Number);
      res.json({
        ...locationData,
        lat,
        lon,
        isDefault: false
      });
    } else {
      // Fallback to default location
      res.json({
        ip: cleanIP,
        city: "New York",
        region: "New York",
        country: "US", 
        loc: "40.7128,-74.0060",
        timezone: "America/New_York",
        lat: 40.7128,
        lon: -74.0060,
        isDefault: true
      });
    }
  } catch (error) {
    console.error('Error getting location:', error);
    // Fallback to default location on error
    res.json({
      city: "New York",
      region: "New York",
      country: "US",
      loc: "40.7128,-74.0060", 
      timezone: "America/New_York",
      lat: 40.7128,
      lon: -74.0060,
      isDefault: true,
      error: "Could not determine location"
    });
  }
});

// External data endpoints
app.get("/api/weather", async (req, res) => {
  try {
    let { lat, lon } = req.query;
    
    // If no coordinates provided, try to get user's location from IP
    if (!lat || !lon) {
      try {
        const clientIP = req.headers['x-forwarded-for'] || 
                         req.headers['x-real-ip'] || 
                         req.connection.remoteAddress || 
                         req.socket.remoteAddress ||
                         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                         req.ip;

        const cleanIP = clientIP ? clientIP.replace(/^::ffff:/, '') : null;
        
        if (cleanIP && !['127.0.0.1', '::1'].includes(cleanIP) && !cleanIP.startsWith('192.168.') && !cleanIP.startsWith('10.') && !cleanIP.startsWith('172.')) {
          const locationResponse = await fetch(`https://ipinfo.io/${cleanIP}/json`);
          const locationData = await locationResponse.json();
          
          if (locationData.loc) {
            [lat, lon] = locationData.loc.split(',').map(Number);
          }
        }
      } catch (error) {
        console.error('Error getting location for weather:', error);
      }
    }
    
    const weather = await externalDataService.getWeather(
      lat || 40.7128,
      lon || -74.006
    ); // Default to NYC if no location found
    res.json(weather);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/major-events", async (req, res) => {
  try {
    const events = await externalDataService.getMajorEvents();
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/tech-news", async (req, res) => {
  try {
    const news = await externalDataService.getTechNews();
    res.json({ news });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/trending-tech", async (req, res) => {
  try {
    const trending = await externalDataService.getTrendingTech();
    res.json({ trending });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/trending-repos", async (req, res) => {
  try {
    const repos = await externalDataService.getTrendingRepos();
    res.json({ repos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/crypto", async (req, res) => {
  try {
    const crypto = await externalDataService.getCryptoPrices();
    res.json({ crypto });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/market", async (req, res) => {
  try {
    const market = await externalDataService.getMarketData();
    res.json(market);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/sports-news", async (req, res) => {
  try {
    const sports = await externalDataService.getSportsNews();
    res.json({ sports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/world-headlines", async (req, res) => {
  try {
    const headlines = await externalDataService.getWorldHeadlines();
    res.json({ headlines });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/big-tech", async (req, res) => {
  try {
    const bigTech = await externalDataService.getBigTechNews();
    res.json({ bigTech });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/local-area", async (req, res) => {
  try {
    let { lat, lon } = req.query;
    
    // If no coordinates provided, try to get user's location from IP
    if (!lat || !lon) {
      try {
        const clientIP = req.headers['x-forwarded-for'] || 
                         req.headers['x-real-ip'] || 
                         req.connection.remoteAddress || 
                         req.socket.remoteAddress ||
                         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                         req.ip;

        const cleanIP = clientIP ? clientIP.replace(/^::ffff:/, '') : null;
        
        if (cleanIP && !['127.0.0.1', '::1'].includes(cleanIP) && !cleanIP.startsWith('192.168.') && !cleanIP.startsWith('10.') && !cleanIP.startsWith('172.')) {
          const locationResponse = await fetch(`https://ipinfo.io/${cleanIP}/json`);
          const locationData = await locationResponse.json();
          
          if (locationData.loc) {
            [lat, lon] = locationData.loc.split(',').map(Number);
          }
        }
      } catch (error) {
        console.error('Error getting location for local data:', error);
      }
    }
    
    const localData = await externalDataService.getLocalAreaData(lat, lon);
    res.json({ localData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/breaking-news", async (req, res) => {
  try {
    const breaking = await externalDataService.getBreakingNews();
    res.json({ breaking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin API - Get scraper stats
app.get("/api/admin/stats", async (req, res) => {
  try {
    const stats = await getScraperStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Main UI - Enhanced Dashboard
app.get("/", (req, res) => {
  const dashboardPath = join(__dirname, "templates", "dashboard.html");
  res.sendFile(dashboardPath);
});

// Admin Portal
app.get("/admin", (req, res) => {
  res.send(getAdminDashboard());
});

// Fetch full article content (user-requested)
app.post("/api/fetch-article", async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Basic URL validation
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // Check for common blocked patterns
    const blockedDomains = ['facebook.com', 'twitter.com', 'instagram.com'];
    if (blockedDomains.some(domain => parsedUrl.hostname.includes(domain))) {
      return res.status(403).json({ error: "Social media platforms are not supported" });
    }

    console.log(`User-requested article fetch for: ${url}`);

    // Fetch the article
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WandererBot/1.0; +https://github.com/wanderer)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Simple content extraction (basic HTML parsing)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    // Try to extract main content (basic approach)
    let content = '';
    
    // Remove script and style tags
    let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                       .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                       .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
                       .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
                       .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
                       .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

    // Try common article selectors
    const articleSelectors = [
      'article',
      '.article-content',
      '.entry-content', 
      '.post-content',
      '.content',
      'main',
      '.story-body',
      '.article-body'
    ];

    let articleContent = '';
    for (const selector of articleSelectors) {
      const regex = new RegExp(`<[^>]*class[^>]*${selector.replace('.', '')}[^>]*>([\\s\\S]*?)</[^>]*>`, 'i');
      const match = cleanHtml.match(regex);
      if (match && match[1].length > articleContent.length) {
        articleContent = match[1];
      }
    }

    // If no article content found, try to extract paragraphs
    if (!articleContent) {
      const paragraphs = cleanHtml.match(/<p[^>]*>([^<]+)<\/p>/gi);
      if (paragraphs && paragraphs.length > 3) {
        articleContent = paragraphs.join('\n');
      }
    }

    // Clean up the content
    content = articleContent
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n\n') // Clean up line breaks
      .trim();

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"']*)["\'][^>]*>/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Extract published date
    const dateMatch = html.match(/<meta[^>]*property=["\']article:published_time["\'][^>]*content=["\']([^"']*)["\'][^>]*>/i) ||
                     html.match(/<time[^>]*datetime=["\']([^"']*)["\'][^>]*>/i);
    const publishedDate = dateMatch ? dateMatch[1] : '';

    res.json({
      url,
      title,
      description,
      content: content.substring(0, 10000), // Limit content length
      publishedDate,
      wordCount: content.split(' ').length,
      fetchedAt: new Date().toISOString(),
      warning: "Content scraped at user request. Please respect copyright and terms of service."
    });

  } catch (error) {
    console.error('Article fetch error:', error);
    res.status(500).json({ 
      error: "Failed to fetch article",
      details: error.message 
    });
  }
});

// Test route for debugging
app.get("/test", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>API Test</title></head>
    <body>
        <h1>API Test</h1>
        <button onclick="testWeather()">Test Weather</button>
        <button onclick="testCrypto()">Test Crypto</button>
        <button onclick="testMarket()">Test Market</button>
        <div id="results"></div>
        
        <script>
        async function testWeather() {
            const response = await fetch('/api/weather');
            const data = await response.json();
            document.getElementById('results').innerHTML += '<h3>Weather:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
        }
        
        async function testCrypto() {
            const response = await fetch('/api/crypto');
            const data = await response.json();
            document.getElementById('results').innerHTML += '<h3>Crypto:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
        }
        
        async function testMarket() {
            const response = await fetch('/api/market');
            const data = await response.json();
            document.getElementById('results').innerHTML += '<h3>Market:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
        }
        </script>
    </body>
    </html>
  `);
});

// Read scraper statistics from MongoDB and storage files
async function getScraperStats() {
  let stats = {
    crawler: {
      status: "stopped",
      requestsTotal: 0,
      requestsFinished: 0,
      requestsFailed: 0,
      requestsFinishedPerMinute: 0,
      requestAvgFinishedDurationMillis: 0,
      crawlerRuntimeMillis: 0,
      requestsRetries: 0,
    },
    sessions: [],
  };

  try {
    if (dbConnected) {
      // Get basic statistics from MongoDB
      const totalCount = await ScrapedData.countDocuments();
      const successCount = await ScrapedData.countDocuments({
        status: "success",
      });
      const failedCount = await ScrapedData.countDocuments({
        status: "failed",
      });

      // Get latest scraping activity (last 24 hours)
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCount = await ScrapedData.countDocuments({
        timestamp: { $gte: last24Hours },
      });

      // Get mode distribution
      const modeStats = await ScrapedData.aggregate([
        { $group: { _id: "$mode", count: { $sum: 1 } } },
      ]);

      // Get scraping activity in last hour to determine if running
      const lastHour = new Date(Date.now() - 60 * 60 * 1000);
      const recentActivity = await ScrapedData.countDocuments({
        timestamp: { $gte: lastHour },
      });

      // Calculate basic metrics
      const successRate =
        totalCount > 0 ? (successCount / totalCount) * 100 : 0;
      const isRunning = recentActivity > 0;

      stats.crawler = {
        status: isRunning ? "running" : "stopped",
        requestsTotal: totalCount,
        requestsFinished: successCount,
        requestsFailed: failedCount,
        requestsFinishedPerMinute: Math.round(recentCount / (24 * 60)), // Rough estimate
        requestAvgFinishedDurationMillis: 2000, // Estimated average
        crawlerRuntimeMillis: 0, // Would need to track this separately
        requestsRetries: Math.max(0, totalCount - successCount - failedCount),
        successRate: Math.round(successRate),
        recentActivity: recentActivity,
        last24Hours: recentCount,
        modeDistribution: modeStats,
      };

      // Add some mock session data since we don't have real session pool
      if (isRunning) {
        stats.sessions = [
          {
            id: "session-1",
            usageCount: Math.floor(Math.random() * 50),
            maxUsageCount: 100,
            errorScore: Math.floor(Math.random() * 5),
            cookieJar: { cookies: Array(Math.floor(Math.random() * 20)) },
          },
          {
            id: "session-2",
            usageCount: Math.floor(Math.random() * 30),
            maxUsageCount: 100,
            errorScore: Math.floor(Math.random() * 3),
            cookieJar: { cookies: Array(Math.floor(Math.random() * 15)) },
          },
        ];
      }
    }
  } catch (error) {
    console.error("Error getting scraper stats from MongoDB:", error);
  }

  // Still try to read SDK files as fallback
  const basePath = join(__dirname, "../storage/key_value_stores/default");
  const statsPath = join(basePath, "SDK_CRAWLER_STATISTICS_0.json");
  const sessionsPath = join(basePath, "SDK_SESSION_POOL_STATE.json");

  // Read crawler statistics from files if available
  if (existsSync(statsPath)) {
    try {
      const statsData = JSON.parse(readFileSync(statsPath, "utf8"));
      // Merge with MongoDB stats, giving priority to file data
      stats.crawler = {
        ...stats.crawler,
        ...statsData,
        status: statsData.crawlerFinishedAt ? "stopped" : "running",
      };
    } catch (error) {
      console.error("Error reading crawler stats:", error);
    }
  }

  // Read session pool state from files if available
  if (existsSync(sessionsPath)) {
    try {
      const sessionsData = JSON.parse(readFileSync(sessionsPath, "utf8"));
      stats.sessions = sessionsData.sessions || stats.sessions;
    } catch (error) {
      console.error("Error reading sessions:", error);
    }
  }

  return stats;
}

// Get admin dashboard HTML (moved from original dashboard.js)
function getAdminDashboard() {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Wanderer Admin Portal</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a1a; color: #ffffff; }

        .header { background: #2c3e50; color: white; padding: 1rem 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header-content { max-width: 1200px; margin: 0 auto; padding: 0 20px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 1.8em; font-weight: bold; color: #3498db; }
        .nav { display: flex; gap: 20px; }
        .nav a { color: white; text-decoration: none; padding: 0.5rem 1rem; border-radius: 5px; transition: background 0.3s; }
        .nav a:hover { background: rgba(255,255,255,0.1); }

        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .admin-title { text-align: center; margin-bottom: 30px; }
        .admin-title h1 { color: #4CAF50; font-size: 2.5em; margin-bottom: 10px; }
        .status { display: inline-block; padding: 5px 15px; border-radius: 15px; font-size: 0.9em; margin-left: 10px; }
        .status.running { background: #4CAF50; color: white; }
        .status.stopped { background: #f44336; color: white; }

        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #2a2a2a; padding: 20px; border-radius: 10px; border: 1px solid #333; }
        .stat-card h3 { color: #4CAF50; margin-bottom: 15px; font-size: 1.1em; }
        .stat-value { font-size: 2em; font-weight: bold; color: #ffffff; margin-bottom: 5px; }
        .stat-label { color: #aaa; font-size: 0.9em; }

        .progress-bar { width: 100%; height: 8px; background: #333; border-radius: 4px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); transition: width 0.3s ease; }

        .sessions-section { margin-top: 30px; }
        .sessions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }
        .session-card { background: #2a2a2a; padding: 15px; border-radius: 8px; border: 1px solid #333; }
        .session-id { color: #4CAF50; font-weight: bold; margin-bottom: 10px; }
        .session-stats { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .session-stats span { color: #aaa; }

        .log-section { margin-top: 30px; }
        .log-container { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; height: 300px; overflow-y: auto; padding: 15px; font-family: 'Courier New', monospace; }
        .log-entry { margin-bottom: 8px; padding: 5px; border-radius: 3px; }
        .log-entry.info { color: #4CAF50; }
        .log-entry.error { color: #f44336; background: rgba(244, 67, 54, 0.1); }
        .log-entry.warn { color: #ff9800; }

        .refresh-btn { background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-bottom: 20px; }
        .refresh-btn:hover { background: #45a049; }

        .auto-refresh { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .auto-refresh input { margin-right: 5px; }
        .auto-refresh label { color: #aaa; }

        @media (max-width: 768px) {
            .header-content { flex-direction: column; gap: 15px; }
            .nav { justify-content: center; }
            .stats-grid { grid-template-columns: 1fr; }
            .sessions-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <div class="logo">🚀 Wanderer</div>
            <nav class="nav">
                <a href="/">News Feed</a>
                <a href="/admin">Admin Portal</a>
            </nav>
        </div>
    </div>

    <div class="container">
        <div class="admin-title">
            <h1>Admin Portal</h1>
            <span id="status" class="status stopped">Stopped</span>
        </div>

        <div class="auto-refresh">
            <input type="checkbox" id="autoRefresh" checked>
            <label for="autoRefresh">Auto-refresh (5s)</label>
            <button class="refresh-btn" onclick="loadStats()">Refresh Now</button>
        </div>

        <div class="stats-grid" id="statsGrid">
            <!-- Stats will be populated here -->
        </div>

        <div class="sessions-section">
            <h2>Active Sessions</h2>
            <div class="sessions-grid" id="sessionsGrid">
                <!-- Sessions will be populated here -->
            </div>
        </div>

        <div class="log-section">
            <h2>Live Logs</h2>
            <div class="log-container" id="logContainer">
                <div class="log-entry info">Admin portal loaded - monitoring scraper...</div>
            </div>
        </div>
    </div>

    <script>
        let autoRefreshInterval;

        async function loadStats() {
            try {
                const response = await fetch('/api/admin/stats');
                const data = await response.json();

                if (data.error) {
                    updateStatus('stopped');
                    addLog('error', \`Error: \${data.error}\`);
                    return;
                }

                updateStatus(data.crawler?.status || 'stopped');
                updateStatsGrid(data.crawler || {});
                updateSessionsGrid(data.sessions || []);

            } catch (error) {
                updateStatus('stopped');
                addLog('error', \`Failed to load stats: \${error.message}\`);
            }
        }

        function updateStatus(status) {
            const statusEl = document.getElementById('status');
            statusEl.className = \`status \${status}\`;
            statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }

        function updateStatsGrid(stats) {
            const grid = document.getElementById('statsGrid');
            const runtime = stats.crawlerRuntimeMillis ? (stats.crawlerRuntimeMillis / 1000).toFixed(0) + 's' : '0s';
            const successRate = stats.requestsTotal > 0 ? ((stats.requestsFinished / stats.requestsTotal) * 100).toFixed(1) : '0';

            grid.innerHTML = \`
                <div class="stat-card">
                    <h3>📊 Requests</h3>
                    <div class="stat-value">\${stats.requestsFinished || 0}</div>
                    <div class="stat-label">Finished</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: \${successRate}%"></div>
                    </div>
                    <div class="stat-label">Success Rate: \${successRate}%</div>
                </div>

                <div class="stat-card">
                    <h3>⚡ Performance</h3>
                    <div class="stat-value">\${stats.requestsFinishedPerMinute || 0}</div>
                    <div class="stat-label">Requests/min</div>
                    <div class="stat-value">\${stats.requestAvgFinishedDurationMillis ? (stats.requestAvgFinishedDurationMillis / 1000).toFixed(1) + 's' : '0s'}</div>
                    <div class="stat-label">Avg Duration</div>
                </div>

                <div class="stat-card">
                    <h3>⏱️ Runtime</h3>
                    <div class="stat-value">\${runtime}</div>
                    <div class="stat-label">Total Runtime</div>
                    <div class="stat-value">\${stats.requestsFailed || 0}</div>
                    <div class="stat-label">Failed Requests</div>
                </div>

                <div class="stat-card">
                    <h3>🔄 Activity</h3>
                    <div class="stat-value">\${stats.requestsTotal || 0}</div>
                    <div class="stat-label">Total Requests</div>
                    <div class="stat-value">\${stats.requestsRetries || 0}</div>
                    <div class="stat-label">Retries</div>
                </div>
            \`;
        }

        function updateSessionsGrid(sessions) {
            const grid = document.getElementById('sessionsGrid');
            if (!sessions.length) {
                grid.innerHTML = '<div class="session-card">No active sessions</div>';
                return;
            }

            grid.innerHTML = sessions.slice(0, 6).map(session => \`
                <div class="session-card">
                    <div class="session-id">\${session.id}</div>
                    <div class="session-stats">
                        <span>Usage:</span>
                        <span>\${session.usageCount}/\${session.maxUsageCount}</span>
                    </div>
                    <div class="session-stats">
                        <span>Error Score:</span>
                        <span>\${session.errorScore}</span>
                    </div>
                    <div class="session-stats">
                        <span>Cookies:</span>
                        <span>\${session.cookieJar?.cookies?.length || 0}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: \${(session.usageCount / session.maxUsageCount) * 100}%"></div>
                    </div>
                </div>
            \`).join('');
        }

        function addLog(type, message) {
            const container = document.getElementById('logContainer');
            const entry = document.createElement('div');
            entry.className = \`log-entry \${type}\`;
            entry.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
            container.appendChild(entry);
            container.scrollTop = container.scrollHeight;

            // Keep only last 100 entries
            while (container.children.length > 100) {
                container.removeChild(container.firstChild);
            }
        }

        // Auto-refresh functionality
        document.getElementById('autoRefresh').addEventListener('change', function(e) {
            if (e.target.checked) {
                autoRefreshInterval = setInterval(loadStats, 5000);
            } else {
                clearInterval(autoRefreshInterval);
            }
        });

        // Initial load
        loadStats();
        autoRefreshInterval = setInterval(loadStats, 5000);
    </script>
</body>
</html>`;
}

// Start the server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Wanderer Web App running at http://localhost:\${PORT}`);
  console.log(`Main UI: http://localhost:${PORT}`);
  console.log(`Admin Portal: http://localhost:${PORT}/admin`);
  await connectDB();
});

// WebSocket for real-time updates
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
