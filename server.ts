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

async function startServer() {
  const app = express();
  const PORT = 3000;
  const parser = new Parser({
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
        console.log(`RSS FETCH: Fetching and parsing ${url} (Attempt ${attempt + 1})`);
        
        const response = await axios.get(url, {
          timeout: 60000,
          httpsAgent,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Referer': 'https://www.google.com/',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          validateStatus: () => true // Don't throw on HTTP errors
        });

        if (response.status !== 200) {
          console.error(`RSS FETCH HTTP ERROR: ${response.status} for ${url}`);
          if (response.status >= 500 || response.status === 429) {
            lastError = new Error(`HTTP ${response.status}`);
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
              continue;
            }
          }
          return res.status(response.status).json({ 
            error: `Source returned ${response.status}`,
            status: response.status 
          });
        }

        let xml = response.data;
        if (typeof xml !== 'string') {
          xml = JSON.stringify(xml); // Just in case axios auto-parsed it as JSON
        }
        
        // Advanced validation: Check the first 10 lines for HTML or error messages
        const first10Lines = xml.split('\n').slice(0, 10).join('\n').toLowerCase();
        if (
          first10Lines.includes('<!doctype html') || 
          first10Lines.includes('<html') || 
          first10Lines.includes('404 not found') ||
          first10Lines.includes('page not found') ||
          first10Lines.includes('access denied') ||
          first10Lines.includes('forbidden')
        ) {
          console.error(`RSS FETCH ERROR: Received HTML or error page instead of XML for ${url}`);
          return res.status(403).json({ error: "Access denied or invalid format (HTML/Error returned instead of XML)" });
        }

        // Advanced XML cleaning: remove everything before the first '<'
        const firstBracket = xml.indexOf('<');
        if (firstBracket > 0) {
          xml = xml.substring(firstBracket);
        }
        xml = xml.trim();

        // Fix for News24 feeds which omit the version attribute in the <rss> tag
        if (xml.includes('<rss') && !xml.includes('version=')) {
          xml = xml.replace('<rss', '<rss version="2.0"');
        }

        try {
          const feed = await parser.parseString(xml);
          return res.json(feed);
        } catch (parseError: any) {
          console.error(`RSS PARSE ERROR: ${parseError.message} for ${url}`);
          if (xml.toLowerCase().includes("forbidden") || xml.toLowerCase().includes("access denied") || xml.toLowerCase().includes("<html")) {
            return res.status(403).json({ error: "Access denied or invalid format (HTML returned instead of XML)" });
          }
          throw parseError;
        }
      } catch (error: any) {
        lastError = error;
        console.error(`RSS FETCH EXCEPTION: ${error.message} for ${url} (Attempt ${attempt + 1})`);
        
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
      }
    }

    res.status(500).json({ error: lastError?.message || "Failed to fetch RSS after retries" });
  });

  app.get("/api/rss-proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }
    try {
      console.log(`RSS PROXY: Fetching ${url}`);
      
      const response = await axios.get(url, {
        timeout: 30000,
        httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        validateStatus: () => true
      });
      
      if (response.status !== 200) {
        console.error(`RSS PROXY HTTP ERROR: ${response.status} for ${url}`);
        return res.status(response.status).json({ 
          error: `Source returned ${response.status}`,
          status: response.status 
        });
      }
      
      let xml = response.data;
      if (typeof xml !== 'string') {
        xml = JSON.stringify(xml);
      }
      
      // Advanced validation: Check the first 10 lines for HTML or error messages
      const first10Lines = xml.split('\n').slice(0, 10).join('\n').toLowerCase();
      if (
        first10Lines.includes('<!doctype html') || 
        first10Lines.includes('<html') || 
        first10Lines.includes('404 not found') ||
        first10Lines.includes('page not found') ||
        first10Lines.includes('access denied') ||
        first10Lines.includes('forbidden')
      ) {
        console.error(`RSS PROXY ERROR: Received HTML or error page instead of XML for ${url}`);
        return res.status(403).json({ error: "Access denied or invalid format (HTML/Error returned instead of XML)" });
      }
      
      // Fix for News24 feeds which omit the version attribute in the <rss> tag
      if (xml.includes('<rss') && !xml.includes('version=')) {
        xml = xml.replace('<rss', '<rss version="2.0"');
      }
      
      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error: any) {
      console.error(`RSS PROXY EXCEPTION: ${error.message} for ${url}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
