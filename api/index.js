import { GoogleGenAI } from '@google/genai';


function isImageMatchingSkuModel(imgUrl, brand, sku) {
  const lower = String(imgUrl || '').toLowerCase();
  const lowerSku = String(sku || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Banner and site asset filters
  if (lower.includes('1920x960') || lower.includes('930x600') || lower.includes('70x30') || 
      lower.includes('country/') || lower.includes('/flags/') || lower.includes('ca.png') || 
      lower.includes('banner') || lower.includes('header') || lower.includes('slider')) {
    return false;
  }

  // Cross-model mismatch filters for Olight
  if (brand.toLowerCase().includes('olight')) {
    const olightModels = ['arkpro', 'arkfeld', 'baton', 'seeker', 'warrior', 'perun', 'marauder', 'oclip', 'javelot', 'baldr', 'valkyrie', 'i3t', 'i5t', 'i1r', 'diffuse', 'sphere'];
    const currentModel = olightModels.find(m => lowerSku.includes(m));
    if (currentModel) {
      const otherModels = olightModels.filter(m => m !== currentModel);
      if (otherModels.some(other => lower.includes(other))) {
        return false; // Skip images from other models
      }
    }
  }

  return true;
}

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
  'window', 'windows', 'facade', 'building', 'buildings', 'architecture', 'calendar', 'zodiac', 'astrology',
  'voltag.ru', 'woluntech.com', 'chinazhongzhi.com', 'ruralking.com', 'veswin.com',
  'outilspierreberger', 'opb', 'watermark', 'placeholder', 'no-image', 'preview', 'cart',
  'ebayimg.com', 'ebay.com', 'craigslist', 'mercari', 'poshmark', 'facebook.com', 'kijiji',
  'vipoutlet.com', 'manuals.plus', 'gardena', 'box_', '_box', 'box.jpg', 'box.png', 'packaging',
  'package', 'carton', 'retail_box', 'retail-box', 'box_front', 'box_back', 'in_box',
  'box-shot', 'box-image', 'box-art', 'diagram', 'manual', 'schematic', 'parts-diagram',
  'fig-', 'kupplung', 'logo', 'logotype', 'brand-logo', 'brand_logo', 'header-logo', 'footer-logo',
  'badge', 'promo', 'shredder', 'baler', 'recycling', 'tractor', 'excavator', 'crane', 'hydraulic',
  'conveyor', 'machinery', 'lamp', 'bulb', 'fixture', 'light-bulb', 'headlight', 'meter', 'gauge',
  'pipe-fitting', 'sewing-machine', 'engine', 'motor-housing', 'fastenersinc.net/cdn/shop/files/1_d3bda63f',
  'square_hardware.png', 'hqdefault', 'mqdefault', 'maxresdefault', 'ytimg.com', 'youtube.com', 'img.youtube.com'
];

function normalizeAndCanonicalizeUrl(rawUrl) {
  try {
    let clean = rawUrl.trim().replace(/^http:\/\//i, 'https://');
    const u = new URL(clean);
    if (u.hostname.includes('shopify.com') || u.pathname.includes('/cdn/shop/')) {
      u.search = '';
      u.pathname = u.pathname.replace(/_[0-9]+x[0-9]+(?=\.[a-z0-9]+$)/i, '_1024x1024')
                             .replace(/_(?:small|thumb|compact|medium|large|grande)(?=\.[a-z0-9]+$)/i, '_1024x1024');
    } else if (u.hostname.includes('insitecloud.net') || u.pathname.includes('insitecloud.net')) {
      u.search = '';
      u.pathname = u.pathname.replace(/_(?:sm|md|thumb)(?=\.[a-z0-9]+$)/i, '_lg');
    } else if (u.pathname.includes('/stencil/')) {
      u.pathname = u.pathname.replace(/\/stencil\/\d+x\d+\//, '/stencil/1000x1000/').replace(/\/stencil\/\d+w\//, '/stencil/1000x1000/');
    } else if (u.hostname.includes('olightstore.com') || u.hostname.includes('olightstore.ca')) {
      u.search = '';
      u.pathname = u.pathname.replace(/@.*$/, '');
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
    pathname = pathname.replace(/_(?:sm|md|lg|thumb|medium|large|small|_1024x1024)(?=\.[a-z0-9]+$)/i, '');
    const filename = pathname.split('/').pop() || '';
    return `${u.hostname}/${filename}`;
  } catch {
    return url.toLowerCase();
  }
}


function getMatchingTaxonomyRules(brand, sku) { return ""; }

const TOOL_TAXONOMY_RULES = "";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Shopify-Store, X-Shopify-Access-Token, X-Shopify-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const parsedUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const { pathname } = parsedUrl;

  if (pathname === '/api/health') {
    return res.status(200).json({ status: 'ok', serverTime: new Date().toISOString() });
  }

  if (pathname === '/api/media/proxy') {
    try {
      const targetUrl = parsedUrl.searchParams.get('url');
      if (!targetUrl || !targetUrl.startsWith('http')) {
        return res.status(400).json({ error: 'Missing or invalid url parameter' });
      }

      const imgRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': new URL(targetUrl).origin
        },
        signal: AbortSignal.timeout(6000)
      });

      if (!imgRes.ok) {
        return res.status(imgRes.status).send(`Proxy fetch failed: ${imgRes.statusText}`);
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      return res.status(200).send(buffer);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
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
          if (!NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k)) && isImageMatchingSkuModel(imgUrl, brand, sku)) {
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
          const bQueries = [
            `"${brand}" "${sku}"`,
            `"${brand}" "${cleanMfrSku}"`,
            `"${sku}"`
          ].filter(Boolean);

          for (const query of bQueries) {
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
                  if (!lower.includes('logo') && !lower.includes('icon') && !lower.includes('banner') && !NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k))) {
                    addValidImage(imgUrl);
                  }
                }
              }
            }
            if (validImages.length >= 6) break;
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

      const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();

      const cleanMfrSku = sku.replace(/^[A-Z]{2,4}-/i, '');
      let crawledEvidence = '';
      const crawledSourceUrls = [];
      const discoveredImages = [];
      const candidateProductUrls = [];
      const lowerBrand = brand.toLowerCase();

            // 1. Direct official manufacturer URLs (Source of Truth)
      if (lowerBrand.includes('milwaukee')) {
        candidateProductUrls.push(`https://www.milwaukeetool.ca/Products/${cleanMfrSku}`);
        candidateProductUrls.push(`https://www.milwaukeetool.com/Products/${cleanMfrSku}`);
      } else if (lowerBrand.includes('dewalt')) {
        candidateProductUrls.push(`https://www.dewalt.ca/product/${cleanMfrSku.toLowerCase()}`);
        candidateProductUrls.push(`https://www.dewalt.com/product/${cleanMfrSku.toLowerCase()}`);
      } else if (lowerBrand.includes('makita')) {
        candidateProductUrls.push(`https://www.makita.ca/index2.php?event=toolsearch&toolno=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://www.makitatools.com/products/details/${cleanMfrSku}`);
      } else if (lowerBrand.includes('stealth')) {
        candidateProductUrls.push(`https://stealthvacs.com/products/${cleanMfrSku.toLowerCase()}`);
        candidateProductUrls.push(`https://www.stealthvacs.com/products/${sku.toLowerCase()}`);
      } else if (lowerBrand.includes('badger') || lowerBrand.includes('occidental')) {
        candidateProductUrls.push(`https://badgertoolbelts.com/search?q=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://badgertoolbelts.com/products/${cleanMfrSku.toLowerCase()}`);
        candidateProductUrls.push(`https://occidentalleather.com/search?q=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://squareshardware.ca/search?q=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://www.burnstools.com/catalogsearch/result/?q=${encodeURIComponent(cleanMfrSku)}`);
      } else if (lowerBrand.includes('olight')) {
        candidateProductUrls.push(`https://www.olightstore.ca/search?q=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://www.olightstore.com/search?q=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://ca.olight.com/products/${cleanMfrSku.toLowerCase()}`);
      } else if (lowerBrand.includes('malco')) {
        candidateProductUrls.push(`https://www.malcopro.com/product/${cleanMfrSku.toLowerCase()}`);
      } else if (lowerBrand.includes('knipex')) {
        candidateProductUrls.push(`https://www.knipex.com/products/${cleanMfrSku.replace(/\s+/g, '')}`);
      } else if (lowerBrand.includes('wiha')) {
        candidateProductUrls.push(`https://www.wihatools.com/products/${cleanMfrSku.toLowerCase()}`);
      } else if (lowerBrand.includes('ox')) {
        candidateProductUrls.push(`https://oxtools.ca/products/${cleanMfrSku.toLowerCase()}`);
      } else if (lowerBrand.includes('festool')) {
        candidateProductUrls.push(`https://www.festoolcanada.com/products/search?q=${encodeURIComponent(cleanMfrSku)}`);
      } else if (lowerBrand.includes('bosch')) {
        candidateProductUrls.push(`https://www.boschtools.com/us/en/search/?q=${encodeURIComponent(cleanMfrSku)}`);
      } else if (lowerBrand.includes('stabila')) {
        candidateProductUrls.push(`https://www.stabila.com/en-US/search.html?q=${encodeURIComponent(cleanMfrSku)}`);
      } else if (lowerBrand.includes('bessey')) {
        candidateProductUrls.push(`https://www.besseytools.com/search?q=${encodeURIComponent(cleanMfrSku)}`);
      }

            // 2. Canadian Authorized Industrial Distributors & Retail Catalogs
      const cadDistributorUrls = [
        `https://www.mississaugahardware.com/search?q=${encodeURIComponent(cleanMfrSku)}`,
        `https://www.atlas-machinery.com/search.php?search_query=${encodeURIComponent(cleanMfrSku)}`,
        `https://www.tegstools.com/search?q=${encodeURIComponent(cleanMfrSku)}`,
        `https://thetoolstore.ca/search?type=product&q=${encodeURIComponent(cleanMfrSku)}`,
        `https://www.bcfasteners.com/?s=${encodeURIComponent(cleanMfrSku)}&post_type=product`,
        `https://www.kmstools.com/catalogsearch/result/?q=${encodeURIComponent(cleanMfrSku)}`,
        `https://www.toolnut.com/search?q=${encodeURIComponent(cleanMfrSku)}`,
        `https://www.acmetools.com/search?q=${encodeURIComponent(cleanMfrSku)}`,
        `https://www.homedepot.ca/search?q=${encodeURIComponent(cleanMfrSku)}`
      ];

      await Promise.allSettled(cadDistributorUrls.map(async (sUrl) => {
        try {
          const crawlRes = await fetch(sUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(3000)
          });
          if (crawlRes.ok) {
            const html = await crawlRes.text();
            const origin = new URL(sUrl).origin;
            const linkRegex = new RegExp(`href=["']((?:https?://[^"']*|/[^"']*)products?/[^"']*${cleanMfrSku.slice(0, 6)}[^"']*)["']`, 'gi');
            let m;
            while ((m = linkRegex.exec(html)) !== null && candidateProductUrls.length < 15) {
              let pUrl = m[1];
              if (pUrl.startsWith('/')) pUrl = origin + pUrl;
              if (!candidateProductUrls.includes(pUrl)) candidateProductUrls.push(pUrl);
            }
          }
        } catch (e) {}
      }));

      // 3. Multi-Query Deep Web Search (Canada, UPC, Specs, Pricing)
      try {
        const ddgQueries = [
          `"${brand}" "${sku}" Canada`,
          `"${cleanMfrSku}" "UPC"`,
          `"${sku}" specifications price CAD`
        ];
        await Promise.allSettled(ddgQueries.map(async (dq) => {
          try {
            const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(dq)}`;
            const ddgRes = await fetch(ddgUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              signal: AbortSignal.timeout(2500)
            });
            if (ddgRes.ok) {
              const dHtml = await ddgRes.text();
              const linkRegex = /<a class="result__url"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
              let dm;
              while ((dm = linkRegex.exec(dHtml)) !== null && crawledSourceUrls.length < 15) {
                let u = dm[1].replace(/<[^>]+>/g, '').trim();
                if (!u.startsWith('http')) u = 'https://' + u;
                const sn = dm[2].replace(/<[^>]+>/g, '').trim();
                if (sn.length > 20) {
                  crawledSourceUrls.push(u);
                  crawledEvidence += `\n\n[Search Match: ${u}]\n${sn}`;
                  if (!u.includes('youtube.com') && !u.includes('wikipedia.org') && !u.includes('ebay.') && candidateProductUrls.length < 15) {
                    candidateProductUrls.push(u);
                  }
                }
              }
            }
          } catch (e) {}
        }));
      } catch (e) {}

      const seenAssetKeys = new Set();
      const mfrStudioImages = [];
      const secondaryImages = [];
      let officialMfrTitle = '';
      let officialMfrSource = '';

      if (candidateProductUrls.length > 0) {
        await Promise.allSettled(candidateProductUrls.map(async (pUrl) => {
          try {
            const pRes = await fetch(pUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              signal: AbortSignal.timeout(2500)
            });
            if (pRes.ok) {
              const pHtml = await pRes.text();
              const isMfrDomain = pUrl.includes('milwaukeetool.') || pUrl.includes('dewalt.') || pUrl.includes('makitatools.') || pUrl.includes('stealthvacs.') || pUrl.includes('malcopro.') || pUrl.includes('knipex.') || pUrl.includes('wihatools.') || pUrl.includes('oxtools.') || pUrl.includes('badgertoolbelts.') || pUrl.includes('occidentalleather.');

              if (isMfrDomain && !officialMfrTitle) {
                const h1Match = pHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
                const ogTitleMatch = pHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
                let cand = (h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '') || (ogTitleMatch ? ogTitleMatch[1].replace(/\|.*$/g, '').trim() : '');
                cand = cand.replace(/^NEXUS™\s*/i, '').trim();
                if (cand && cand.length > 3 && !cand.toLowerCase().includes('page not found') && !cand.toLowerCase().includes('404')) {
                  officialMfrTitle = cand;
                  officialMfrSource = pUrl;
                }
              }

              // Extract direct manufacturer images
              if (lowerBrand.includes('milwaukee')) {
                const mkeImgs = pHtml.match(/https:\/\/www\.milwaukeetool\.com\/--\/web-images\/sc\/[a-f0-9]+(?:\?hash=[a-f0-9]+)?/gi) || [];
                for (const mImg of mkeImgs) {
                  const canonical = normalizeAndCanonicalizeUrl(mImg);
                  const key = getCanonicalAssetKey(canonical);
                  if (!seenAssetKeys.has(key)) {
                    seenAssetKeys.add(key);
                    mfrStudioImages.push(canonical);
                  }
                }
              } else if (lowerBrand.includes('badger') || lowerBrand.includes('occidental')) {
                const bgMatches = pHtml.match(/https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)/gi) || [];
                for (const bImg of bgMatches) {
                  const lower = bImg.toLowerCase();
                  if (cleanMfrSku.includes('461055') && (lower.includes('grey') || lower.includes('gunmetal') || lower.includes('coyote') || lower.includes('sage') || lower.includes('461010') || lower.includes('461030'))) continue;
                  if (cleanMfrSku.includes('461010') && (lower.includes('olive') || lower.includes('coyote') || lower.includes('sage') || lower.includes('461055') || lower.includes('461030'))) continue;
                  if (
                    (lower.includes('461055') || lower.includes('461010') || lower.includes('461030') || lower.includes('462055') || lower.includes('badger') || lower.includes('stencil/1280x1280') || lower.includes('catalog/product')) &&
                    !NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k))
                  ) {
                    const canonical = normalizeAndCanonicalizeUrl(bImg);
                    const key = getCanonicalAssetKey(canonical);
                    if (!seenAssetKeys.has(key)) {
                      seenAssetKeys.add(key);
                      mfrStudioImages.push(canonical);
                    }
                  }
                }
              } else if (lowerBrand.includes('olight')) {
                const olMatches = pHtml.match(/https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)/gi) || [];
                for (const oImg of olMatches) {
                  const lower = oImg.toLowerCase();
                  
                  
                  
                  if (
                    !lower.includes("logo") &&
                    !NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k)) &&
                    isImageMatchingSkuModel(oImg, brand, sku)
                  ) {
                    const canonical = normalizeAndCanonicalizeUrl(oImg);
                    const key = getCanonicalAssetKey(canonical);
                    if (!seenAssetKeys.has(key)) {
                      seenAssetKeys.add(key);
                      mfrStudioImages.push(canonical);
                    }
                  }
                }
              }

              const ogMatch = pHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                              pHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
              if (ogMatch && ogMatch[1]) {
                let ogUrl = ogMatch[1];
                if (ogUrl.startsWith('//')) ogUrl = 'https:' + ogUrl;
                else if (ogUrl.startsWith('/')) ogUrl = new URL(pUrl).origin + ogUrl;
                const ogLower = ogUrl.toLowerCase();
                if (!NON_PRODUCT_BLOCKLIST.some(k => ogLower.includes(k)) && isImageMatchingSkuModel(ogUrl, brand, sku)) {
                  const canonical = normalizeAndCanonicalizeUrl(ogUrl);
                  const key = getCanonicalAssetKey(canonical);
                  if (!seenAssetKeys.has(key)) {
                    seenAssetKeys.add(key);
                    mfrStudioImages.push(canonical);
                  }
                }
              }

              const textOnly = pHtml
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .slice(0, 3500);
              crawledEvidence += `\n\n[Live Page Content: ${pUrl}]\n${textOnly}`;
            }
          } catch (e) {}
        }));
      }

      // Universal Direct Exact-Image Search with tool context
      if (mfrStudioImages.length + secondaryImages.length < 4) {
        try {
          const bQueries = [
            `"${brand}" "${sku}"`.trim(),
            `"${brand}" "${cleanMfrSku}"`.trim(),
            `"${cleanMfrSku}"`.trim()
          ];
          for (const bq of bQueries) {
            const bUrl = `https://www.bing.com/images/async?q=${encodeURIComponent(bq)}&first=0&count=15&mmasync=1`;
            const bRes = await fetch(bUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: AbortSignal.timeout(2000) });
            if (bRes.ok) {
              const bHtml = await bRes.text();
              const matches = bHtml.match(/murl&quot;:&quot;([^&"]+)/gi) || [];
              for (const m of matches.slice(0, 10)) {
                let imgUrl = m.replace(/murl&quot;:&quot;/i, '').replace(/\\\//g, '/').trim();
                if (imgUrl.match(/\.(jpg|jpeg|png|webp)($|\?)/i) && !imgUrl.includes('bing.com') && !imgUrl.includes('microsoft.com')) {
                  const lower = imgUrl.toLowerCase();
                  if (!NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k)) && isImageMatchingSkuModel(imgUrl, brand, sku)) {
                    const canonical = normalizeAndCanonicalizeUrl(imgUrl);
                    const assetKey = getCanonicalAssetKey(canonical);
                    if (!seenAssetKeys.has(assetKey)) {
                      seenAssetKeys.add(assetKey);
                      secondaryImages.push(canonical);
                    }
                  }
                }
              }
            }
            if (mfrStudioImages.length + secondaryImages.length >= 8) break;
          }
        } catch (e) {}
      }

      discoveredImages.push(...mfrStudioImages, ...secondaryImages);

      // Extract candidate UPCs and Canadian CAD Prices
      const detectedUpcs = Array.from(new Set(crawledEvidence.match(/\b(045242\d{6}|885911\d{6}|088381\d{6}|845876\d{6}|761748\d{6}|843221\d{6}|084705\d{6}|707565\d{6}|759963\d{6})\b/g) || []));
      const detectedPrices = Array.from(new Set(crawledEvidence.match(/\$(?:[0-9]{1,4}(?:\.[0-9]{2})?)\s*(?:CAD|\$|\b)/gi) || [])).slice(0, 8);

      const prompt = `Act as the Master Industrial Tool Data Architect for Professional Trades & Shopify Catalog Specialist.
You must synthesize complete, authoritative, 100% accurate Shopify product catalog data for: "${brand} ${sku}".

${getMatchingTaxonomyRules(brand, sku)}

${officialMfrTitle ? `VERIFIED OFFICIAL LIVE MANUFACTURER PRODUCT PAGE:\nOfficial Product Name: "${officialMfrTitle}" (Source: ${officialMfrSource})\nCRITICAL MANDATE: The manufacturer's official website confirms this item is strictly "${officialMfrTitle}". Base the item identity, title, specifications, and features 100% on this exact product. Never confuse it with a different capacity tank or complete kit.` : ''}

${systemTitleHint ? `VERIFIED ENTERPRISE ERP / EBMS ITEM DESCRIPTION:\n"${systemTitleHint}"\nCRITICAL DIRECTIVE: The user's internal enterprise inventory system identifies this item as: "${systemTitleHint}". This is the ground-truth definition of this part.` : ''}

${detectedUpcs.length > 0 ? `DETECTED OFFICIAL UPC / GTIN CANDIDATES IN CRAWL:\n${detectedUpcs.join(', ')}\nOutput strictly the matching valid 12-digit UPC for this SKU.` : 'NO VERIFIED UPC FOUND IN CRAWLED DATA: You must set "barcode": "" (empty string). NEVER fabricate or invent a UPC.'}

${detectedPrices.length > 0 ? `DETECTED CANADIAN COMPETITOR PRICING (CAD):\n${detectedPrices.join(', ')}` : ''}

LIVE CRAWLED DISTRIBUTOR & SEARCH EVIDENCE:
${crawledEvidence ? crawledEvidence.slice(0, 9000) : 'Base synthesis on verified manufacturer catalog standards for this exact brand and SKU.'}

INSTRUCTIONS FOR CATALOG EXCELLENCE (AI STUDIO GOLD STANDARD):
1. TITLE:
   - Format: "[Brand] [SKU] [Exact Model / Product Name] - [Color if applicable] - [Size / Key Specs]"
   - Examples:
     * "Badger Tool Belts 461055-LG Carpenter Tool Belt Set - Olive Drab - Large"
     * "Milwaukee 49-66-6801 SHOCKWAVE Impact Duty 3/8" Drive Metric Deep Well PACKOUT Socket Set - 19 Piece"
     * "Milwaukee 0931-20 6.5 Peak HP Wet/Dry Vacuum Motor Head"
     * "Stealth ST08-2502 2-1/2" x 20" Universal Wet/Dry Vacuum Extension Wand"
   - Never truncate, abbreviate, or hallucinate different colors, specs, or tools.

2. BODY (HTML):
   - Overview: 1-2 punchy, professional trade sentences. NO fluff, NO promotional dealer intros.
   - Features: "<h3>Key Features</h3><ul>" with 4-6 distinct bullet points formatted as "<li><strong>Feature Title:</strong> Detailed trade benefit</li>". (Never duplicate bullet points inside the overview).
   - Specifications: "<h3>Specifications</h3><table style='width: 100%; border-collapse: collapse; margin-top: 10px;'><tbody>" with alternating row background styling listing all physical & technical specs (Material, Color, Waist Size, Buckle Type, Pockets, Weight, Country of Origin, etc.).
   - Includes: "<h3>What's Included</h3>" detailing exact package contents.
   - Warranty: "<h3>Manufacturer Warranty</h3>" stating the exact official manufacturer warranty.

3. ACCURACY, PRICING, ZERO-HALLUCINATION BARCODE & SEO:
   - Provide realistic Canadian Market MSRP in CAD dollars.
   - Barcode: Provide strictly the verified numeric UPC from crawled data. IF NO VERIFIED UPC EXISTS, OUTPUT AN EMPTY STRING "". NEVER GUESS OR INVENT A UPC CODE.
   - SEO Title: Clean SEO meta title (max 60 characters): "[Brand] [SKU] [Clean Title] | Wise Line Tools Canada"
   - SEO Description: Clean, keyword-dense SEO meta description (145-160 characters) highlighting authorized Canadian distributor, genuine manufacturer warranty, and trade specs.
   - Correct standard Shopify taxonomy category (e.g., "Hardware > Tool Belts & Holders").
   - Trade-accurate Product Type (e.g., "Tool Belt Sets", "Impact Socket Sets") and rich search tags.

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
  "tags": "...",
  "seo_title": "...",
  "seo_description": "...",
  "included_in_box": ["..."]
}`;

      const ai = new GoogleGenAI({ apiKey });
      const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];
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
      const storeDomain = (req.headers['x-shopify-store'] || process.env.SHOPIFY_STORE_DOMAIN || 'wise-line-tools-one.myshopify.com').trim();
      const accessToken = (req.headers['x-shopify-access-token'] || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '').trim();
      const apiVersion = (req.headers['x-shopify-api-version'] || process.env.SHOPIFY_API_VERSION || '2025-01').trim();

      let cleanStore = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (!cleanStore.includes('.')) cleanStore += '.myshopify.com';

      const targetUrl = `https://${cleanStore}/admin/api/${apiVersion}/graphql.json`;
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      const shopifyRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
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
