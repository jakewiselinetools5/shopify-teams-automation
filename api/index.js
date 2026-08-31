import { GoogleGenAI } from '@google/genai';

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
    let pathname = u.pathname.toLowerCase();
    pathname = pathname.replace(/_(?:sm|md|lg|thumb|medium|large|small|_1200x1200)(?=\.[a-z0-9]+$)/i, '');
    const filename = pathname.split('/').pop() || '';
    return `${u.hostname}/${filename}`;
  } catch {
    return url.toLowerCase();
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Shopify-Store, X-Shopify-Access-Token, X-Shopify-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { pathname } = new URL(req.url, `https://${req.headers.host || 'localhost'}`);

  if (pathname === '/api/health') {
    return res.status(200).json({ status: 'ok', serverTime: new Date().toISOString() });
  }

  if (pathname === '/api/media/scrape' && req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const brand = String(payload.brand || '').trim();
      const sku = String(payload.sku || '').trim();
      const candidateUrls = Array.isArray(payload.candidateUrls) ? payload.candidateUrls : [];

      const validImages = [];
      const seenAssetKeys = new Set();
      const cleanMfrSku = sku.replace(/^[A-Z]{2,4}-/i, '');
      const baseNumbers = cleanMfrSku.replace(/[^0-9]/g, '').slice(0, 4);

      const addValidImage = (url) => {
        const canonical = normalizeAndCanonicalizeUrl(url);
        const assetKey = getCanonicalAssetKey(canonical);
        if (seenAssetKeys.has(assetKey)) return;
        seenAssetKeys.add(assetKey);
        validImages.push(canonical);
      };

      for (const cand of candidateUrls) {
        if (cand && typeof cand === 'string' && cand.startsWith('http')) {
          const lower = cand.toLowerCase();
          if (!NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k))) {
            addValidImage(cand);
          }
        }
      }

      const WRONG_KIT_TERMS = [
        'combi-drill', 'hammer-bare', 'dcd996', 'dch273', 'tstak', 'dck299', 'dck590',
        'dck694', 'dcd791', 'dcd796', 'dcd998', 'dcf887', 'dcf850', 'circular-saw', 'reciprocating-saw',
        'p2t', '-gb', '-qw', '-xe', 'akcdn.net', 'dewaltvietnam', 'autozone', 'bitsdrill', 'toolsgiant'
      ];

      if (validImages.length < 8) {
        try {
          const query = `"${brand}" "${cleanMfrSku}"`;
          const bingUrl = `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=0&count=18&mmasync=1`;
          const bingRes = await fetch(bingUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(2500)
          });
          if (bingRes.ok) {
            const bingHtml = await bingRes.text();
            const matches = bingHtml.match(/murl&quot;:&quot;([^&"]+)/gi) || [];
            for (const m of matches.slice(0, 18)) {
              let imgUrl = m.replace(/murl&quot;:&quot;/i, '').replace(/\\\//g, '/').trim();
              if (imgUrl.match(/\.(jpg|jpeg|png|webp)($|\?)/i) && !imgUrl.includes('bing.com') && !imgUrl.includes('microsoft.com')) {
                const lower = imgUrl.toLowerCase();
                if (WRONG_KIT_TERMS.some(term => lower.includes(term))) continue;
                if (cleanMfrSku.toUpperCase().endsWith('P1') && (lower.includes('p2') || lower.includes('p2t'))) continue;
                if (!NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k))) {
                  const hasMatch = lower.includes(cleanMfrSku.toLowerCase()) || 
                                   (baseNumbers.length >= 3 && lower.includes(baseNumbers)) || 
                                   lower.includes(brand.toLowerCase());
                  if (hasMatch) {
                    addValidImage(imgUrl);
                  }
                }
              }
            }
          }
        } catch (e) {}
      }

      return res.status(200).json({ success: true, images: validImages });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (pathname === '/api/ai/synthesize' && req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const brand = String(payload.brand || '').trim();
      const sku = String(payload.sku || '').trim();
      const systemTitleHint = String(payload.systemTitleHint || '').trim();

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not configured.' });
      }

      const cleanMfrSku = sku.replace(/^[A-Z]{2,4}-/i, '');
      let crawledEvidence = '';
      const crawledSourceUrls = [];
      const discoveredImages = [];
      const candidateProductUrls = [];

      const searchUrls = [
        `https://www.mississaugahardware.com/search?q=${encodeURIComponent(cleanMfrSku)}`,
        `https://thetoolstore.ca/search?type=product&q=${encodeURIComponent(cleanMfrSku)}`,
        `https://www.atlas-machinery.com/search.php?search_query=${encodeURIComponent(cleanMfrSku)}`,
        `https://www.bcfasteners.com/?s=${encodeURIComponent(cleanMfrSku)}&post_type=product`
      ];

      await Promise.allSettled(searchUrls.map(async (sUrl) => {
        try {
          const crawlRes = await fetch(sUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
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
              if (!candidateProductUrls.includes(pUrl)) candidateProductUrls.push(pUrl);
            }
          }
        } catch (e) {}
      }));

      try {
        const ddgQueries = [
          `${brand} ${cleanMfrSku}`,
          `${brand} ${sku}`,
          systemTitleHint ? `${brand} ${systemTitleHint}` : `${brand} ${cleanMfrSku} official`
        ];
        for (const dq of ddgQueries) {
          const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(dq)}`;
          const ddgRes = await fetch(ddgUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
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

      const seenAssetKeys = new Set();
      if (candidateProductUrls.length > 0) {
        await Promise.allSettled(candidateProductUrls.map(async (pUrl) => {
          try {
            const pRes = await fetch(pUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
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
                if (!pLower.includes('logo') && !pLower.includes('icon') && !pLower.includes('banner') && !NON_PRODUCT_BLOCKLIST.some(k => pLower.includes(k))) {
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

      const prompt = `Act as the Master Industrial Tool Data Architect for Professional Trades.
You must research, verify, organize, and synthesize complete, authoritative, 100% accurate Shopify product catalog data for: "${brand} ${sku}".

${systemTitleHint ? `VERIFIED ENTERPRISE ERP / EBMS ITEM DESCRIPTION:\n"${systemTitleHint}"\nCRITICAL DIRECTIVE: The user's internal enterprise inventory system identifies this item as: "${systemTitleHint}". This is the ground-truth definition of this part.` : ''}

LIVE CRAWLED DISTRIBUTOR EVIDENCE:
${crawledEvidence || 'Base synthesis on verified manufacturer catalog standards for this exact brand and SKU.'}

OUTPUT STRICTLY A VALID JSON OBJECT:
{
  "title": "...",
  "price_cad": "...",
  "body_html": "...",
  "warranty": "...",
  "barcode": "...",
  "weight_grams": "...",
  "country_of_origin": "...",
  "hs_code": "...",
  "google_category": "...",
  "product_type": "...",
  "tags": "..."
}`;

      const ai = new GoogleGenAI({ apiKey });
      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
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
          console.warn(`Model ${m} error:`, err.message);
        }
      }

      return res.status(200).json({
        success: true,
        data: parsedData,
        images: discoveredImages
      });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Synthesis failed' });
    }
  }

  if (pathname === '/api/shopify/graphql' && req.method === 'POST') {
    try {
      const storeDomain = req.headers['x-shopify-store'] || process.env.SHOPIFY_STORE_DOMAIN || '';
      const accessToken = req.headers['x-shopify-access-token'] || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';
      const apiVersion = req.headers['x-shopify-api-version'] || process.env.SHOPIFY_API_VERSION || '2025-01';

      if (!storeDomain || !accessToken) {
        return res.status(400).json({ errors: [{ message: 'Missing Shopify Store Domain or Admin Access Token.' }] });
      }

      let cleanStore = storeDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (!cleanStore.includes('.')) cleanStore += '.myshopify.com';

      const targetUrl = `https://${cleanStore}/admin/api/${apiVersion}/graphql.json`;
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      const shopifyRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken.trim()
        },
        body
      });

      const data = await shopifyRes.json();
      return res.status(shopifyRes.status).json(data);
    } catch (err) {
      return res.status(500).json({ errors: [{ message: err.message || 'Shopify proxy error' }] });
    }
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}
