import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env variables
const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
}

const PORT = process.env.PORT || env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || env.SHOPIFY_STORE_DOMAIN || '';
const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || env.SHOPIFY_API_VERSION || '2025-01';

const NON_PRODUCT_BLOCKLIST = [
  'googleusercontent.com', 'blogger_img_proxy', 'blogspot.com', 'wordpress.com',
  'wp-content/uploads/202', 'pinimg.com', 'pinterest.com', 'vecteezy', 'freepik',
  'shutterstock', 'gettyimages', 'istockphoto', 'stock-photo', 'clipart', 'vector',
  'silhouette', 'coloring', 'craft', 'hobby', 'floral', 'leaf', 'leaves',
  'flower', 'tattoo', 'wallpaper', 'schemecolor', 'booster', 'escultura', 'tecmilenio',
  'edicom', 'almanac', 'gardening', 'plant', 'clipartkey', 'cleanpng', 'kissspng',
  'pngwing', 'pngtree', 'icon-icons', 'flaticon', 'depositphotos', '123rf', 'dreamstime',
  'craiyon.com', 'travel', 'tourist', 'tourism', 'attraction', 'attractions', 'destination',
  'destinations', 'monument', 'monuments', 'landmark', 'landmarks', 'vacation', 'scenery',
  'landscape', 'eiffel', 'taj-mahal', 'colosseum', 'machu-picchu', 'golden-gate', 'pyramid',
  'statue-of-liberty', 'tripadvisor', 'lonelyplanet', 'hotel', 'resort', 'flight', 'airline'
];

function normalizeAndCanonicalizeUrl(rawUrl) {
  try {
    let clean = rawUrl.trim().replace(/^http:\/\//i, 'https://');
    const u = new URL(clean);
    if (u.hostname.includes('shopify.com') || u.pathname.includes('/cdn/shop/')) {
      u.search = '';
      u.pathname = u.pathname.replace(/_[0-9]+x[0-9]+(?=\.[a-z0-9]+$)/i, '_1200x1200')
                             .replace(/_(?:small|thumb|compact|medium|large|grande)(?=\.[a-z0-9]+$)/i, '_1200x1200');
    } else if (u.hostname.includes('insitecloud.net') || u.pathname.includes('insitecloud.net')) {
      u.search = '';
      u.pathname = u.pathname.replace(/_(?:sm|md|thumb)(?=\.[a-z0-9]+$)/i, '_lg');
    } else if (u.pathname.includes('/stencil/')) {
      u.pathname = u.pathname.replace(/\/stencil\/\d+x\d+\//, '/stencil/1280x1280/').replace(/\/stencil\/\d+w\//, '/stencil/1280x1280/');
    } else {
      u.search = '';
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function getCanonicalAssetKey(url) {
  try {
    const u = new URL(url);
    const basename = u.pathname.split('/').pop() || '';
    const nameWithoutExt = basename.replace(/\.[a-z0-9]+$/i, '');
    const cleanCore = nameWithoutExt
      .replace(/_[0-9]+x[0-9]+$/i, '')
      .replace(/_(?:lg|md|sm|thumb|medium|large|grande|small)$/i, '')
      .replace(/[-_][a-f0-9]{16,64}$/i, '')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();
    return `${u.hostname}:${cleanCore}`;
  } catch {
    return url;
  }
}

function getImageDimensionsFromBuffer(buffer) {
  try {
    if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xFF) { offset++; continue; }
        const marker = buffer[offset + 1];
        if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        const len = buffer.readUInt16BE(offset + 2);
        offset += 2 + len;
      }
    }
    if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      if (buffer.toString('ascii', 12, 16) === 'VP8X' && buffer.length >= 30) {
        const width = 1 + buffer.readUIntLE(24, 3);
        const height = 1 + buffer.readUIntLE(27, 3);
        return { width, height };
      }
    }
  } catch {}
  return null;
}

function isLikelySquareProductImage(buffer) {
  const dims = getImageDimensionsFromBuffer(buffer);
  if (!dims) return true;
  if (dims.width < 400 || dims.height < 400) return false;
  const ratio = dims.width / dims.height;
  if (ratio < 0.80 || ratio > 1.25) return false;
  return true;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Access-Token, X-Shopify-Store, X-Shopify-Api-Version');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Health check
  if (pathname === '/health' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', app: 'WiseLine Catalog Studio', timestamp: new Date().toISOString() }));
    return;
  }

  // 2. Media Proxy
  if (pathname === '/api/media/proxy') {
    try {
      const targetUrl = parsedUrl.searchParams.get('url');
      if (!targetUrl || !targetUrl.startsWith('http')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid url parameter' }));
        return;
      }

      const imgRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': new URL(targetUrl).origin
        }
      });

      if (!imgRes.ok) {
        res.writeHead(imgRes.status, { 'Content-Type': 'text/plain' });
        res.end(`Proxy fetch failed: ${imgRes.statusText}`);
        return;
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400'
      });
      const arrayBuffer = await imgRes.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Image proxy error' }));
      }
    }
    return;
  }

  // 3. Media Scrape
  if (pathname === '/api/media/scrape' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const brand = String(payload.brand || '').trim();
        const sku = String(payload.sku || '').trim();

        if (!brand || !sku) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Brand and SKU required' }));
          return;
        }

        const candidates = [];
        const queries = [
          `"${brand}" "${sku}"`,
          `site:thetoolstore.ca "${sku}"`,
          `site:atlas-machinery.com "${sku}"`,
          `site:verkter.com "${sku}"`
        ];

        for (const q of queries) {
          try {
            const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&qft=+filterui:imagesize-large+filterui:aspect-square&form=HDRSC2`;
            const bingRes = await fetch(bingUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              signal: AbortSignal.timeout(3000)
            });
            if (bingRes.ok) {
              const html = await bingRes.text();
              const matches = html.match(/murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/g) || [];
              for (const m of matches) {
                const raw = m.replace(/murl&quot;:&quot;/, '').replace(/&quot;$/, '');
                if (raw.startsWith('http') && !candidates.includes(raw)) candidates.push(raw);
              }
            }
          } catch {}
          if (candidates.length >= 10) break;
        }

        const validImages = [];
        const seenKeys = new Set();
        const seenHashes = new Set();

        for (const rawUrl of candidates.slice(0, 15)) {
          const canonical = normalizeAndCanonicalizeUrl(rawUrl);
          const key = getCanonicalAssetKey(canonical);
          if (seenKeys.has(key)) continue;

          const lower = canonical.toLowerCase();
          if (NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k))) continue;

          try {
            const imgRes = await fetch(canonical, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              signal: AbortSignal.timeout(2500)
            });
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              if (buf.length > 5000 && isLikelySquareProductImage(buf)) {
                const hash = crypto.createHash('md5').update(buf.slice(0, 8192)).digest('hex');
                if (!seenHashes.has(hash)) {
                  seenHashes.add(hash);
                  seenKeys.add(key);
                  validImages.push(canonical);
                }
              }
            }
          } catch {}
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ images: validImages }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Scrape error' }));
      }
    });
    return;
  }

  // 4. AI Synthesize
  if (pathname === '/api/ai/synthesize' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const brand = String(payload.brand || '').trim();
        const sku = String(payload.sku || '').trim();
        const existingContext = payload.existingContext || {};

        if (!brand || !sku) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Brand and SKU are required.' }));
          return;
        }

        const apiKey = GEMINI_API_KEY;
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }));
          return;
        }

        // 1. Tool Taxonomy & Decoding Knowledge Base for Perfect Accuracy
        const TOOL_TAXONOMY_RULES = `
INDUSTRIAL TOOL SKU DECODING & FACT VERIFICATION RULES:
- MAKITA:
  * TW001G = 3/4" Square Drive High Torque Impact Wrench (40V Max XGT) - 1,330 ft-lbs / 1,800 N·m
  * TW002G = 1/2" Square Drive High Torque Impact Wrench (40V Max XGT) - 1,250 ft-lbs (1,700 N·m) max fastening, 1,620 ft-lbs (2,200 N·m) nut-busting
  * TW004G = 1/2" Square Drive Mid-Torque Impact Wrench (40V Max XGT) - Friction Ring
  * TW005G = 3/8" Square Drive Impact Wrench (40V Max XGT)
  * TW007G = 1/2" Square Drive Compact Impact Wrench (40V Max XGT) - Friction Ring
  * TW008G = 1/2" Square Drive Compact Impact Wrench (40V Max XGT) - Pin Detent
  * DTW1001 / XWT08 = 3/4" Square Drive (18V LXT)
  * DTW1002 / XWT07 = 1/2" Square Drive (18V LXT)
  * DTW700 / XWT17 = 1/2" Square Drive Mid-Torque (18V LXT)
  * DTW300 / XWT15 = 1/2" Square Drive Compact (18V LXT)
  * DTD153 / DTD172 / XDT19 = 1/4" Hex Cordless Impact Driver
  * Suffix 'Z' indicates Bare Tool / Tool Only (batteries/charger sold separately).
  * Suffix 'G' indicates 40V Max XGT platform; Suffix 'D'/'L' indicates 18V LXT platform.

- MILWAUKEE:
  * 2767 = M18 FUEL 1/2" High Torque Impact Wrench w/ Friction Ring
  * 2766 = M18 FUEL 1/2" High Torque Impact Wrench w/ Pin Detent
  * 2864 = M18 FUEL ONE-KEY 3/4" High Torque Impact Wrench
  * 2967 = M18 FUEL 1/2" High Torque Impact Wrench (Gen 2)
  * 2962 = M18 FUEL 1/2" Mid-Torque Impact Wrench
  * 2960 = M18 FUEL 3/8" Mid-Torque Impact Wrench
  * 2854 = M18 FUEL 3/8" Compact Impact Wrench
  * 2853 / 2953 = M18 FUEL 1/4" Hex Impact Driver
  * Suffix '-20' = Bare Tool / Tool Only; Suffix '-21'/'-22' = Battery Kit.

- DEWALT:
  * DCF900 = 20V MAX XR 1/2" High Torque Impact Wrench w/ Hog Ring
  * DCF899 = 20V MAX XR 1/2" High Torque Impact Wrench w/ Detent Pin
  * DCF961 = 20V MAX XR 1/2" Ultra High Torque Impact Wrench
  * DCF901 = 12V MAX 1/2" Impact Wrench; DCF903 = 12V MAX 3/8" Impact Wrench
  * DCF921 = 20V MAX ATOMIC 1/2" Impact Wrench; DCF923 = 20V MAX ATOMIC 3/8" Impact Wrench
  * DCF850 / DCF887 = 20V MAX 1/4" Hex Impact Driver
  * Suffix 'B' = Bare Tool; Suffix 'P2'/'D1'/'E2' = Battery Kit.

- KNIPEX:
  * 87 01 250 = Cobra Water Pump Pliers 250mm (10")
  * 87 51 180 = Cobra Extra Slim Water Pump Pliers 180mm (7-1/4")
  * 86 01 250 = Pliers Wrench 250mm (10")
  * 74 01 200 = High Leverage Diagonal Cutters 200mm (8")
  * Suffix 'SBA' / 'BK' = Blister Pack / Retail Hang Card.
`;

        // 2. Live Web Crawl & Source Retrieval across Canadian Tool Catalogs
        const cleanSku = sku.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
        const skuParts = sku.split(/[^a-zA-Z0-9]+/).filter(p => p.length >= 3).map(p => p.toLowerCase());
        const brandLower = brand.toLowerCase();

        const searchUrls = [
          `https://www.atlas-machinery.com/search.php?search_query=${encodeURIComponent(sku)}`,
          `https://thetoolstore.ca/search?type=product&q=${encodeURIComponent(sku)}`,
          `https://www.bcfasteners.com/?s=${encodeURIComponent(sku)}&post_type=product`,
          `https://www.mississaugahardware.com/search?q=${encodeURIComponent(sku)}`
        ];

        let crawledEvidence = '';
        const crawledSourceUrls = [];
        const discoveredImages = [];

        await Promise.allSettled(searchUrls.map(async (sUrl) => {
          try {
            const crawlRes = await fetch(sUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              signal: AbortSignal.timeout(2000)
            });
            if (crawlRes.ok) {
              const html = await crawlRes.text();
              if (html.length > 300) {
                crawledSourceUrls.push(sUrl);
                const cleanText = html
                  .replace(/<script[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[\s\S]*?<\/style>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .slice(0, 3000);
                crawledEvidence += `\n\n[Live Source: ${sUrl}]\n${cleanText}`;

                const imgs = html.match(/https:\/\/[^\s"']+\.(?:jpg|png|webp)/gi) || [];
                for (const img of Array.from(new Set(imgs))) {
                  const imgLower = img.toLowerCase();
                  if ((skuParts.some(p => imgLower.includes(p)) || imgLower.includes(cleanSku)) && !NON_PRODUCT_BLOCKLIST.some(k => imgLower.includes(k))) {
                    discoveredImages.push(img);
                  }
                }
              }
            }
          } catch (e) {}
        }));

        // Universal Direct Exact-Image Search
        try {
          const bQueries = [
            `"${brand}" "${sku}"`,
            `"${brand}" "${sku.replace(/[^a-zA-Z0-9]/g, '')}"`,
            `site:thetoolstore.ca "${sku}"`,
            `site:atlas-machinery.com "${sku}"`
          ];

          for (const bq of bQueries) {
            const bUrl = `https://www.bing.com/images/async?q=${encodeURIComponent(bq)}&first=0&count=20&mmasync=1`;
            const bRes = await fetch(bUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              signal: AbortSignal.timeout(2000)
            });
            if (bRes.ok) {
              const bHtml = await bRes.text();
              const matches = bHtml.match(/murl&quot;:&quot;([^&"]+)/gi) || [];
              const seenAssetKeys = new Set(discoveredImages.map(getCanonicalAssetKey));
              for (const m of matches.slice(0, 18)) {
                let imgUrl = m.replace(/murl&quot;:&quot;/i, '').replace(/\\\//g, '/').trim();
                if (imgUrl.match(/\.(jpg|jpeg|png|webp)($|\?)/i) && !imgUrl.includes('bing.com') && !imgUrl.includes('microsoft.com')) {
                  const lower = imgUrl.toLowerCase();
                  if (!lower.includes('logo') && !lower.includes('icon') && !lower.includes('badge') && !lower.includes('banner') && !NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k))) {
                    const canonical = normalizeAndCanonicalizeUrl(imgUrl);
                    const assetKey = getCanonicalAssetKey(canonical);
                    if (!seenAssetKeys.has(assetKey)) {
                      seenAssetKeys.add(assetKey);
                      discoveredImages.push(canonical);
                    }
                  }
                }
              }
            }
            if (discoveredImages.length >= 15) break;
          }
        } catch (e) {}

        // Verify Images
        const verifiedImages = [];
        const seenKeys = new Set();
        const seenHashes = new Set();

        for (const rawUrl of discoveredImages.slice(0, 15)) {
          const canonical = normalizeAndCanonicalizeUrl(rawUrl);
          const key = getCanonicalAssetKey(canonical);
          if (seenKeys.has(key)) continue;

          try {
            const imgRes = await fetch(canonical, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              signal: AbortSignal.timeout(2000)
            });
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              if (buf.length > 5000 && isLikelySquareProductImage(buf)) {
                const hash = crypto.createHash('md5').update(buf.slice(0, 8192)).digest('hex');
                if (!seenHashes.has(hash)) {
                  seenHashes.add(hash);
                  seenKeys.add(key);
                  verifiedImages.push(canonical);
                }
              }
            }
          } catch {}
        }

        // 3. Build Precision Prompt with Industrial Tool Taxonomy and Strict Fact Verification
        const prompt = `Act as the Master Industrial Tool Data Architect and Chief Catalog Specialist for Wise Line Tools (an authorized premier Canadian tool distributor).
You must research, verify, organize, and synthesize complete, authoritative, 100% accurate Shopify product catalog data for: "${brand} ${sku}".

${TOOL_TAXONOMY_RULES}

LIVE CRAWLED DISTRIBUTOR EVIDENCE:
${crawledEvidence || 'No live web crawl evidence retrieved. Base synthesis on verified manufacturer catalog standards for this exact brand and SKU.'}

CRITICAL ACCURACY DIRECTIVES (ZERO-HALLUCINATION ENFORCEMENT):
1. ANVIL / DRIVE SIZE & SPECIFICATION ACCURACY:
   - You MUST determine the exact drive/anvil size (e.g. 1/2" Square Drive vs 3/8" Square Drive vs 3/4" Square Drive vs 1/4" Hex).
   - If SKU is Makita TW002GZ, it is strictly 1/2" High Torque (1,250 ft-lbs / 1,700 N·m fastening, 1,620 ft-lbs / 2,200 N·m nut-busting), NOT 3/8".
2. VOLTAGE PLATFORM: Identify the exact battery system (e.g. 40Vmax XGT, 18V LXT, 20V MAX XR, M18 FUEL, 18V PROFACTOR).
3. BARE TOOL VS KIT: Explicitly state in the Title and Description whether this is Bare Tool / Tool Only (e.g. Makita 'Z', Milwaukee '-20', DeWalt 'B') or a Kit with batteries/charger.
4. CANADIAN PRICING (CAD): Provide realistic Canadian distributor MSRP in CAD (e.g. "449.00").
5. INDUSTRIAL METADATA:
   - Accurate UPC/EAN barcode (12-13 digits)
   - Real net tool weight in grams
   - 2-letter Country of Origin (e.g. "JP", "DE", "US", "MX", "CN", "TW")
   - Harmonized Tariff HS Code (e.g. "8467.29" for power tools, "8204.11" for hand tools)
   - Google Product Category & Product Type
   - Comprehensive HTML Description (body_html) with <h3>Features</h3>, <h3>Specifications</h3><table>...</table>, and <h3>Includes</h3>

OUTPUT STRICTLY A VALID JSON OBJECT:
{
  "title": "...",
  "price_cad": "...",
  "body_html": "...",
  "barcode": "...",
  "weight_grams": "...",
  "country_of_origin": "...",
  "hs_code": "...",
  "google_category": "...",
  "product_type": "...",
  "tags": "...",
  "source_urls": ["..."]
}`;

        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const modelsToTry = [
          'gemini-3.5-flash-lite',
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'gemini-3.7-flash'
        ];

        let parsedData = null;
        for (const m of modelsToTry) {
          try {
            const resAi = await ai.models.generateContent({
              model: m,
              contents: prompt,
              config: { temperature: 0.05, responseMimeType: 'application/json' }
            });
            if (resAi.text) {
              parsedData = JSON.parse(resAi.text);
              break;
            }
          } catch (err) {
            console.warn(`Model ${m} attempt:`, err.message);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          data: parsedData,
          images: verifiedImages
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Synthesis failed' }));
      }
    });
    return;
  }

  // 5. Shopify GraphQL Proxy
  if (pathname === '/api/shopify/graphql' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const storeDomain = (req.headers['x-shopify-store']) || SHOPIFY_STORE_DOMAIN || '';
        const accessToken = (req.headers['x-shopify-access-token']) || SHOPIFY_ADMIN_ACCESS_TOKEN || '';
        const apiVersion = (req.headers['x-shopify-api-version']) || SHOPIFY_API_VERSION || '2025-01';

        if (!storeDomain || !accessToken) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errors: [{ message: 'Missing Shopify Store Domain or Admin Access Token.' }] }));
          return;
        }

        let cleanStore = storeDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (!cleanStore.includes('.')) cleanStore += '.myshopify.com';

        const targetUrl = `https://${cleanStore}/admin/api/${apiVersion}/graphql.json`;
        const shopifyRes = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken.trim()
          },
          body: body || '{}'
        });

        const data = await shopifyRes.text();
        res.writeHead(shopifyRes.status, { 'Content-Type': 'application/json' });
        res.end(data);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errors: [{ message: err.message || 'Shopify proxy error' }] }));
      }
    });
    return;
  }

  // 6. Serve Static Dist files (Vite production build)
  const distDir = path.join(__dirname, 'dist');
  let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('WiseLine Catalog Studio: Please run `npm run build` to generate the production assets.');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 WiseLine Catalog Studio is running on port ${PORT}`);
  console.log(`🌐 Local:   http://localhost:${PORT}`);
  console.log(`🌐 Network: http://0.0.0.0:${PORT}`);
  console.log(`====================================================`);
});
