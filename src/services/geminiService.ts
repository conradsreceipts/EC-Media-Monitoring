import { GoogleGenAI } from "@google/genai";
import { MonitoringConfig, MonitoringReport, REPORT_SCHEMA } from "../types";
import { fetchRSSFeeds } from "./rssService";

// Use process.env.GEMINI_API_KEY or import.meta.env.VITE_GEMINI_API_KEY
const getApiKey = () => {
  // Use direct string references for Vite's 'define' to work reliably
  const processKey = process.env.GEMINI_API_KEY;
  const viteKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  console.log("DEBUG: getApiKey - processKey length:", (processKey || '').length);
  console.log("DEBUG: getApiKey - viteKey length:", (viteKey || '').length);
  
  const key = (processKey || viteKey || '').trim();
  
  // Ignore common placeholders and invalid strings
  const invalidPlaceholders = [
    'YOUR_GEMINI_API_KEY', 
    'MY_GEMINI_API_KEY', 
    'AIza...', 
    'undefined', 
    'null',
    ''
  ];

  if (invalidPlaceholders.includes(key)) {
    console.log("DEBUG: getApiKey - Key is a placeholder or empty");
    return '';
  }
  
  return key;
};

const defaultAi = new GoogleGenAI({ apiKey: getApiKey() });

/**
 * Helper to call Gemini API with exponential backoff retry logic
 * to handle transient RPC/network errors (like the 500 XHR error).
 */
async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Log the full error for debugging in the browser console
      console.error("Gemini API Error Details:", {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error.details
      });

      // Check for quota exhaustion
      const isQuotaExhausted = 
        error.status === "RESOURCE_EXHAUSTED" || 
        error.code === 429 || 
        error.message?.includes("429") || 
        (error.message?.toLowerCase().includes("quota") && !error.message?.toLowerCase().includes("invalid") && !error.message?.toLowerCase().includes("api key"));
      
      if (isQuotaExhausted) {
        throw new Error("QUOTA_EXHAUSTED");
      }

      // Check for invalid API key - be very specific to avoid false positives
      const isInvalidKey = 
        error.message?.toLowerCase().includes("api_key_invalid") || 
        error.message?.toLowerCase().includes("api key is invalid") ||
        error.message?.toLowerCase().includes("invalid api key") ||
        (error.status === "UNAUTHENTICATED" && error.message?.toLowerCase().includes("key"));

      if (isInvalidKey) {
        throw new Error(`INVALID_API_KEY: ${error.message}`);
      }

      // Check for search tool specific errors
      const isSearchToolError = 
        error.message?.toLowerCase().includes("search tool") || 
        error.message?.toLowerCase().includes("grounding");

      if (isSearchToolError) {
        throw new Error(`SEARCH_TOOL_ERROR: ${error.message}`);
      }

      const isTransient = 
        error.message?.includes("Rpc failed") || 
        error.message?.includes("xhr error") ||
        error.message?.includes("fetch failed") ||
        error.status === "UNKNOWN" ||
        (error.code >= 500 && error.code <= 599);

      if (!isTransient || attempt === maxRetries) {
        throw error;
      }

      // If it's a transient error, use exponential backoff
      const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
      
      console.warn(`Gemini API call failed (Transient Error). Attempt ${attempt + 1}/${maxRetries + 1}. Retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function runMonitoring(
  config: MonitoringConfig, 
  userApiKey?: string,
  onProgress?: (report: MonitoringReport, status: string) => void
): Promise<MonitoringReport> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  const getStartDate = (range: MonitoringConfig['dateRange']) => {
    const d = new Date(now);
    switch(range) {
      case '24h': d.setHours(d.getHours() - 24); break;
      case '72h': d.setHours(d.getHours() - 72); break;
      case '7d': d.setDate(d.getDate() - 7); break;
      case '14d': d.setDate(d.getDate() - 14); break;
      case '21d': d.setDate(d.getDate() - 21); break;
      case '28d': d.setDate(d.getDate() - 28); break;
      case '3m': d.setMonth(d.getMonth() - 3); break;
      case 'custom': return config.customDateRange?.start || today;
    }
    return d.toISOString().split('T')[0];
  };

  const startDate = getStartDate(config.dateRange);
  const dateRangeText = config.dateRange === 'custom' 
    ? `from ${config.customDateRange?.start} to ${config.customDateRange?.end}`
    : `last ${config.dateRange}`;

  // Initialize empty report early to avoid "Cannot access before initialization"
  let currentReport: MonitoringReport = {
    query_period: dateRangeText,
    generated_at: new Date().toISOString(),
    summary: {
      total_articles_scanned: 0,
      total_relevant_articles: 0,
      total_highly_relevant: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      mixed: 0,
      high_risk: 0,
      critical_risk: 0,
      response_needed: 0,
      top_topics: [],
      top_sources: [],
      top_entities: [],
      top_municipalities_or_districts: []
    },
    articles: [],
    verification_checklist: []
  };

  const log = (msg: string) => {
    if (onProgress) {
      const timestamp = new Date().toLocaleTimeString('en-ZA', { hour12: false });
      onProgress(currentReport, `[${timestamp}] ${msg}`);
    }
  };

  log("SYSTEM: Initializing Eastern Cape Media Intelligence Engine v2.1...");
  
  // 0. Backend Health Check
  try {
    log("NETWORK: Verifying Backend API connectivity...");
    const healthResponse = await fetch('/api/health').catch(() => ({ ok: false }));
    if (!healthResponse.ok) {
      log("CRITICAL: Backend API (/api/health) is unreachable. RSS discovery will be disabled.");
      log("HINT: If deployed on Vercel/Netlify, ensure your Express server is correctly configured as a serverless function.");
    } else {
      log("NETWORK: Backend API confirmed online. RSS pipeline active.");
    }
  } catch (e) {
    log("WARNING: Health check failed. Proceeding with caution.");
  }

  const apiKey = (userApiKey && userApiKey.trim()) || getApiKey();
  
  // Debug logging (safe version)
  const keySource = userApiKey ? "User Provided (UI)" : "Environment Variable";
  log(`DEBUG: API Key Source: ${keySource}`);
  log(`DEBUG: Detected Key Length: ${apiKey.length}`);
  log(`DEBUG: Detected Key Prefix: ${apiKey.substring(0, 6)}...`);

  if (!apiKey || apiKey.length < 10) {
    log(`CRITICAL: No valid Gemini API Key detected (Length: ${apiKey.length}). Aborting monitoring.`);
    throw new Error("INVALID_API_KEY: No API key provided. Please set GEMINI_API_KEY or provide one in the UI.");
  }
  
  log("SYSTEM: API Key detected. Initializing Discovery...");
  log(`SYSTEM: Target Date Range: ${dateRangeText} (Start: ${startDate})`);
  
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";

  const getEnabledTerms = (category: { enabled: boolean, subSections: { [key: string]: boolean } }, catName: string) => {
    log(`PARSER: Analyzing enabled sub-sections for ${catName}...`);
    if (!category.enabled) {
      log(`PARSER: ${catName} category is disabled. Skipping logic branch.`);
      return [];
    }
    const terms = Object.entries(category.subSections)
      .filter(([_, enabled]) => enabled)
      .map(([name, _]) => name);
    log(`PARSER: Extracted ${terms.length} active monitoring terms from ${catName}.`);
    return terms;
  };

  const provincialTerms = [
    ...getEnabledTerms(config.provincial.executive, "Provincial Executive"),
    ...getEnabledTerms(config.provincial.delivery, "Provincial Delivery")
  ];

  const localTerms = [
    ...getEnabledTerms(config.local.executive, "Local Executive"),
    ...getEnabledTerms(config.local.delivery, "Local Delivery")
  ];

  log("LOGIC: Compiling Boolean search string with nested OR/AND operators...");
  const allTerms = [...provincialTerms, ...localTerms];
  const termsQuery = allTerms.length > 0 ? `(${allTerms.map(t => `"${t}"`).join(' OR ')})` : '(Government OR "Service Delivery")';
  
  log("LOGIC: Applying political party exclusion filters (-ANC, -DA, -EFF, -'Political Party')...");
  const partyExclusion = config.includePoliticalParties ? "" : "-ANC -DA -EFF -\"Political Party\"";

  const searchConstraint = config.dateRange === 'custom' && config.customDateRange
    ? `after:${config.customDateRange.start} before:${config.customDateRange.end}`
    : `after:${startDate}`;

  log(`LOGIC: Applied temporal constraint: ${searchConstraint}`);
  log(`LOGIC: Final query complexity: ${termsQuery.length} characters.`);

  log("NETWORK: Preparing Discovery Phase parallel requests to Google Search API...");
  
  // 1. Discovery Phase: Parallelized search strategy
  const searchQueries = [
    { name: "National & Regional News", query: `"Eastern Cape" ${termsQuery} ${partyExclusion} ${searchConstraint}` },
    { name: "Official & Local News", query: `"Eastern Cape" South Africa (site:gov.za OR news) ${termsQuery} ${partyExclusion} ${searchConstraint}` }
  ];

  const discoveryPromises = searchQueries.map(async (sq) => {
    try {
      const startTime = Date.now();
      log(`NETWORK: Dispatching search request for ${sq.name}...`);
      log(`QUERY: ${sq.query.substring(0, 80)}...`);
      
      const discoveryResponse = await callGeminiWithRetry(() => 
        ai.models.generateContent({
          model,
          contents: `Search for news articles matching: ${sq.query}. Ensure all results are from ${startDate} onwards.`,
          config: {
            tools: [{ googleSearch: {} }]
          }
        })
      );
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const groundingMetadata = discoveryResponse.candidates?.[0]?.groundingMetadata;
      const chunkCount = groundingMetadata?.groundingChunks?.length || 0;
      
      if (!groundingMetadata) {
        log(`WARNING: No grounding metadata returned for ${sq.name}. The Google Search tool may be disabled for this API key.`);
      } else {
        log(`DATA: Received ${chunkCount} raw grounding chunks from ${sq.name} in ${duration}s.`);
      }
      
      return {
        text: discoveryResponse.text || "",
        chunks: groundingMetadata?.groundingChunks || []
      };
    } catch (error: any) {
      log(`ERROR: Network failure for ${sq.name}. Code: ${error.code || 'UNKNOWN'}. Message: ${error.message}`);
      if (error.message === "QUOTA_EXHAUSTED") throw error;
      return { text: "", chunks: [] };
    }
  });

  const rssPromise = fetchRSSFeeds((status) => log(status));

  const [discoveryResultsArray, rssArticles] = await Promise.all([
    Promise.all(discoveryPromises),
    rssPromise
  ]);

  const totalDiscoveryChunks = discoveryResultsArray.reduce((acc, r) => acc + r.chunks.length, 0);
  log(`SYSTEM: Discovery phase complete. Found ${totalDiscoveryChunks} search chunks and ${rssArticles.length} RSS articles.`);

  if (totalDiscoveryChunks === 0 && rssArticles.length === 0) {
    log("CRITICAL: No data found from any source. Check your API key, search terms, or backend connectivity.");
  }

  log("LOGIC: Aggregating multi-source results and performing proactive URI verification...");
  
  // Convert RSS articles to chunks format
  const rssChunks = rssArticles.map(article => ({
    web: { title: article.title, uri: article.link },
    snippet: article.content
  }));

  const allChunks = [...discoveryResultsArray.flatMap(r => r.chunks), ...rssChunks];

  // Trusted domains for Eastern Cape / SA News
  const trustedDomains = [
    'dispatchlive.co.za',
    'heraldlive.co.za',
    'dailymaverick.co.za',
    'news24.com',
    'citizen.co.za',
    'iol.co.za',
    'timeslive.co.za',
    'groundup.org.za',
    'gov.za',
    'ecprov.gov.za'
  ];

  const uriToId = new Map<string, string>();
  const idToUri = new Map<string, string>();
  const idToData = new Map<string, { title: string; snippet: string; status: 'Verified' | 'Unverified' | 'Potentially Hallucinated' }>();

  allChunks.forEach((chunk: any) => {
    if (chunk.web?.uri) {
      const uri = chunk.web.uri;
      if (!uriToId.has(uri)) {
        const id = `REF_${uriToId.size + 1}`;
        uriToId.set(uri, id);
        idToUri.set(id, uri);
        
        // Proactive verification
        let status: 'Verified' | 'Unverified' | 'Potentially Hallucinated' = 'Unverified';
        try {
          const domain = new URL(uri).hostname.replace('www.', '');
          if (trustedDomains.some(td => domain.endsWith(td))) {
            status = 'Verified';
          } else if (uri.startsWith('http')) {
            status = 'Unverified';
          } else {
            status = 'Potentially Hallucinated';
          }
        } catch (e) {
          status = 'Potentially Hallucinated';
        }

        idToData.set(id, { 
          title: chunk.web.title || "Untitled", 
          snippet: chunk.snippet || "", 
          status 
        });
      }
    }
  });

  // Build the indexed context for the model
  const indexedContext = Array.from(idToData.entries()).map(([id, data]) => {
    return `[${id}] SOURCE: ${data.title}\nCONTENT: ${data.snippet}\nVERIFICATION: ${data.status}`;
  }).join("\n\n---\n\n");

  currentReport.summary.total_articles_scanned = uriToId.size;
  log(`SYSTEM: Discovery phase complete. ${uriToId.size} unique URIs identified and proactively verified.`);

  if (uriToId.size === 0 && !indexedContext) {
    currentReport.verification_checklist = [{ 
      domain: "System Wide", 
      status: "Zero Results", 
      findings_summary: "The discovery engine returned no relevant articles. This could be due to restrictive search terms, a missing API key, or backend connectivity issues." 
    }];
    log("SYSTEM: Monitoring Complete - Zero relevant articles identified in current cycle.");
    return currentReport;
  }

  log("SYSTEM: Initializing Semantic Verification Pipeline (Gemini 3 Flash Inference)...");

  const todayLong = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'long' }).format(now);

  // 2. Semantic Verification Loop - Parallelized batching
  const systemInstruction = `
    You are a Senior Media Intelligence Analyst for the Eastern Cape Office of the Premier.
    TODAY'S DATE IS: ${today} (${todayLong}).
    
    CRITICAL: You have been provided with an INDEXED CONTEXT where each article is prefixed with a Reference ID (e.g., [REF_1]).
    
    YOUR TASK:
    1. SEMANTIC VERIFICATION: Use the INDEXED CONTEXT to extract and structure articles relevant to the Eastern Cape Government for the period ${dateRangeText}.
    2. ZERO HALLUCINATION MAPPING: You MUST map each article to its corresponding Reference ID found in the brackets (e.g., [REF_1]).
    3. article_url FIELD: You MUST populate the "article_url" field with the EXACT Reference ID (e.g., "REF_1"). DO NOT write the actual URL string.
    4. url_verification_status: Use the status provided in the INDEXED CONTEXT for that Reference ID.
    5. DEDUPLICATION: Group same stories using 'duplicate_cluster_id'.
    6. CLASSIFICATION: Provide Governance Level, Tone, Reputational Risk, and Recommended Action.
    
    STRICT RULES:
    - NO FABRICATION: Only report on stories explicitly found in the INDEXED CONTEXT.
    - NO URL STRINGS: Never write a URL starting with http in the "article_url" field. ONLY use the REF_N IDs.
    - EXCLUDE political party news unless it directly impacts government administration.
    - EXCLUDE NATIONAL NEWS (CRITICAL): You MUST completely ignore and drop any articles about the President, Deputy President, National Treasury, SARS, Reserve Bank, or general national affairs UNLESS the article explicitly mentions a direct impact, influence, or event in the "Eastern Cape" province or its municipalities (e.g., Nelson Mandela Bay, Buffalo City, Bhisho, Makhanda, Mthatha). If it does not explicitly impact the Eastern Cape, DO NOT INCLUDE IT.
    - ENSURE all articles are from ${startDate} to ${today}.
  `;

  // Pre-filter IDs based on simple keyword matching to reduce token count and batch count
  const ecKeywords = [
    'eastern cape', 'ec ', 'bhisho', 'east london', 'gqeberha', 'mthatha', 'nelson mandela bay', 
    'buffalo city', 'makhanda', 'grahamstown', 'karoo', 'transkei', 'ciskei', 'wild coast',
    'mabuyane', 'premier', 'mec', 'bhisho', 'amatola', 'chris hani', 'joe gqabi', 'ortambo', 'alfred nzo'
  ];
  
  const filteredIds = Array.from(idToData.keys()).filter(id => {
    const data = idToData.get(id)!;
    const content = (data.title + ' ' + data.snippet).toLowerCase();
    return ecKeywords.some(kw => content.includes(kw));
  });

  log(`PIPELINE: Pre-filtering complete. ${filteredIds.length}/${idToData.size} articles passed heuristic relevance check.`);

  // Process in batches of 25, parallelized with a concurrency limit
  const batchSize = 25;
  const batchPromises: Promise<void>[] = [];
  
  for (let i = 0; i < filteredIds.length; i += batchSize) {
    const batchIds = filteredIds.slice(i, i + batchSize);
    const batchNum = Math.floor(i/batchSize) + 1;
    
    const batchContext = batchIds.map(id => {
      const data = idToData.get(id)!;
      return `[${id}] SOURCE: ${data.title}\nCONTENT: ${data.snippet}\nVERIFICATION: ${data.status}`;
    }).join("\n\n---\n\n");

    const processBatch = async () => {
      log(`PIPELINE: Dispatching Batch ${batchNum} to Gemini 3 Flash Inference Engine...`);
      const startTime = Date.now();

      try {
        const verificationResponse = await callGeminiWithRetry(() => 
          ai.models.generateContent({
            model,
            contents: `
              INDEXED CONTEXT FOR THIS BATCH:
              ${batchContext}
              
              Please structure this batch into the report format. Use the Reference IDs (e.g. REF_1) for "article_url".
            `,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: REPORT_SCHEMA
            }
          })
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        log(`DATA: Received inference response for Batch ${batchNum} in ${duration}s.`);

        if (verificationResponse.text) {
          let batchReport: MonitoringReport;
          try {
            batchReport = JSON.parse(verificationResponse.text) as MonitoringReport;
          } catch (e) {
            log(`ERROR: Failed to parse model response for Batch ${batchNum}. Skipping.`);
            return;
          }
          
          const verifiedArticles = batchReport.articles.map(article => {
            const realUri = idToUri.get(article.article_url);
            const originalData = idToData.get(article.article_url);
            
            if (realUri && originalData) {
              return { 
                ...article, 
                article_url: realUri, 
                url_verification_status: originalData.status 
              };
            }
            return null;
          }).filter((a): a is any => a !== null);

          // Atomic update to currentReport
          currentReport.articles = [...currentReport.articles, ...verifiedArticles];
          currentReport.verification_checklist = [...currentReport.verification_checklist, ...(batchReport.verification_checklist || [])];
          
          // Update summary stats (incremental update)
          currentReport.summary.total_relevant_articles = currentReport.articles.length;
          currentReport.summary.total_highly_relevant = currentReport.articles.filter(a => a.relevance_classification === 'Highly Relevant').length;
          currentReport.summary.positive = currentReport.articles.filter(a => a.tone_classification === 'Positive').length;
          currentReport.summary.neutral = currentReport.articles.filter(a => a.tone_classification === 'Neutral').length;
          currentReport.summary.negative = currentReport.articles.filter(a => a.tone_classification === 'Negative').length;
          currentReport.summary.mixed = currentReport.articles.filter(a => a.tone_classification === 'Mixed').length;
          currentReport.summary.high_risk = currentReport.articles.filter(a => a.reputational_risk === 'High').length;
          currentReport.summary.critical_risk = currentReport.articles.filter(a => a.reputational_risk === 'Critical').length;
          currentReport.summary.response_needed = currentReport.articles.filter(a => a.response_needed).length;
          
          // Merge entities/topics
          currentReport.summary.top_topics = Array.from(new Set([...currentReport.summary.top_topics, ...(batchReport.summary.top_topics || [])])).slice(0, 10);
          currentReport.summary.top_sources = Array.from(new Set([...currentReport.summary.top_sources, ...(batchReport.summary.top_sources || [])])).slice(0, 10);
          currentReport.summary.top_entities = Array.from(new Set([...currentReport.summary.top_entities, ...(batchReport.summary.top_entities || [])])).slice(0, 10);
          currentReport.summary.top_municipalities_or_districts = Array.from(new Set([...currentReport.summary.top_municipalities_or_districts, ...(batchReport.summary.top_municipalities_or_districts || [])])).slice(0, 10);

          log(`SYSTEM: Batch ${batchNum} integrated. Current relevant articles: ${currentReport.articles.length}`);
        }
      } catch (error: any) {
        log(`CRITICAL ERROR: Batch ${batchNum} failed permanently: ${error.message}`);
      }
    };

    batchPromises.push(processBatch());
    
    // Concurrency limit: Process 3 batches at a time to avoid rate limits
    if (batchPromises.length >= 3) {
      await Promise.all(batchPromises);
      batchPromises.length = 0;
    }
  }

  // Wait for remaining batches
  if (batchPromises.length > 0) {
    await Promise.all(batchPromises);
  }

  log("SYSTEM: Finalizing report structure and performing final integrity check...");
  log("SYSTEM: Monitoring Complete. Final report ready for review.");
  return currentReport;
}

export async function generateArticleSummary(article: any, userApiKey?: string): Promise<string> {
  const ai = userApiKey ? new GoogleGenAI({ apiKey: userApiKey }) : defaultAi;
  const model = "gemini-3-flash-preview";
  
  try {
    const response = await callGeminiWithRetry(() => 
      ai.models.generateContent({
        model,
        contents: `Generate an extremely concise, one-sentence summary (max 15 words) for this article that captures its core message:
        Title: ${article.article_title}
        Source: ${article.source_name}
        Context: ${article.summary_1_paragraph || 'No detailed summary available.'}`,
      })
    );
    
    return response.text?.trim() || "No summary generated.";
  } catch (error) {
    console.error("Failed to generate summary:", error);
    return "Failed to generate summary.";
  }
}
