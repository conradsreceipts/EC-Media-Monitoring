export interface RSSFeedSource {
  name: string;
  url: string;
  altUrls?: string[];
  category: 'Government' | 'News' | 'Local';
}

const FEED_SOURCES: RSSFeedSource[] = [
  {
    name: "Gov.za - National News (SANews)",
    url: "https://www.gov.za/news-feed",
    category: "Government"
  },
  {
    name: "Gov.za - Speeches & Statements",
    url: "https://www.gov.za/speeches-feed",
    category: "Government"
  },
  {
    name: "Gov.za - Documents & Publications",
    url: "https://www.gov.za/documents-feed",
    category: "Government"
  },
  {
    name: "Gov.za - Key Issues",
    url: "https://www.gov.za/issues-feed",
    category: "Government"
  },
  {
    name: "Gov.za - Services & Info",
    url: "https://www.gov.za/services-feeds",
    category: "Government"
  },
  {
    name: "Gov.za - Blog & Opinions",
    url: "https://www.gov.za/blog-feeds",
    category: "Government"
  },
  {
    name: "SARS - Latest News",
    url: "http://www.sars.gov.za/feed/",
    altUrls: ["http://www.sars.gov.za/feed/?post_type=latest_news"],
    category: "Government"
  },
  {
    name: "SARB - Publications",
    url: "https://www.resbank.co.za/bin/sarb/solr/publications/rss",
    altUrls: [
      "http://www.resbank.co.za/bin/sarb/solr/publications/rss"
    ],
    category: "Government"
  },
  {
    name: "News24 - Top Stories",
    url: "https://feeds.24.com/articles/news24/TopStories/rss",
    altUrls: [
      "https://www.news24.com/feeds/rss/news/topstories",
      "https://www.news24.com/feeds/rss/news/south-africa"
    ],
    category: "News"
  },
  {
    name: "TimesLIVE - News",
    url: "https://www.timeslive.co.za/arc/outboundfeeds/rss/category/news/",
    altUrls: [
      "https://www.timeslive.co.za/arc/outboundfeeds/rss/category/politics/",
      "https://www.timeslive.co.za/arc/outboundfeeds/rss/"
    ],
    category: "News"
  },
  {
    name: "Sunday Times - News",
    url: "https://www.sundaytimes.timeslive.co.za/arc/outboundfeeds/rss/category/news/",
    altUrls: ["https://www.sundaytimes.timeslive.co.za/arc/outboundfeeds/rss/"],
    category: "News"
  },
  {
    name: "Daily Dispatch - News",
    url: "https://www.dailydispatch.co.za/arc/outboundfeeds/rss/category/news/",
    altUrls: [
      "https://www.dailydispatch.co.za/arc/outboundfeeds/rss/category/politics/",
      "https://www.dailydispatch.co.za/arc/outboundfeeds/rss/"
    ],
    category: "News"
  },
  {
    name: "The Herald - News",
    url: "https://www.theherald.co.za/arc/outboundfeeds/rss/category/news/",
    altUrls: ["https://www.theherald.co.za/arc/outboundfeeds/rss/"],
    category: "News"
  },
  {
    name: "Business Day - News",
    url: "https://www.businessday.co.za/arc/outboundfeeds/rss/category/news/",
    altUrls: ["https://www.businessday.co.za/arc/outboundfeeds/rss/category/politics/"],
    category: "News"
  },
  {
    name: "Financial Mail - Features",
    url: "https://www.financialmail.businessday.co.za/arc/outboundfeeds/rss/category/features/",
    altUrls: ["https://www.financialmail.businessday.co.za/arc/outboundfeeds/rss/"],
    category: "News"
  },
  {
    name: "SowetanLIVE - News",
    url: "https://sowetan.co.za/arc/outboundfeeds/rss/category/news/",
    altUrls: ["https://sowetan.co.za/arc/outboundfeeds/rss/"],
    category: "News"
  },
  {
    name: "Mail & Guardian - South Africa",
    url: "https://mg.co.za/feed/",
    category: "News"
  },
  {
    name: "Daily Maverick - South Africa",
    url: "https://www.dailymaverick.co.za/rss",
    altUrls: ["https://www.dailymaverick.co.za/feed/"],
    category: "News"
  },
  {
    name: "GroundUp - News",
    url: "https://groundup.org.za/sitenews/rss/",
    altUrls: ["https://groundup.org.za/sitenews/atom_full/"],
    category: "News"
  },
  {
    name: "News24 - South Africa",
    url: "https://feeds.24.com/articles/news24/SouthAfrica/rss",
    altUrls: [
      "https://www.news24.com/feeds/rss/news/south-africa",
      "https://www.news24.com/feeds/rss/news/south-africa/eastern-cape"
    ],
    category: "News"
  },
  {
    name: "GroundUp - Q&A",
    url: "https://groundup.org.za/qanda/rss/",
    category: "News"
  },
  {
    name: "Farmer's Weekly SA",
    url: "https://www.farmersweekly.co.za/feed/",
    category: "News"
  },
  {
    name: "Agri SA",
    url: "https://agrisa.co.za/feed/",
    category: "News"
  },
  {
    name: "Moneyweb - Investment & Business",
    url: "https://www.moneyweb.co.za/feed/",
    category: "News"
  },
  {
    name: "Infrastructure News",
    url: "https://infrastructurenews.co.za/feed/",
    category: "News"
  },
  {
    name: "Youth Village SA",
    url: "https://www.youthvillage.co.za/feed/",
    category: "News"
  },
  {
    name: "Ventureburn - Tech & Investment",
    url: "https://ventureburn.com/feed/",
    category: "News"
  },
  {
    name: "InvestSA - Investment News",
    url: "https://www.investsa.gov.za/feed/",
    category: "News"
  }
];

export async function fetchRSSFeeds(onProgress?: (status: string) => void) {
  const allArticles: any[] = [];
  
  // Parallelize fetching across all sources
  const sourcePromises = FEED_SOURCES.map(async (source) => {
    const urlsToTry = [source.url, ...(source.altUrls || [])];
    
    // Try URLs for this source sequentially (failover logic)
    for (const url of urlsToTry) {
      try {
        if (onProgress) onProgress(`Fetching RSS from ${source.name} (${url === source.url ? 'Primary' : 'Alternative'})...`);
        
        const fetchUrl = `/api/rss-fetch?url=${encodeURIComponent(url)}`;
        const response = await fetch(fetchUrl);
        
        if (!response.ok) {
          const errorMsg = `Failed to fetch ${source.name} from ${url}: HTTP ${response.status} ${response.statusText}`;
          console.warn(errorMsg);
          // Don't flood progress with every failover warning unless it's a critical failure later
          continue; 
        }
        
        const feed = await response.json();
        
        if (!feed.items || feed.items.length === 0) {
          console.warn(`No items found in feed from ${source.name} (${url})`);
          continue; 
        }

        const articles = feed.items.map((item: any) => ({
          title: item.title || "Untitled Article",
          link: item.link || "",
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          content: item.contentSnippet || item.content || item.summary || "",
          source: source.name,
          category: source.category
        })).filter((article: any) => article.link && article.title);
        
        if (articles.length > 0) {
          if (onProgress) onProgress(`SUCCESS: Extracted ${articles.length} articles from ${source.name}`);
          return articles;
        }
      } catch (error: any) {
        const errorMsg = `Error fetching RSS from ${source.name} (${url}): ${error.message}`;
        console.error(errorMsg);
      }
    }
    
    if (onProgress) onProgress(`CRITICAL: All URLs failed for ${source.name}.`);
    return [];
  });

  const results = await Promise.all(sourcePromises);
  results.forEach(articles => allArticles.push(...articles));
  
  return allArticles;
}
