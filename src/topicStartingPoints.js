// Topic-based starting points for wanderer mode
// These URLs serve as entry points for discovering content in each category

export const topicStartingPoints = {
  ecommerce: [
    'https://www.amazon.com',
    'https://www.ebay.com',
    'https://www.etsy.com',
    'https://www.walmart.com',
    'https://www.alibaba.com',
    'https://www.shopify.com',
    'https://www.bestbuy.com',
    'https://www.target.com'
  ],
  
  news: [
    // Reliable news sources
    'https://www.reuters.com',
    'https://apnews.com',
    'https://www.bbc.com/news',
    'https://www.wsj.com/news',
    // Other major news outlets
    'https://www.cnn.com',
    'https://www.nytimes.com',
    'https://www.theguardian.com',
    'https://www.washingtonpost.com',
    'https://www.bloomberg.com'
  ],
  
  local_news: [
    'https://www.newsbreak.com',
    'https://news.google.com',
    'https://www.smartnews.com',
    'https://www.apple.com/apple-news',
    // Local discovery
    'https://www.yelp.com',
    'https://www.tripadvisor.com',
    'https://www.zomato.com',
    'https://www.foursquare.com',
    'https://www.meetup.com',
    'https://www.eventbrite.com',
    'https://nextdoor.com',
    'https://www.citysearch.com'
  ],
  
  big_technology: [
    // Tech news sites
    'https://techcrunch.com',
    'https://www.theverge.com',
    'https://arstechnica.com',
    'https://www.wired.com',
    'https://www.technologyreview.com',
    // Developer resources
    'https://developer.mozilla.org',
    'https://dev.to',
    'https://stackoverflow.com',
    'https://github.com',
    // Big tech companies
    'https://www.apple.com',
    'https://www.microsoft.com',
    'https://www.google.com',
    'https://www.meta.com',
    'https://www.amazon.com/amazon-devices',
    'https://www.tesla.com',
    'https://www.nvidia.com',
    'https://www.oracle.com',
    'https://www.salesforce.com',
    'https://www.adobe.com',
    'https://www.ibm.com',
    'https://www.intel.com'
  ],
  
  sports: [
    'https://www.espn.com',
    'https://theathletic.com',
    'https://bleacherreport.com',
    'https://www.skysports.com',
    'https://www.formula1.com',
    'https://www.pgatour.com',
    'https://www.bbc.com/sport'
  ],
  
  science: [
    'https://www.nature.com/news',
    'https://www.science.org/news',
    'https://www.technologyreview.com',
    'https://www.scientificamerican.com',
    'https://www.sciencedaily.com'
  ],
  
  rabbit_hole: [
    'https://www.atlasobscura.com',
    'https://www.mentalfloss.com',
    'https://www.reddit.com',
    'https://ridiculouslyinteresting.com'
  ],
  
  docs: [
    'https://developer.mozilla.org',
    'https://docs.python.org',
    'https://nodejs.org/docs',
    'https://reactjs.org/docs',
    'https://www.tensorflow.org/api_docs',
    'https://docs.docker.com',
    'https://kubernetes.io/docs',
    'https://docs.aws.amazon.com'
  ],
  
  forum: [
    'https://www.reddit.com',
    'https://stackoverflow.com',
    'https://news.ycombinator.com',
    'https://forum.xda-developers.com',
    'https://forums.tesla.com',
    'https://community.cloudflare.com',
    'https://discuss.python.org',
    'https://dev.to'
  ],
  
  github: [
    'https://github.com/trending',
    'https://github.com/explore',
    'https://github.com/topics',
    'https://github.com/collections',
    'https://github.com/sponsors/explore',
    'https://github.com/readme/topics',
    'https://github.com/showcases',
    'https://github.com/trending/developers'
  ],
  
  general: [
    'https://www.wikipedia.org',
    'https://www.whitehouse.gov',
    'https://www.who.int',
    'https://www.un.org',
    'https://www.worldbank.org',
    'https://www.imdb.com',
    'https://www.britannica.com',
    'https://www.archives.gov'
  ]
};

// Function to get starting URLs for a specific topic
export function getStartingUrlsForTopic(topic) {
  return topicStartingPoints[topic] || topicStartingPoints.general;
}

// Function to get all starting URLs across all topics
export function getAllStartingUrls() {
  return Object.values(topicStartingPoints).flat();
}

// Function to get a random selection of URLs from a topic
export function getRandomUrlsFromTopic(topic, count = 3) {
  const urls = getStartingUrlsForTopic(topic);
  const shuffled = [...urls].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Function to get URLs for multiple topics
export function getUrlsForTopics(topics) {
  return topics.flatMap(topic => getStartingUrlsForTopic(topic));
}

// Export topic names for UI
export const availableTopics = Object.keys(topicStartingPoints);