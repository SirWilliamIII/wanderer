// src/externalData.js - External API integrations for news, weather, and events
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();


export class ExternalDataService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    // Get cached data or fetch new
    async getCachedData(key, fetchFunction) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            const data = await fetchFunction();
            this.cache.set(key, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            console.error(`Error fetching ${key}:`, error.message);
            return cached?.data || null;
        }
    }

    // Get weather data using OpenWeatherMap API (free tier)
    async getWeather(lat, lon) {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            return {
                location: 'Unknown',
                temperature: '--',
                description: 'API key not configured',
                icon: '01d'
            };
        }

        return this.getCachedData('weather', async () => {
            const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
                params: {
                    lat,
                    lon,
                    appid: apiKey,
                    units: 'metric'
                },
                timeout: 5000
            });

            const data = response.data;
            return {
                location: data.name,
                temperature: Math.round(data.main.temp),
                description: data.weather[0].description,
                icon: data.weather[0].icon,
                humidity: data.main.humidity,
                windSpeed: data.wind.speed
            };
        });
    }

    // Get major news events using NewsAPI (free tier)
    async getMajorEvents() {
        const apiKey = process.env.NEWSAPI_KEY;
        if (!apiKey) {
            return [{
                title: 'Configure NewsAPI key for live events',
                description: 'Add NEWSAPI_KEY to environment variables',
                url: 'https://newsapi.org/',
                publishedAt: new Date().toISOString(),
                source: 'System'
            }];
        }

        return this.getCachedData('major-events', async () => {
            const response = await axios.get('https://newsapi.org/v2/top-headlines', {
                params: {
                    apiKey,
                    country: 'us',
                    category: 'general',
                    pageSize: 10
                },
                timeout: 5000
            });

            return response.data.articles.map(article => ({
                title: article.title,
                description: article.description,
                url: article.url,
                publishedAt: article.publishedAt,
                source: article.source.name,
                image: article.urlToImage
            }));
        });
    }

    // Get Big Technology stories - focus on major tech companies and developments
    async getBigTechNews() {
        const apiKey = process.env.NEWSAPI_KEY;
        if (!apiKey) {
            return [{
                title: 'Configure NewsAPI key for Big Tech news',
                description: 'Add NEWSAPI_KEY to environment variables',
                url: 'https://newsapi.org/',
                publishedAt: new Date().toISOString(),
                source: 'System'
            }];
        }

        return this.getCachedData('big-tech-news', async () => {
            // Get news from multiple tech-focused sources
            const [techResponse, bigTechResponse, hackerNewsResponse] = await Promise.all([
                // General tech news
                axios.get('https://newsapi.org/v2/top-headlines', {
                    params: {
                        apiKey,
                        category: 'technology',
                        language: 'en',
                        pageSize: 20
                    },
                    timeout: 5000
                }),
                // Specific big tech company news
                axios.get('https://newsapi.org/v2/everything', {
                    params: {
                        apiKey,
                        q: 'Apple OR Google OR Microsoft OR Amazon OR Meta OR Tesla OR OpenAI OR ChatGPT OR AI OR "artificial intelligence"',
                        sortBy: 'publishedAt',
                        language: 'en',
                        pageSize: 20
                    },
                    timeout: 5000
                }),
                // Get Hacker News for developer perspective
                this.getTrendingTech()
            ]);

            // Combine all sources
            const allArticles = [...techResponse.data.articles, ...bigTechResponse.data.articles];
            
            // Big tech keywords for filtering
            const bigTechKeywords = [
                'apple', 'google', 'microsoft', 'amazon', 'meta', 'facebook', 'tesla', 'spacex',
                'openai', 'chatgpt', 'ai', 'artificial intelligence', 'machine learning',
                'iphone', 'android', 'windows', 'aws', 'cloud', 'azure',
                'startup', 'ipo', 'acquisition', 'merger', 'funding', 'investment',
                'blockchain', 'cryptocurrency', 'bitcoin', 'ethereum',
                'cybersecurity', 'data breach', 'privacy', 'regulation',
                'autonomous', 'electric vehicle', 'ev', 'battery',
                'quantum', 'chip', 'semiconductor', 'processor',
                'metaverse', 'vr', 'ar', 'virtual reality', 'augmented reality'
            ];

            // Filter for big tech relevance
            const bigTechArticles = allArticles.filter(article => {
                if (!article.title || !article.description) return false;
                
                const content = (article.title + ' ' + article.description).toLowerCase();
                const isBigTech = bigTechKeywords.some(keyword => content.includes(keyword));
                const hasSubstance = article.description.length > 50;
                
                return isBigTech && hasSubstance;
            });

            // Remove duplicates and add HackerNews items
            const uniqueArticles = bigTechArticles.filter((article, index, self) => 
                index === self.findIndex(a => a.title === article.title)
            );

            // Combine with HackerNews
            const hackerNewsItems = hackerNewsResponse.slice(0, 5).map(item => ({
                title: item.title,
                description: `HN Score: ${item.score}, Comments: ${item.comments}`,
                url: item.url,
                publishedAt: item.publishedAt,
                source: 'Hacker News',
                image: null,
                score: item.score,
                comments: item.comments
            }));

            const combinedArticles = [...uniqueArticles.slice(0, 12), ...hackerNewsItems];

            return combinedArticles.map(article => ({
                title: article.title,
                description: article.description,
                url: article.url,
                publishedAt: article.publishedAt,
                source: article.source,
                image: article.image,
                category: 'big-tech',
                score: article.score,
                comments: article.comments
            }));
        });
    }

    // Get tech news using NewsAPI (legacy method for backward compatibility)
    async getTechNews() {
        return this.getBigTechNews();
    }

    // Get sports news using NewsAPI
    async getSportsNews() {
        const apiKey = process.env.NEWSAPI_KEY;
        if (!apiKey) {
            return [{
                title: 'Configure NewsAPI key for sports news',
                description: 'Add NEWSAPI_KEY to environment variables',
                url: 'https://newsapi.org/',
                publishedAt: new Date().toISOString(),
                source: 'System'
            }];
        }

        return this.getCachedData('sports-news', async () => {
            const response = await axios.get('https://newsapi.org/v2/top-headlines', {
                params: {
                    apiKey,
                    category: 'sports',
                    language: 'en',
                    pageSize: 15
                },
                timeout: 5000
            });

            return response.data.articles.map(article => ({
                title: article.title,
                description: article.description,
                url: article.url,
                publishedAt: article.publishedAt,
                source: article.source.name,
                image: article.urlToImage
            }));
        });
    }

    // Get world headlines with importance filtering
    async getWorldHeadlines() {
        const apiKey = process.env.NEWSAPI_KEY;
        if (!apiKey) {
            return [{
                title: 'Configure NewsAPI key for world headlines',
                description: 'Add NEWSAPI_KEY to environment variables',
                url: 'https://newsapi.org/',
                publishedAt: new Date().toISOString(),
                source: 'System'
            }];
        }

        return this.getCachedData('world-headlines', async () => {
            // Get headlines from multiple sources
            const [usResponse, globalResponse] = await Promise.all([
                axios.get('https://newsapi.org/v2/top-headlines', {
                    params: {
                        apiKey,
                        country: 'us',
                        pageSize: 15
                    },
                    timeout: 5000
                }),
                axios.get('https://newsapi.org/v2/top-headlines', {
                    params: {
                        apiKey,
                        sources: 'bbc-news,reuters,associated-press,cnn,al-jazeera-english',
                        pageSize: 15
                    },
                    timeout: 5000
                })
            ]);

            // Combine and filter for truly important news
            const allArticles = [...usResponse.data.articles, ...globalResponse.data.articles];
            
            // High-importance sources
            const importantSources = [
                'Reuters', 'Associated Press', 'BBC News', 'CNN', 'The New York Times', 
                'The Washington Post', 'Al Jazeera English', 'The Guardian', 'Financial Times'
            ];
            
            // Keywords that indicate major importance
            const majorKeywords = [
                'breaking', 'urgent', 'emergency', 'crisis', 'war', 'conflict', 'attack',
                'president', 'prime minister', 'government', 'election', 'vote',
                'death', 'dies', 'killed', 'disaster', 'earthquake', 'hurricane',
                'economy', 'recession', 'inflation', 'market crash', 'stock',
                'pandemic', 'outbreak', 'virus', 'vaccine',
                'historic', 'unprecedented', 'first time', 'record',
                'investigation', 'arrest', 'charges', 'trial', 'verdict',
                'treaty', 'agreement', 'summit', 'meeting', 'talks',
                'technology', 'ai', 'artificial intelligence', 'cyber',
                'climate', 'global warming', 'environment'
            ];

            // Filter for importance
            const importantArticles = allArticles.filter(article => {
                if (!article.title || !article.description) return false;
                
                const isImportantSource = importantSources.some(source => 
                    article.source.name.toLowerCase().includes(source.toLowerCase())
                );
                
                const hasImportantKeywords = majorKeywords.some(keyword => 
                    article.title.toLowerCase().includes(keyword) || 
                    article.description.toLowerCase().includes(keyword)
                );
                
                // Additional filtering: must have substance
                const hasSubstance = article.description.length > 100;
                
                return (isImportantSource || hasImportantKeywords) && hasSubstance;
            });

            // Remove duplicates and sort by importance
            const uniqueArticles = importantArticles.filter((article, index, self) => 
                index === self.findIndex(a => a.title === article.title)
            );

            // Only return if we have truly important news
            return uniqueArticles.length > 0 ? uniqueArticles.slice(0, 8).map(article => ({
                title: article.title,
                description: article.description,
                url: article.url,
                publishedAt: article.publishedAt,
                source: article.source.name,
                image: article.urlToImage,
                importance: 'high'
            })) : [];
        });
    }

    // Get breaking news using NewsAPI
    async getBreakingNews() {
        // Redirect to world headlines for consistency
        return this.getWorldHeadlines();
    }

    // Get trending tech topics from Hacker News
    async getTrendingTech() {
        return this.getCachedData('trending-tech', async () => {
            // Get top stories from Hacker News
            const topStoriesResponse = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json', {
                timeout: 5000
            });
            
            const topStoryIds = topStoriesResponse.data.slice(0, 10);
            
            // Get details for each story
            const stories = await Promise.all(
                topStoryIds.map(async (id) => {
                    try {
                        const storyResponse = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
                            timeout: 3000
                        });
                        return storyResponse.data;
                    } catch (error) {
                        return null;
                    }
                })
            );

            return stories
                .filter(story => story && story.title && story.url)
                .map(story => ({
                    title: story.title,
                    url: story.url,
                    score: story.score,
                    comments: story.descendants || 0,
                    publishedAt: new Date(story.time * 1000).toISOString(),
                    source: 'Hacker News'
                }));
        });
    }

    // Get GitHub trending repositories
    async getTrendingRepos() {
        return this.getCachedData('trending-repos', async () => {
            const response = await axios.get('https://api.github.com/search/repositories', {
                params: {
                    q: 'created:>2024-01-01',
                    sort: 'stars',
                    order: 'desc',
                    per_page: 10
                },
                timeout: 5000
            });

            return response.data.items.map(repo => ({
                name: repo.name,
                fullName: repo.full_name,
                description: repo.description,
                stars: repo.stargazers_count,
                language: repo.language,
                url: repo.html_url,
                owner: repo.owner.login
            }));
        });
    }

    // Get crypto prices (using CoinGecko free API)
    async getCryptoPrices() {
        return this.getCachedData('crypto-prices', async () => {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                params: {
                    ids: 'bitcoin,ethereum,binancecoin,cardano,solana',
                    vs_currencies: 'usd',
                    include_24hr_change: 'true'
                },
                timeout: 5000
            });

            return Object.entries(response.data).map(([id, data]) => ({
                id,
                name: id.charAt(0).toUpperCase() + id.slice(1),
                price: data.usd,
                change24h: data.usd_24h_change
            }));
        });
    }

    // Get Local Area Data - combines weather, local news, and area-specific information
    async getLocalAreaData(lat = 40.7128, lon = -74.0060) {
        return this.getCachedData('local-area-data', async () => {
            try {
                // Get weather data
                const weatherData = await this.getWeather(lat, lon);
                
                // Get local news if NewsAPI is available
                const apiKey = process.env.NEWSAPI_KEY;
                let localNews = [];
                
                if (apiKey) {
                    try {
                        // Try to get local news for major cities
                        const cityQueries = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia'];
                        const response = await axios.get('https://newsapi.org/v2/everything', {
                            params: {
                                apiKey,
                                q: cityQueries.join(' OR '),
                                sortBy: 'publishedAt',
                                language: 'en',
                                pageSize: 10
                            },
                            timeout: 5000
                        });
                        
                        localNews = response.data.articles.map(article => ({
                            title: article.title,
                            description: article.description,
                            url: article.url,
                            publishedAt: article.publishedAt,
                            source: article.source.name,
                            image: article.urlToImage,
                            category: 'local-news'
                        }));
                    } catch (error) {
                        console.error('Error fetching local news:', error);
                    }
                }

                // Get market data for local context
                const marketData = await this.getMarketData();
                
                // Combine all local area data
                const localData = [
                    // Weather as first item
                    {
                        title: `Weather in ${weatherData.location}: ${weatherData.temperature}°C`,
                        description: `${weatherData.description}. Humidity: ${weatherData.humidity}%, Wind: ${weatherData.windSpeed} m/s`,
                        url: '#weather',
                        publishedAt: new Date().toISOString(),
                        source: 'Weather Service',
                        category: 'weather',
                        weatherData: weatherData
                    },
                    // Market data
                    ...marketData.indices.map(index => ({
                        title: `${index.name}: ${index.value}`,
                        description: `Market change: ${index.change}`,
                        url: '#market',
                        publishedAt: new Date().toISOString(),
                        source: 'Market Data',
                        category: 'market'
                    })),
                    // Local news
                    ...localNews.slice(0, 8)
                ];

                return localData;
            } catch (error) {
                console.error('Error fetching local area data:', error);
                return [{
                    title: 'Local Area Data Unavailable',
                    description: 'Unable to fetch local area information at this time.',
                    url: '#',
                    publishedAt: new Date().toISOString(),
                    source: 'System',
                    category: 'error'
                }];
            }
        });
    }

    // Get market data (using Alpha Vantage free API)
    async getMarketData() {
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        if (!apiKey) {
            return {
                indices: [
                    { name: 'S&P 500', value: '--', change: 'API key not configured' },
                    { name: 'NASDAQ', value: '--', change: 'API key not configured' },
                    { name: 'DOW', value: '--', change: 'API key not configured' }
                ]
            };
        }

        return this.getCachedData('market-data', async () => {
            try {
                // Get real market data from Alpha Vantage
                const [spyResponse, qqqResponse, diaResponse] = await Promise.all([
                    // SPY (S&P 500 ETF)
                    axios.get('https://www.alphavantage.co/query', {
                        params: {
                            function: 'GLOBAL_QUOTE',
                            symbol: 'SPY',
                            apikey: apiKey
                        },
                        timeout: 10000
                    }),
                    // QQQ (NASDAQ ETF)
                    axios.get('https://www.alphavantage.co/query', {
                        params: {
                            function: 'GLOBAL_QUOTE',
                            symbol: 'QQQ',
                            apikey: apiKey
                        },
                        timeout: 10000
                    }),
                    // DIA (DOW ETF)
                    axios.get('https://www.alphavantage.co/query', {
                        params: {
                            function: 'GLOBAL_QUOTE',
                            symbol: 'DIA',
                            apikey: apiKey
                        },
                        timeout: 10000
                    })
                ]);

                const formatMarketData = (response, name) => {
                    const quote = response.data['Global Quote'];
                    if (!quote || !quote['05. price']) {
                        return { name, value: '--', change: 'No data' };
                    }
                    
                    const price = parseFloat(quote['05. price']);
                    const change = parseFloat(quote['09. change']);
                    const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                    
                    return {
                        name,
                        value: price.toFixed(2),
                        change: `${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`
                    };
                };

                return {
                    indices: [
                        formatMarketData(spyResponse, 'S&P 500'),
                        formatMarketData(qqqResponse, 'NASDAQ'),
                        formatMarketData(diaResponse, 'DOW')
                    ]
                };
            } catch (error) {
                console.error('Error fetching market data:', error);
                return {
                    indices: [
                        { name: 'S&P 500', value: '--', change: 'API error' },
                        { name: 'NASDAQ', value: '--', change: 'API error' },
                        { name: 'DOW', value: '--', change: 'API error' }
                    ]
                };
            }
        });
    }
}

export const externalDataService = new ExternalDataService();
