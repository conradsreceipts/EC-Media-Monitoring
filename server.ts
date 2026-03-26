import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Parser from 'rss-parser';
import axios from 'axios';
import https from 'https';

// Allow fetching from sites with strict or invalid TLS certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  minVersion: 'TLSv1',
  keepAlive: true,
  timeout: 60000
});

const app = express();
export default app;

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  }
});

app.use(express.json());

// API routes - Registered synchronously to ensure they are available immediately
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    host: req.headers.host,
    platform: process.env.VERCEL ? 'Vercel' : 'Standard'
  });
});

app.get("/api/rss-fetch", async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const maxRetries = 2;
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`RSS FETCH: Fetching ${url} (Attempt ${attempt + 1})`);
      
      const response = await axios.get(url, {
        timeout: 25000, // Slightly shorter than Vercel timeout
        httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': 'https://www.google.com/',
        },
        validateStatus: (status) => status < 500 // Allow 4xx to be handled
      });

      if (response.status !== 200) {
        throw new Error(`Upstream returned HTTP ${response.status}`);
      }

      let xml = response.data;
      if (typeof xml !== 'string') {
        xml = typeof xml === 'object' ? JSON.stringify(xml) : String(xml);
      }
      
      if (!xml || xml.length < 50) {
        throw new Error("Empty or too short response from source");
      }

      // Basic check for HTML
      const trimmedXml = xml.trim().toLowerCase();
      if (trimmedXml.startsWith('<!doctype html') || trimmedXml.startsWith('<html')) {
        return res.status(403).json({ 
          error: "Source returned HTML instead of XML",
          details: "This usually means the site is blocking scrapers or requires a real browser session."
        });
      }

      // Clean XML - remove any leading junk
      const firstBracket = xml.indexOf('<');
      if (firstBracket > 0) xml = xml.substring(firstBracket);
      xml = xml.trim();

      // Fix News24 and other feeds that might omit version
      if (xml.includes('<rss') && !xml.includes('version=')) {
        xml = xml.replace('<rss', '<rss version="2.0"');
      }

      try {
        const feed = await parser.parseString(xml);
        return res.json(feed);
      } catch (parseError: any) {
        console.error(`RSS PARSE ERROR: ${parseError.message} for ${url}`);
        throw new Error(`Failed to parse RSS content: ${parseError.message}`);
      }
      
    } catch (error: any) {
      lastError = error;
      const errorCode = error.code || 'UNKNOWN';
      const status = error.response?.status;
      
      console.error(`RSS FETCH ERROR [${errorCode}]: ${error.message} (Status: ${status}) for ${url}`);
      
      // Retry on network errors or 5xx
      if (attempt < maxRetries && (errorCode === 'ECONNABORTED' || errorCode === 'ETIMEDOUT' || !status || status >= 500)) {
        const delay = 1000 * (attempt + 1);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }

  const finalStatus = lastError?.response?.status || 500;
  res.status(finalStatus).json({ 
    error: lastError?.message || "Failed to fetch RSS",
    code: lastError?.code,
    url: url,
    details: lastError?.response?.data ? String(lastError.response.data).substring(0, 200) : undefined
  });
});

app.get("/api/rss-proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: "URL is required" });
  
  try {
    const response = await axios.get(url, {
      timeout: 20000,
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      responseType: 'text'
    });
    
    res.set('Content-Type', 'application/xml');
    res.send(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen if we're not in a serverless environment (like Vercel)
  if (!process.env.VERCEL || process.env.RENDER) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
