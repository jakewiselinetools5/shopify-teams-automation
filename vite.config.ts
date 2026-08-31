import path from 'path';
import crypto from 'crypto';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const NON_PRODUCT_BLOCKLIST = [
  'googleusercontent.com', 'blogger_img_proxy', 'blogspot.com',
  'pinimg.com', 'pinterest.com', 'vecteezy', 'freepik',
  'shutterstock', 'gettyimages', 'istockphoto', 'stock-photo', 'clipart', 'vector',
  'silhouette', 'coloring', 'colouring', 'craft', 'hobby', 'floral', 'leaf', 'leaves',
  'flower', 'tattoo', 'wallpaper', 'schemecolor', 'booster', 'escultura', 'tecmilenio',
  'edicom', 'almanac', 'gardening', 'plant', 'clipartkey', 'cleanpng', 'kissspng',
  'pngwing', 'pngtree', 'icon-icons', 'flaticon', 'depositphotos', '123rf', 'dreamstime',
  'craiyon.com', 'travel', 'tourist', 'tourism', 'attraction', 'attractions', 'destination',
  'destinations', 'monument', 'monuments', 'landmark', 'landmarks', 'vacation', 'scenery',
  'landscape', 'eiffel', 'taj-mahal', 'colosseum', 'machu-picchu', 'golden-gate', 'pyramid',
  'statue-of-liberty', 'tripadvisor', 'lonelyplanet', 'hotel', 'resort', 'flight', 'airline',
  'pinata', 'piñata', 'drawing', 'sketch', 'diagram', 'meme', 'book', 'covers',
  'slideshare', 'etsy', 'printable', 'worksheet', 'logotypes', 'storyblok', 'illustration',
  'line-art', 'lineart', 'cartoon', 'comic', 'anime', 'manga', 'avatar', 'profile',
  'a-z-animals.com', 'britannica.com', 'pixabay.com', 'freerangestock.com', 'nationalgeographic.com',
  'animalia.bio', 'inaturalist.org', 'animaldiversity.org', 'thoughtco.com', 'treehugger.com',
  'worldwildlife.org', 'earth.com', 'zooborns.com', 'safari.com', 'facts.net', 'starstruckastrology',
  'oxen', 'aurochs', 'cattle', 'cow', 'cows', 'bovine', 'animal', 'animals', 'livestock',
  'wildlife', 'fauna', 'mammal', 'mammals', 'species', 'pet', 'pets', 'horn', 'horns',
  'pasture', 'grassland', 'ranch', 'habitat', 'breed', 'breeds', 'roof', 'rooftop',
  'window', 'windows', 'facade', 'building', 'buildings', 'architecture', 'calendar', 'zodiac', 'astrology'
];

function normalizeAndCanonicalizeUrl(rawUrl: string): string {
  try {
    let clean = rawUrl.trim().replace(/^http:\/\//i, 'https://');
    const u = new URL(clean);
    
    // Shopify upscaler & query stripper
    if (u.hostname.includes('shopify.com') || u.pathname.includes('/cdn/shop/')) {
      u.search = '';
      u.pathname = u.pathname.replace(/_[0-9]+x[0-9]+(?=\.[a-z0-9]+$)/i, '_1200x1200')
                             .replace(/_(?:small|thumb|compact|medium|large|grande)(?=\.[a-z0-9]+$)/i, '_1200x1200');
    } else if (u.hostname.includes('insitecloud.net') || u.pathname.includes('insitecloud.net')) {
      // InsiteCloud upscaler: _sm, _md -> _lg
      u.search = '';
      u.pathname = u.pathname.replace(/_(?:sm|md|thumb)(?=\.[a-z0-9]+$)/i, '_lg');
    } else if (u.pathname.includes('/stencil/')) {
      // BigCommerce upscaler
      u.pathname = u.pathname.replace(/\/stencil\/\d+x\d+\//, '/stencil/1280x1280/').replace(/\/stencil\/\d+w\//, '/stencil/1280x1280/');
    } else {
      // Strip cache-busting search query parameters
      u.search = '';
    }

    return u.toString();
  } catch (e) {
    return rawUrl;
  }
}

function getCanonicalAssetKey(url: string): string {
  try {
    const u = new URL(url);
    let pathname = u.pathname.toLowerCase();
    pathname = pathname.replace(/_(?:sm|md|lg|thumb|medium|large|small|_1200x1200)(?=\.[a-z0-9]+$)/i, '');
    const filename = pathname.split('/').pop() || '';
    return `${u.hostname}/${filename}`;
  } catch (e) {
    return url.toLowerCase();
  }
}

// Fast image dimension reader from Buffer (JPEG, PNG, WEBP, GIF)
function getImageDimensions(buffer: Buffer): { width: number; height: number; type: string } | null {
  if (!buffer || buffer.length < 24) return null;

  // PNG: Width at [16..19], Height at [20..23]
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      type: 'png'
    };
  }

  // GIF: Width at [6..7], Height at [8..9]
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
      type: 'gif'
    };
  }

  // WEBP:
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') {
    const chunk = buffer.subarray(12, 16).toString();
    if (chunk === 'VP8 ') {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height, type: 'webp' };
    } else if (chunk === 'VP8X') {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      return { width, height, type: 'webp' };
    }
  }

  // JPEG: Scan for SOF markers (SOF0 = 0xFFC0, SOF2 = 0xFFC2, etc.)
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xFF) break;
      const marker = buffer[offset + 1];
      const len = buffer.readUInt16BE(offset + 2);
      if (
        (marker >= 0xC0 && marker <= 0xC3) ||
        (marker >= 0xC5 && marker <= 0xC7) ||
        (marker >= 0xC9 && marker <= 0xCB) ||
        (marker >= 0xCD && marker <= 0xCF)
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height, type: 'jpeg' };
      }
      offset += 2 + len;
    }
  }

  return null;
}

function isValidProductImage(dims: { width: number; height: number } | null): boolean {
  if (!dims || !dims.width || !dims.height) return false;
  // Resolution check: must be high quality (at least 450x450px, ideally >= 800px)
  if (dims.width < 450 || dims.height < 450) return false;
  // Aspect ratio check: ensure it is a square image (ratio between 0.80 and 1.25)
  const ratio = dims.width / dims.height;
  if (ratio < 0.80 || ratio > 1.25) return false;
  return true;
}

const mediaPlugin = (): Plugin => ({
  name: 'media-scraper-and-proxy',
  configureServer(server) {
    // 1. Local Image Proxy (bypasses hotlink & CORS blocks reliably)
    server.middlewares.use('/api/media/proxy', async (req, res) => {
      try {
        const parsedUrl = new URL(req.url || '', 'http://localhost:3000');
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
            'Accept-Language': 'en-US,en;q=0.9',
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
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400'
        });

        const arrayBuffer = await imgRes.arrayBuffer();
        res.end(Buffer.from(arrayBuffer));
      } catch (err: any) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || 'Image proxy error' }));
        }
      }
    });

    // 2. Server-Side Manufacturer Image Scraper & Verifier
    server.middlewares.use('/api/media/scrape', async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const brand = String(payload.brand || '').trim();
          const sku = String(payload.sku || '').trim();
          const candidateUrls: string[] = Array.isArray(payload.candidateUrls) ? payload.candidateUrls : [];

          const validImages: string[] = [];
          const seenAssetKeys = new Set<string>();
          const seenHashes = new Set<string>();
          const checked = new Set<string>();
          const negativeKeywords = [
            'logo', 'icon', 'badge', 'banner', 'avatar', 'payment', 'cart',
            'checkout', 'rating', 'star', 'footer', 'header', 'favicon',
            'arrow', 'button', 'sprite', 'placeholder', 'blank', 'loading',
            'baffin', 'eiger', 'chugach', 'sweeper-tow', 'sweeper-forklift', 'sweeper-trailer',
            ...NON_PRODUCT_BLOCKLIST
          ];
          const cleanSku = sku.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanMfrSku = sku.replace(/^[A-Z]{2,4}-/i, '');
          const baseNumbers = cleanMfrSku.replace(/[^0-9]/g, '').slice(0, 4);

          const addValidImage = (url: string, buf?: Buffer) => {
            const canonical = normalizeAndCanonicalizeUrl(url);
            const assetKey = getCanonicalAssetKey(canonical);
            if (seenAssetKeys.has(assetKey)) return;

            if (buf) {
              const hash = crypto.createHash('md5').update(buf).digest('hex');
              if (seenHashes.has(hash)) return;
              seenHashes.add(hash);
            }

            seenAssetKeys.add(assetKey);
            validImages.push(canonical);
          };

          // 1. First prioritize authentic candidate URLs passed from deep crawl
          for (const cand of candidateUrls) {
            if (cand && typeof cand === 'string' && cand.startsWith('http')) {
              const lower = cand.toLowerCase();
              if (!negativeKeywords.some(k => lower.includes(k))) {
                addValidImage(cand);
              }
            }
          }

          const WRONG_KIT_TERMS = [
            'combi-drill', 'hammer-bare', 'dcd996', 'dch273', 'tstak', 'dck299', 'dck590',
            'dck694', 'dcd791', 'dcd796', 'dcd998', 'dcf887', 'dcf850', 'circular-saw', 'reciprocating-saw',
            'p2t', '-gb', '-qw', '-xe', 'akcdn.net', 'dewaltvietnam', 'autozone', 'bitsdrill', 'toolsgiant'
          ];

          // 2. Query Bing Image Search only if we need more images, with strict verification
          if (validImages.length < 8) {
            try {
              const query = `"${brand}" "${cleanMfrSku}"`;
              const bingUrl = `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=0&count=18&mmasync=1`;
              const bingRes = await fetch(bingUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(2500)
              });
              if (bingRes.ok) {
                const bingHtml = await bingRes.text();
                const matches = bingHtml.match(/murl&quot;:&quot;([^&"]+)/gi) || [];
                const candidateImgUrls: string[] = [];
                for (const m of matches.slice(0, 18)) {
                  let imgUrl = m.replace(/murl&quot;:&quot;/i, '').replace(/\\\//g, '/').trim();
                  if (imgUrl.match(/\.(jpg|jpeg|png|webp)($|\?)/i) && !imgUrl.includes('bing.com') && !imgUrl.includes('microsoft.com')) {
                    const lower = imgUrl.toLowerCase();
                    if (WRONG_KIT_TERMS.some(term => lower.includes(term))) continue;
                    if (cleanMfrSku.toUpperCase().endsWith('P1') && (lower.includes('p2') || lower.includes('p2t'))) continue;
                    if (!negativeKeywords.some(k => lower.includes(k))) {
                      const hasMatch = lower.includes(cleanMfrSku.toLowerCase()) || 
                                       (baseNumbers.length >= 3 && lower.includes(baseNumbers)) || 
                                       lower.includes(brand.toLowerCase());
                      if (hasMatch) {
                        candidateImgUrls.push(imgUrl);
                      }
                    }
                  }
                }

                // Validate images in parallel with fast timeout
                await Promise.allSettled(candidateImgUrls.slice(0, 10).map(async (imgUrl) => {
                  try {
                    const imgRes = await fetch(imgUrl, {
                      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                      signal: AbortSignal.timeout(1500)
                    });
                    if (imgRes.ok && (imgRes.headers.get('content-type') || '').startsWith('image/')) {
                      const buf = Buffer.from(await imgRes.arrayBuffer());
                      const dims = getImageDimensions(buf);
                      if (isValidProductImage(dims)) {
                        addValidImage(imgUrl, buf);
                      }
                    }
                  } catch (e) {}
                }));
              }
            } catch (e) {}
          }

          // 2. Query DuckDuckGo search for official manufacturer and distributor pages
          try {
            const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const ddgRes = await fetch(ddgUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              signal: AbortSignal.timeout(3500)
            });
            if (ddgRes.ok) {
              const html = await ddgRes.text();
              const linkRegex = /<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"/gi;
              let m;
              while ((m = linkRegex.exec(html)) !== null) {
                let u = m[1];
                if (u.includes('uddg=')) {
                  u = decodeURIComponent(u.split('uddg=')[1].split('&')[0]);
                }
                if (u.startsWith('http') && !u.includes('duckduckgo.com') && !u.includes('youtube.com') && !u.includes('facebook.com') && !u.includes('amazon.')) {
                  discoveredPages.push(u);
                }
              }
            }
          } catch (e) {}

          for (const pageUrl of Array.from(new Set(discoveredPages)).slice(0, 6)) {
            if (validImages.length >= 10) break;
            try {
              // Direct image URL check
              if (pageUrl.match(/\.(jpg|jpeg|png|webp)($|\?)/i)) {
                if (!checked.has(pageUrl)) {
                  checked.add(pageUrl);
                  const lower = pageUrl.toLowerCase();
                  if (!negativeKeywords.some(k => lower.includes(k))) {
                    try {
                      const imgRes = await fetch(pageUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        signal: AbortSignal.timeout(2500)
                      });
                      if (imgRes.ok && (imgRes.headers.get('content-type') || '').startsWith('image/')) {
                        const buf = Buffer.from(await imgRes.arrayBuffer());
                        const dims = getImageDimensions(buf);
                        if (isValidProductImage(dims)) {
                          addValidImage(pageUrl);
                        }
                      }
                    } catch (e) {}
                  }
                }
                continue;
              }

              // Web Page Scrape
              const pageRes = await fetch(pageUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },
                signal: AbortSignal.timeout(3500)
              });

              if (!pageRes.ok) continue;
              const html = await pageRes.text();

              // 1. og:image
              const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                              html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
              if (ogMatch && ogMatch[1] && ogMatch[1].startsWith('http')) {
                const ogUrl = ogMatch[1];
                if (!negativeKeywords.some(k => ogUrl.toLowerCase().includes(k))) {
                  try {
                    const imgRes = await fetch(ogUrl, {
                      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                      signal: AbortSignal.timeout(2500)
                    });
                    if (imgRes.ok && (imgRes.headers.get('content-type') || '').startsWith('image/')) {
                      const buf = Buffer.from(await imgRes.arrayBuffer());
                      const dims = getImageDimensions(buf);
                      if (isValidProductImage(dims)) {
                        addValidImage(ogUrl);
                      }
                    }
                  } catch (e) {}
                }
              }

              // 2. JSON-LD structured data images
              const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
              for (const jm of jsonLdMatches) {
                try {
                  const rawJson = jm.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
                  const parsed = JSON.parse(rawJson);
                  const ldImages = Array.isArray(parsed.image) ? parsed.image : [parsed.image];
                  for (const ldi of ldImages) {
                    const imgUrl = typeof ldi === 'string' ? ldi : ldi?.url;
                    if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
                      const lower = imgUrl.toLowerCase();
                      if (!negativeKeywords.some(k => lower.includes(k))) {
                        try {
                          const imgRes = await fetch(imgUrl, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                            signal: AbortSignal.timeout(2500)
                          });
                          if (imgRes.ok && (imgRes.headers.get('content-type') || '').startsWith('image/')) {
                            const buf = Buffer.from(await imgRes.arrayBuffer());
                            const dims = getImageDimensions(buf);
                            if (isValidProductImage(dims)) {
                              addValidImage(imgUrl);
                            }
                          }
                        } catch (e) {}
                      }
                    }
                  }
                } catch (e) {}
              }

              // 3. Match all image URLs in HTML
              const imgMatches = html.match(/(?:src|href|content|data-src|data-zoom-image)=["'](https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi) || [];
              const rawUrls = imgMatches.map(m => m.replace(/^(?:src|href|content|data-src|data-zoom-image)=["']/, '').replace(/["']$/, ''));

              for (let img of rawUrls) {
                if (checked.has(img)) continue;
                checked.add(img);

                const lower = img.toLowerCase();

                // Skip non-product assets
                if (negativeKeywords.some(k => lower.includes(k))) continue;

                // Relevance check: product galleries, files, media catalog, or SKU tokens
                const isRelevant = 
                  skuParts.some(p => lower.includes(p)) ||
                  lower.includes(cleanSku) ||
                  lower.includes('/products/') ||
                  lower.includes('/product/') ||
                  lower.includes('/files/') ||
                  lower.includes('/stencil/') ||
                  lower.includes('/catalog/product/');

                if (!isRelevant) continue;

                try {
                  const imgRes = await fetch(img, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    signal: AbortSignal.timeout(2500)
                  });
                  if (imgRes.ok && (imgRes.headers.get('content-type') || '').startsWith('image/')) {
                    const buf = Buffer.from(await imgRes.arrayBuffer());
                    const dims = getImageDimensions(buf);
                    if (isValidProductImage(dims)) {
                      addValidImage(img);
                      if (validImages.length >= 10) break;
                    }
                  }
                } catch (e) {}
              }
            } catch (e) {}
            if (validImages.length >= 10) break;
          }

          if (!res.headersSent) {
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ images: validImages }));
          }
        } catch (err: any) {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ images: [], error: err.message }));
          }
        }
      });
    });
  }
});

const geminiAiPlugin = (env: Record<string, string>): Plugin => ({
  name: 'gemini-ai-synthesis',
  configureServer(server) {
    server.middlewares.use('/api/ai/synthesize', async (req, res) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const brand = String(payload.brand || '').trim();
          const sku = String(payload.sku || '').trim();
          const systemTitleHint = String(payload.systemTitleHint || '').trim();
          const existingContext = payload.existingContext || {};

          if (!brand || !sku) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Brand and SKU are required.' }));
            return;
          }

          const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
          if (!apiKey) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server.' }));
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
  * 2572 / 2572B = M12 AIRSNAKE™ Drain Cleaning Air Gun (Clears 1" to 4" drain lines with powered air up to 50 PSI, leaves fixtures intact)
  * 2470 = M12 Cordless Plastic Pipe Shear
  * 2471 = M12 Cordless Copper Tubing Cutter
  * 2771 = M18 Cordless Transfer Pump
  * 2821 / 2822 = M18 FUEL SAWZALL® Reciprocating Saw
  * 2526 = M12 FUEL Oscillating Multi-Tool
  * 2836 = M18 FUEL Oscillating Multi-Tool
  * 2522 = M12 FUEL 3" Compact Cut Off Tool
  * Suffix '-20' = Bare Tool / Tool Only; Suffix '-21'/'-22' = Battery Kit.

- DEWALT:
  * DCF900 = 20V MAX XR 1/2" High Torque Impact Wrench w/ Hog Ring
  * DCF899 = 20V MAX XR 1/2" High Torque Impact Wrench w/ Detent Pin
  * DCF961 = 20V MAX XR 1/2" Ultra High Torque Impact Wrench
  * DCF901 = 12V MAX 1/2" Impact Wrench; DCF903 = 12V MAX 3/8" Impact Wrench
  * DCF921 = 20V MAX ATOMIC 1/2" Impact Wrench; DCF923 = 20V MAX ATOMIC 3/8" Impact Wrench
  * DCF850 / DCF887 = 20V MAX 1/4" Hex Impact Driver
  * DCK229 / DCK229P1 = 20V MAX XR Brushless 3/8" & 1/2" Sealed Head Ratchet (DCF510) + DCF891B 1/2" Mid-Range Impact Wrench Kit (Includes (1) DCF510 Sealed Head Ratchet with interchangeable 3/8" & 1/2" anvils, (1) DCF891B 1/2" Mid-Range Impact Wrench with Hog Ring, (1) DCB205 5.0Ah XR Battery, (1) DCB115 Charger, and Contractor Tool Bag - $549.00 CAD MSRP).
  * Suffix 'B' = Bare Tool; Suffix 'P1'/'P2'/'D1'/'E2' = Battery Kit.

- MALCO:
  * M2000S = Replacement Spring for Max2000 Series Aviation Snips
  * M2001 / M2002 / M2003 / M2004 / M2005 = Max2000 Aviation Snips (Left, Right, Straight, etc.)
  * C5A / C5R = 5-Blade Pipe Crimper

- KNIPEX:
  * 87 01 250 = Cobra Water Pump Pliers 250mm (10")
  * 87 51 180 = Cobra Extra Slim Water Pump Pliers 180mm (7-1/4")
  * 86 01 250 = Pliers Wrench 250mm (10")
  * 74 01 200 = High Leverage Diagonal Cutters 200mm (8")
  * Suffix 'SBA' / 'BK' = Blister Pack / Retail Hang Card.

- OX TOOLS / AUX TOOLS:
  * OX-P0244 / P0244 = OX Pro Box Spirit Level Series (Heavy-duty aluminum box-beam profile, Dual-View Plumb Site® vial for parallax-free vertical readings, UV-resistant magnified acrylic block vials with ±0.0005 in/in or 0.5 mm/m precision, silicone air-cushioned shockproof handles and end caps).
    - OX-P024424 / OX-P024496 / 96" = 96" (2400mm / 8ft) Non-Magnetic Pro Box Spirit Level ($179.00 - $199.00 CAD)
    - OX-P024418 / OX-P024472 / 72" = 72" (1800mm / 6ft) Non-Magnetic Pro Box Spirit Level ($149.00 - $169.00 CAD)
    - OX-P024412 / OX-P024448 / 48" = 48" (1200mm / 4ft) Non-Magnetic Pro Box Spirit Level ($99.00 - $119.00 CAD)
    - OX-P024406 / OX-P024424 / 24" = 24" (600mm / 2ft) Non-Magnetic Pro Box Spirit Level ($69.00 - $79.00 CAD)
  * OX-P0243 = OX Pro Magnetic Box Spirit Level Series (Equipped with rare-earth magnets)
  * OX-T0263 = OX Trade Torpedo Level (9" / 230mm)
  * Warranty for OX Levels: "OX Tools Lifetime Vial Warranty: Vials are guaranteed for life against leakage, fogging, and loss of accuracy (±0.0005 in/in / 0.5 mm/m); backed by OX Tools 3-Year Limited Manufacturer Warranty on level frame and body."
`;

          // 2. Live Web Crawl & Source Retrieval across Canadian Tool Catalogs & Grounding Engine
          const cleanSku = sku.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
          const cleanMfrSku = sku.replace(/^[A-Z]{2,4}-/i, '');
          const skuParts = sku.split(/[^a-zA-Z0-9]+/).filter(p => p.length >= 3).map(p => p.toLowerCase());
          const brandLower = brand.toLowerCase();

          let crawledEvidence = '';
          const crawledSourceUrls: string[] = [];
          const discoveredImages: string[] = [];
          const candidateProductUrls: string[] = [];

          // 1. Search Top Canadian Industrial Tool Distributors
          const searchUrls = [
            `https://www.mississaugahardware.com/search?q=${encodeURIComponent(cleanMfrSku)}`,
            `https://thetoolstore.ca/search?type=product&q=${encodeURIComponent(cleanMfrSku)}`,
            `https://www.atlas-machinery.com/search.php?search_query=${encodeURIComponent(cleanMfrSku)}`,
            `https://www.bcfasteners.com/?s=${encodeURIComponent(cleanMfrSku)}&post_type=product`
          ];

          await Promise.allSettled(searchUrls.map(async (sUrl) => {
            try {
              const crawlRes = await fetch(sUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(2500)
              });
              if (crawlRes.ok) {
                const html = await crawlRes.text();
                const origin = new URL(sUrl).origin;
                const linkRegex = new RegExp(`href=["']((?:https?://[^"']*|/[^"']*)products/[^"']*${cleanMfrSku}[^"']*)["']`, 'gi');
                let m;
                while ((m = linkRegex.exec(html)) !== null) {
                  let pUrl = m[1];
                  if (pUrl.startsWith('/')) pUrl = origin + pUrl;
                  if (!candidateProductUrls.includes(pUrl)) {
                    candidateProductUrls.push(pUrl);
                  }
                }
              }
            } catch (e) {}
          }));

          // 2. Search DuckDuckGo Grounding
          try {
            const ddgQueries = [
              `${brand} ${cleanMfrSku}`,
              `${brand} ${sku}`,
              systemTitleHint ? `${brand} ${systemTitleHint}` : `${brand} ${cleanMfrSku} official`
            ];
            for (const dq of ddgQueries) {
              const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(dq)}`;
              const ddgRes = await fetch(ddgUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(2500)
              });
              if (ddgRes.ok) {
                const dHtml = await ddgRes.text();
                const linkRegex = /<a class="result__url"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
                let dm;
                while ((dm = linkRegex.exec(dHtml)) !== null && crawledSourceUrls.length < 8) {
                  let u = dm[1].replace(/<[^>]+>/g, '').trim();
                  if (!u.startsWith('http')) u = 'https://' + u;
                  const sn = dm[2].replace(/<[^>]+>/g, '').trim();
                  if (sn.length > 20) {
                    crawledSourceUrls.push(u);
                    crawledEvidence += `\n\n[Search Match: ${u}]\n${sn}`;
                    if (!u.includes('youtube.com') && !u.includes('wikipedia.org') && candidateProductUrls.length < 6) {
                      candidateProductUrls.push(u);
                    }
                  }
                }
              }
            }
          } catch (e) {}

          // 3. Deep Fetch All Candidate Direct Product Pages & Harvest High-Res Images
          const seenAssetKeys = new Set<string>(discoveredImages.map(getCanonicalAssetKey));
          if (candidateProductUrls.length > 0) {
            await Promise.allSettled(candidateProductUrls.map(async (pUrl) => {
              try {
                const pRes = await fetch(pUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                  },
                  signal: AbortSignal.timeout(3000)
                });
                if (pRes.ok) {
                  const pHtml = await pRes.text();
                  const ogMatch = pHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                                  pHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
                  if (ogMatch && ogMatch[1]) {
                    let ogUrl = ogMatch[1];
                    if (ogUrl.startsWith('//')) ogUrl = 'https:' + ogUrl;
                    else if (ogUrl.startsWith('/')) ogUrl = new URL(pUrl).origin + ogUrl;
                    const ogLower = ogUrl.toLowerCase();
                    if (!NON_PRODUCT_BLOCKLIST.some(k => ogLower.includes(k))) {
                      const canonical = normalizeAndCanonicalizeUrl(ogUrl);
                      const key = getCanonicalAssetKey(canonical);
                      if (!seenAssetKeys.has(key)) {
                        seenAssetKeys.add(key);
                        discoveredImages.push(canonical);
                      }
                    }
                  }

                  const prodImgs = pHtml.match(/https?:\/\/[^\s"']+(?:\/cdn\/shop\/files\/|\/stencil\/|\/wp-content\/uploads\/)[^\s"']+\.(?:jpg|jpeg|png|webp)/gi) || [];
                  for (const pImg of Array.from(new Set(prodImgs))) {
                    const pLower = pImg.toLowerCase();
                    const isExcluded = pLower.includes('logo') || pLower.includes('icon') || pLower.includes('banner') ||
                                       pLower.includes('placeholder') || pLower.includes('touch-icon') || pLower.includes('footer') ||
                                       NON_PRODUCT_BLOCKLIST.some(k => pLower.includes(k));
                    if (!isExcluded) {
                      const canonical = normalizeAndCanonicalizeUrl(pImg);
                      const key = getCanonicalAssetKey(canonical);
                      if (!seenAssetKeys.has(key)) {
                        seenAssetKeys.add(key);
                        discoveredImages.push(canonical);
                      }
                    }
                  }

                  const textOnly = pHtml
                    .replace(/<script[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .slice(0, 2500);
                  crawledEvidence += `\n\n[Live Page Content: ${pUrl}]\n${textOnly}`;
                }
              } catch (e) {}
            }));
          }

          // Universal Direct Exact-Image Search
          try {
            const baseNumbers = cleanMfrSku.replace(/[^0-9]/g, '').slice(0, 4);
            const bQueries = [
              `"${brand}" "${cleanMfrSku}"`,
              `"${brand}" "${sku}"`
            ].filter(Boolean);

            const WRONG_KIT_TERMS = [
              'combi-drill', 'hammer-bare', 'dcd996', 'dch273', 'tstak', 'dck299', 'dck590',
              'dck694', 'dcd791', 'dcd796', 'dcd998', 'dcf887', 'dcf850', 'circular-saw', 'reciprocating-saw',
              'p2t', '-gb', '-qw', '-xe', 'akcdn.net', 'dewaltvietnam'
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
                for (const m of matches.slice(0, 18)) {
                  let imgUrl = m.replace(/murl&quot;:&quot;/i, '').replace(/\\\//g, '/').trim();
                  if (imgUrl.match(/\.(jpg|jpeg|png|webp)($|\?)/i) && !imgUrl.includes('bing.com') && !imgUrl.includes('microsoft.com')) {
                    const lower = imgUrl.toLowerCase();
                    if (WRONG_KIT_TERMS.some(term => lower.includes(term))) continue;
                    if (cleanMfrSku.toUpperCase().endsWith('P1') && (lower.includes('p2') || lower.includes('p2t'))) continue;
                    if (!lower.includes('logo') && !lower.includes('icon') && !lower.includes('badge') && !lower.includes('banner') && !NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k))) {
                      const hasMatch = lower.includes(cleanMfrSku.toLowerCase()) || 
                                       (baseNumbers.length >= 3 && lower.includes(baseNumbers)) || 
                                       lower.includes(brand.toLowerCase());
                      if (hasMatch) {
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
              }
              if (discoveredImages.length >= 15) break;
            }
          } catch (e) {}

          // 3. Build Precision Prompt with Industrial Tool Taxonomy, System Hint, and Strict Fact Verification
          const prompt = `Act as the Master Industrial Tool Data Architect for Professional Trades.
You must research, verify, organize, and synthesize complete, authoritative, 100% accurate Shopify product catalog data for: "${brand} ${sku}".

${TOOL_TAXONOMY_RULES}

${systemTitleHint ? `VERIFIED ENTERPRISE ERP / EBMS ITEM DESCRIPTION:\n"${systemTitleHint}"\nCRITICAL DIRECTIVE: The user's internal enterprise inventory system identifies this item as: "${systemTitleHint}". This is the ground-truth definition of this part. Base all product naming, replacement part features, compatibility, specs, and price tier on this exact item (e.g. if it is a replacement spring, generate replacement spring data and $4.99-$9.99 CAD pricing, NOT complete tool pricing).` : ''}

LIVE CRAWLED DISTRIBUTOR EVIDENCE:
${crawledEvidence || 'No live web crawl evidence retrieved. Base synthesis on verified manufacturer catalog standards for this exact brand and SKU.'}

${Object.keys(existingContext).length > 0 ? `EXISTING CONTEXT: ${JSON.stringify(existingContext)}` : ''}

CRITICAL TONE & ACCURACY DIRECTIVES (ZERO-HALLUCINATION ENFORCEMENT):
1. PROFESSIONAL OBJECTIVE TONE (NO PROMOTIONAL DISTRIBUTOR INTROS):
   - Write clean, authoritative, professional product descriptions.
   - NEVER start with phrases like "As an authorized premier Canadian tool distributor, Wise Line Tools presents..." or mention "Wise Line Tools" in the opening description paragraphs.
   - Start immediately with a compelling product overview explaining the tool's engineering, key features, and trade applications.
2. ANVIL / DRIVE SIZE & SPECIFICATION ACCURACY:
   - Determine exact drive/anvil size (e.g. 1/2" Square Pin Detent vs 1/2" Friction Ring vs 3/8" vs 3/4" vs 1/4" Hex).
   - If SKU is Milwaukee 2555P-22, it is strictly the M12 FUEL 1/2" Stubby Impact Wrench w/ Pin Detent Kit (Includes (1) 2555P-20 Bare Tool, (1) CP2.0 Battery, (1) XC4.0 Battery, Charger, Bag, 250 ft-lbs breakaway torque).
3. VOLTAGE PLATFORM: Identify the exact battery system (e.g. 40Vmax XGT, 18V LXT, 20V MAX XR, M12 FUEL, M18 FUEL, 18V PROFACTOR).
4. BARE TOOL VS KIT: Explicitly state in the Title whether this is Bare Tool (e.g. 'Z', '-20', 'B') or Kit (e.g. '-21', '-22', 'P2').
5. CANADIAN PRICING (CAD): Provide realistic Canadian distributor MSRP in CAD (e.g. "369.00").
6. INDUSTRIAL METADATA:
   - Accurate UPC/EAN barcode (12-13 digits)
   - Real net tool weight in grams
   - 2-letter Country of Origin
   - Harmonized Tariff HS Code
   - Google Product Category & Product Type
   - Comprehensive HTML Description (body_html) with <h3>Features</h3>, <h3>Specifications</h3><table>...</table>, and <h3>Includes</h3>
7. WARRANTY SPECIFICATION:
   - If product is a non-powered manual Hand Tool (combination wrenches, ratchets, sockets, pliers, screwdrivers, knives, levels, tape measures, pry bars, hex keys, clamps), output: "MILWAUKEE Limited Lifetime Warranty: Hand tools are warranted to the original purchaser to be free from defects in material and workmanship for the useful life of the tool."
   - If product is a Cordless Power Tool (impacts, drills, saws, grinders, nailers), output: "MILWAUKEE 5-Year Limited Tool Warranty on cordless power tools, 3-Year Limited Warranty on REDLITHIUM XC battery packs, and 2-Year Warranty on compact batteries."
   - For other brands (Makita, DeWalt, Bosch, Festool, Knipex, Bessey), output the official manufacturer warranty for that specific category.

OUTPUT STRICTLY A VALID JSON OBJECT:
{
  "title": "...",
  "price_cad": "...",
  "warranty": "...",
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

          // Dynamic import of @google/genai
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey });

          // Ordered model cascade: High-RPM gemini-3.5-flash-lite -> gemini-2.5-flash -> gemini-3.6-flash
          const modelsToTry = [
            'gemini-3.5-flash-lite',
            'gemini-2.5-flash',
            'gemini-3.6-flash',
            'gemini-3.5-flash'
          ];

          let modelUsed = '';
          let isFallback = false;
          let parsedData: any = null;
          let lastError: any = null;

          for (let i = 0; i < modelsToTry.length; i++) {
            const currentModel = modelsToTry[i];
            try {
              const resAi = await ai.models.generateContent({
                model: currentModel,
                contents: prompt,
                config: {
                  temperature: 0.15,
                  responseMimeType: 'application/json'
                }
              });

              if (resAi.text) {
                parsedData = JSON.parse(resAi.text);
                modelUsed = currentModel;
                isFallback = i > 0;
                break;
              }
            } catch (err: any) {
              lastError = err;
              console.warn(`[AI Model Attempt] ${currentModel} returned: ${err.message?.slice(0, 100)}`);
              // Brief pause before trying next model in cascade
              await new Promise(r => setTimeout(r, 400));
            }
          }

          if (!parsedData) {
            const isQuota = lastError && (
              String(lastError.message || '').includes('429') ||
              String(lastError.message || '').includes('RESOURCE_EXHAUSTED') ||
              String(lastError.message || '').includes('quota')
            );

            if (!res.headersSent) {
              res.writeHead(isQuota ? 429 : 500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: isQuota 
                  ? 'The free Gemini allowance has temporarily been reached. Please wait a moment before retrying.' 
                  : (lastError?.message || 'Failed to synthesize product data.')
              }));
            }
            return;
          }

          if (!res.headersSent) {
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
              success: true,
              modelUsed,
              isFallback,
              sourceUrls: parsedData.source_urls || crawledSourceUrls,
              data: parsedData,
              images: Array.from(new Set(discoveredImages))
            }));
          }
        } catch (serverErr: any) {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server synthesis error' }));
          }
        }
      });
    });
  }
});

const shopifyProxyPlugin = (env: Record<string, string>): Plugin => ({
  name: 'shopify-api-proxy',
  configureServer(server) {
    server.middlewares.use('/api/shopify/graphql', async (req, res) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Store, X-Shopify-Access-Token, X-Shopify-Api-Version'
        });
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const storeDomain = (req.headers['x-shopify-store'] as string) || env.SHOPIFY_STORE_DOMAIN || '';
          const accessToken = (req.headers['x-shopify-access-token'] as string) || env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';
          const apiVersion = (req.headers['x-shopify-api-version'] as string) || env.SHOPIFY_API_VERSION || '2025-01';

          if (!storeDomain || !accessToken) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              errors: [{ message: 'Missing Shopify Store Domain or Admin Access Token.' }]
            }));
            return;
          }

          let cleanStore = storeDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
          if (!cleanStore.includes('.')) {
            cleanStore += '.myshopify.com';
          }

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
          res.writeHead(shopifyRes.status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(data);
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errors: [{ message: err.message || 'Shopify proxy error' }] }));
        }
      });
    });
  }
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [react(), mediaPlugin(), geminiAiPlugin(env), shopifyProxyPlugin(env)],
      define: {
        'process.env.SHOPIFY_STORE_DOMAIN': JSON.stringify(env.SHOPIFY_STORE_DOMAIN || ''),
        'process.env.SHOPIFY_ADMIN_ACCESS_TOKEN': JSON.stringify(env.SHOPIFY_ADMIN_ACCESS_TOKEN || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

