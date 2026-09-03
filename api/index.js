import { GoogleGenAI } from '@google/genai';

function isImageMatchingSkuModel(imgUrl, brand, sku) {
  const lower = String(imgUrl || '').toLowerCase();
  const lowerSku = String(sku || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const lowerBrand = String(brand || '').toLowerCase();
  const filename = (lower.split('?')[0].split('/').pop() || '').toLowerCase();
  
  // Marketplaces and user-generated photo sites (STRICT BLOCK - ZERO TOLERANCE)
  if (lower.includes('ebay') || lower.includes('ebayimg') || lower.includes('s-l1600') || lower.includes('s-l500') || lower.includes('s-l300') ||
      lower.includes('walmart') || lower.includes('craigslist') || lower.includes('mercari') || lower.includes('poshmark') ||
      lower.includes('offerup') || lower.includes('facebook') || lower.includes('kijiji') || lower.includes('worthpoint') ||
      lower.includes('picclick') || lower.includes('carousell') || lower.includes('aliexpress') || lower.includes('temu') ||
      lower.includes('amazon') || lower.includes('media-amazon') || lower.includes('preview.redd.it') || lower.includes('pinimg.com')) {
    return false;
  }

  // Site navigation, social icons, banners, flags, and UI elements
  if (lower.includes('1920x960') || lower.includes('930x600') || lower.includes('70x30') || 
      lower.includes('country/') || lower.includes('/flags/') || lower.includes('ca.png') || 
      lower.includes('banner') || lower.includes('header') || lower.includes('slider') ||
      lower.includes('icon') || lower.includes('logo') || lower.includes('watermark') ||
      lower.includes('linkedin') || lower.includes('instagram') || lower.includes('nav-') ||
      lower.includes('menu-') || lower.includes('lang-') || lower.includes('makita.jpg')) {
    return false;
  }

  // 1. DeWalt strict model isolation (Check FILENAME only, not random UUIDs)
  if (lowerBrand.includes('dewalt')) {
    const numMatch = lowerSku.match(/([0-9]{3,4})/);
    if (numMatch) {
      const modelNum = numMatch[1];
      if (!filename.includes(modelNum) && !filename.includes(lowerSku.slice(0, 6))) {
        return false;
      }
    }
  } 
  // 2. Milwaukee strict model isolation
  else if (lowerBrand.includes('milwaukee')) {
    const numMatch = lowerSku.match(/([0-9]{4})/);
    if (numMatch) {
      const modelNum = numMatch[1];
      if (!filename.includes(modelNum) && !lower.includes('milwaukeetool') && !lower.includes('/--/web-images/sc/')) {
        return false;
      }
    }
  } 
  // 3. Makita strict model isolation (Require core model digits in filename)
  else if (lowerBrand.includes('makita')) {
    const numMatch = lowerSku.match(/([0-9]{3,4})/);
    const prefixMatch = lowerSku.match(/^([a-z]{2,3}[0-9]{2,3})/);
    const target = prefixMatch ? prefixMatch[1] : (numMatch ? numMatch[1] : lowerSku.slice(0, 5));
    if (!filename.includes(target) && !filename.includes(lowerSku)) {
      return false;
    }
  }
  // 4. Olight strict model isolation
  else if (lowerBrand.includes('olight')) {
    const olightModels = ['arkpro', 'arkfeld', 'baton', 'seeker', 'warrior', 'perun', 'marauder', 'oclip', 'javelot', 'baldr', 'valkyrie', 'i3t', 'i5t', 'i1r', 'diffuse', 'sphere'];
    const currentModel = olightModels.find(m => lowerSku.includes(m));
    if (currentModel) {
      const otherModels = olightModels.filter(m => m !== currentModel);
      if (otherModels.some(other => filename.includes(other))) {
        return false;
      }
    }
  }
  // 5. Badger / Occidental Leather strict model isolation
  else if (lowerBrand.includes('badger') || lowerBrand.includes('occidental')) {
    const numMatch = lowerSku.match(/([0-9]{5,6})/);
    if (numMatch) {
      const modelNum = numMatch[1];
      if (!filename.includes(modelNum) && !lower.includes('badgertoolbelts') && !lower.includes('occidentalleather')) {
        return false;
      }
    }
  }

        // 6. King Canada strict model isolation
  else if (lowerBrand.includes('king')) {
    const cleanDigits = lowerSku.replace(/[^a-z0-9]/g, '');
    const numMatch = lowerSku.match(/([0-9]{2,5}[a-z]{0,3})/i);
    const target = numMatch ? numMatch[1].toLowerCase() : cleanDigits;
    if (!filename.includes(target) && !filename.includes(cleanDigits) && !lower.includes(target) && !lower.includes(cleanDigits)) {
      return false;
    }
  }

  return true;
}

const NON_PRODUCT_BLOCKLIST = [
  'linkedin', 'instagram', 'twitter', 'facebook', 'tiktok', 'nav-', 'menu-', 'lang-', 'header-', 'footer-', 'badge-', 'icon-', '-icn', 'icn-', 'app-store', 'google-play',
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
    let clean = rawUrl.trim().replace(/^http:\/\//i, 'https://').replace(/\\\//g, '/').replace(/\\"/g, '"');
    const u = new URL(clean);
    if (u.hostname.includes('shopify.com') || u.pathname.includes('/cdn/shop/')) {
      u.search = '';
      u.pathname = u.pathname.replace(/_[0-9]+x[0-9]+(?=\.[a-z0-9]+$)/i, '_1024x1024')
                             .replace(/_(?:small|thumb|compact|medium|large|grande)(?=\.[a-z0-9]+$)/i, '_1024x1024');
    } else if (u.hostname.includes('dewalt.com') || u.hostname.includes('dewalt.ca')) {
      u.search = '';
      u.pathname = u.pathname.replace(/_(?:320|640|160)\.webp$/i, '_1280.webp');
    } else if (u.hostname.includes('insitecloud.net') || u.pathname.includes('insitecloud.net')) {
      u.search = '';
      u.pathname = u.pathname.replace(/_(?:sm|md|thumb)(?=\.[a-z0-9]+$)/i, '_lg');
    } else if (u.pathname.includes('/stencil/')) {
      u.pathname = u.pathname.replace(/\/stencil\/\d+x\d+\//, '/stencil/1000x1000/').replace(/\/stencil\/\d+w\//, '/stencil/1000x1000/');
    } else if (u.hostname.includes('olightstore.com') || u.hostname.includes('olightstore.ca')) {
      u.search = '';
      u.pathname = u.pathname.replace(/@.*$/, '');
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function getCanonicalAssetKey(url) {
  try {
    const clean = url.trim().replace(/^https?:\/\//i, '').split('?')[0];
    let filename = clean.split('/').pop() || '';
    filename = filename
      .toLowerCase()
      .replace(/\.(webp|jpg|jpeg|png|gif)$/i, '')
      .replace(/_(?:1280|1680|320|640|1024x1024|2048x2048|lg|md|sm|thumb|medium|large|small)/g, '')
      .replace(/__\d+.*$/, '')
      .replace(/[-_]ecomm.*$/i, '')
      .replace(/^ecomm[-_]/i, '');
    return filename;
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

  const parsedUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const { pathname } = parsedUrl;

  if (pathname === '/api/ai/synthesize' && req.method === 'POST') {
    try {
      const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
      let bodyData = req.body;
      if (typeof bodyData === 'string') {
        try { bodyData = JSON.parse(bodyData); } catch (e) {}
      }

      const { brand = '', sku = '', systemTitleHint = '', existingContext = {} } = bodyData || {};
      if (!brand && !sku) {
        return res.status(400).json({ error: 'Brand and SKU are required' });
      }

      const cleanMfrSku = sku.replace(/^WLT[-_]/i, '').trim();
      let crawledEvidence = '';
      const crawledSourceUrls = [];
      const discoveredImages = [];
      const candidateProductUrls = [];
      const lowerBrand = brand.toLowerCase();

            // 1. Direct official manufacturer URLs & High-Res Studio CDNs
      if (lowerBrand.includes('dewalt')) {
        const dSku = cleanMfrSku.toUpperCase();
        candidateProductUrls.push(`https://www.dewalt.com/product/${cleanMfrSku.toLowerCase()}`);
        candidateProductUrls.push(`https://www.dewalt.ca/product/${cleanMfrSku.toLowerCase()}`);
        candidateProductUrls.push(`https://www.dewalt.com/en-us/search?search=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://www.dewalt.ca/en-ca/search?search=${encodeURIComponent(cleanMfrSku)}`);
        
        discoveredImages.push(`https://assets.dewalt.com/NAG/PRODUCT/IMAGES/HIRES/WHITEBG/${dSku}_1_1280.webp`);
        discoveredImages.push(`https://assets.dewalt.com/NAG/PRODUCT/IMAGES/HIRES/WHITEBG/${dSku}_2_1280.webp`);
        discoveredImages.push(`https://assets.dewalt.com/NAG/PRODUCT/IMAGES/HIRES/WHITEBG/${dSku}_3_1280.webp`);
        discoveredImages.push(`https://assets.dewalt.com/NAG/PRODUCT/IMAGES/HIRES/WHITEBG/${dSku}_4_1280.webp`);
        discoveredImages.push(`https://assets.dewalt.com/NAG/PRODUCT/IMAGES/HIRES/WHITEBG/${dSku}_A1_1280.webp`);
      } else if (lowerBrand.includes('milwaukee')) {
        const mSku = cleanMfrSku.toUpperCase();
        candidateProductUrls.push(`https://www.milwaukeetool.ca/Products/${cleanMfrSku}`);
        candidateProductUrls.push(`https://www.milwaukeetool.com/Products/${cleanMfrSku}`);
        candidateProductUrls.push(`https://www.milwaukeetool.ca/products/details/${cleanMfrSku.toLowerCase()}`);
        
        discoveredImages.push(`https://milwaukeetool.scene7.com/is/image/MilwaukeeTool/${mSku}?wid=1000&hei=1000&fit=fit&qlt=85,0&resMode=sharp2`);
        discoveredImages.push(`https://milwaukeetool.scene7.com/is/image/MilwaukeeTool/${mSku}_1?wid=1000&hei=1000&fit=fit&qlt=85,0&resMode=sharp2`);
        discoveredImages.push(`https://milwaukeetool.scene7.com/is/image/MilwaukeeTool/${mSku}_2?wid=1000&hei=1000&fit=fit&qlt=85,0&resMode=sharp2`);
        discoveredImages.push(`https://milwaukeetool.scene7.com/is/image/MilwaukeeTool/${mSku}_3?wid=1000&hei=1000&fit=fit&qlt=85,0&resMode=sharp2`);
        discoveredImages.push(`https://milwaukeetool.scene7.com/is/image/MilwaukeeTool/${mSku}_4?wid=1000&hei=1000&fit=fit&qlt=85,0&resMode=sharp2`);
        discoveredImages.push(`https://milwaukeetool.scene7.com/is/image/MilwaukeeTool/${mSku}_hero?wid=1000&hei=1000&fit=fit&qlt=85,0&resMode=sharp2`);
      } else if (lowerBrand.includes('makita')) {
        const makSku = cleanMfrSku.toLowerCase();
        candidateProductUrls.push(`https://www.makita.ca/index2.php?event=toolsearch&toolno=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://www.makitatools.com/products/details/${cleanMfrSku}`);
        
        discoveredImages.push(`https://dtis8tdmkp4fg.cloudfront.net/products/cordless/xgt-40v-80v-max/drills-fastening/impact-wrenches/${makSku}/${makSku}-001.jpg`);
        discoveredImages.push(`https://dtis8tdmkp4fg.cloudfront.net/products/cordless/xgt-40v-80v-max/drills-fastening/impact-wrenches/${makSku}/${makSku}-002.jpg`);
        discoveredImages.push(`https://dtis8tdmkp4fg.cloudfront.net/products/cordless/lxt-18v/drills-fastening/impact-drivers/${makSku}/${makSku}-001.jpg`);
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
            let html = await crawlRes.text();
            html = html.replace(/\\\//g, '/').replace(/\\"/g, '"');
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

            // 3. Multi-Query Deep Web Search
      try {
        const ddgQueries = [
          `"${brand}" "${sku}" Canada`,
          `"${cleanMfrSku}" "UPC"`,
          `"${brand}" "${cleanMfrSku}" ${systemTitleHint ? `"${systemTitleHint}"` : 'specifications price CAD'}`.trim()
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
                  if (!u.includes('youtube.com') && !u.includes('wikipedia.org') && !u.includes('ebay.') && !u.includes('walmart.') && candidateProductUrls.length < 15) {
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
              let pHtml = await pRes.text();
              pHtml = pHtml.replace(/\\\//g, '/').replace(/\\"/g, '"');
                            if (pUrl.includes('milwaukeetool.')) {
                const mkeGalleryRegex = /(?:https:\/\/www\.milwaukeetool\.(?:com|ca))?\/--\/web-images\/sc\/([a-f0-9]{20,})/gi;
                let mm;
                while ((mm = mkeGalleryRegex.exec(pHtml)) !== null) {
                  const fullImg = `https://www.milwaukeetool.ca/--/web-images/sc/${mm[1]}`;
                  const key = getCanonicalAssetKey(fullImg);
                  if (!seenAssetKeys.has(key)) {
                    seenAssetKeys.add(key);
                    mfrStudioImages.push(fullImg);
                  }
                }
              }

              const isMfrDomain = pUrl.includes('milwaukeetool.') || pUrl.includes('dewalt.') || pUrl.includes('makitatools.') || pUrl.includes('stealthvacs.') || pUrl.includes('malcopro.') || pUrl.includes('knipex.') || pUrl.includes('wihatools.') || pUrl.includes('oxtools.') || pUrl.includes('badgertoolbelts.') || pUrl.includes('occidentalleather.');

              if (isMfrDomain && !officialMfrTitle) {
                const h1Match = pHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
                if (h1Match) {
                  officialMfrTitle = h1Match[1].replace(/<[^>]+>/g, '').trim();
                  officialMfrSource = pUrl;
                }
              }

              // Extract images from crawled product pages
              const pageImgRegex = /https?:\/\/[^"'\s\\]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s\\]*)?/gi;
              let im;
              while ((im = pageImgRegex.exec(pHtml)) !== null) {
                let imgCandidate = im[0].replace(/[,\\]+$/, '').trim();
                const lower = imgCandidate.toLowerCase();
                if (!NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k)) && isImageMatchingSkuModel(imgCandidate, brand, sku)) {
                  const canonical = normalizeAndCanonicalizeUrl(imgCandidate);
                  const key = getCanonicalAssetKey(canonical);
                  if (!seenAssetKeys.has(key)) {
                    seenAssetKeys.add(key);
                    if (isMfrDomain) mfrStudioImages.push(canonical);
                    else secondaryImages.push(canonical);
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

            // Universal Direct High-Res Image Search
      if (mfrStudioImages.length + secondaryImages.length < 5) {
        try {
          const bQueries = [
            `"${brand}" "${sku}"`.trim(),
            `"${brand}" "${cleanMfrSku}"`.trim(),
            systemTitleHint ? `"${brand}" "${cleanMfrSku}" "${systemTitleHint}"` : `"${cleanMfrSku}" "${brand}"`
          ];
          for (const bq of bQueries) {
            const bUrl = `https://www.bing.com/images/async?q=${encodeURIComponent(bq)}&first=0&count=15&mmasync=1`;
            const bRes = await fetch(bUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: AbortSignal.timeout(2200) });
            if (bRes.ok) {
              const bHtml = await bRes.text();
              const matches = bHtml.match(/murl&quot;:&quot;([^&"]+)/gi) || [];
              for (const m of matches.slice(0, 12)) {
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

SOURCE TRUTH HIERARCHY:
1. OFFICIAL MANUFACTURER PORTAL (dewalt.ca, milwaukeetool.ca, makitatools.com, etc.): Primary ground truth for exact product title, engineered specifications, included items, and core feature benefits.
2. CANADIAN INDUSTRIAL DISTRIBUTORS (Atlas Machinery, Mississauga Hardware, Tegs Tools, KMS Tools, BC Fasteners, The Tool Store, Home Depot Canada): Source for Canadian CAD pricing (MSRP), trade categorization, and verified GTIN/UPC barcodes.

${officialMfrTitle ? `VERIFIED OFFICIAL LIVE MANUFACTURER PRODUCT PAGE:\nOfficial Product Name: "${officialMfrTitle}" (Source: ${officialMfrSource})\nCRITICAL MANDATE: The manufacturer's official website confirms this item is strictly "${officialMfrTitle}". Base the item identity, title, specifications, and features 100% on this exact product.` : ''}

${systemTitleHint ? `VERIFIED ENTERPRISE ERP / EBMS ITEM DESCRIPTION:\n"${systemTitleHint}"` : ''}

${detectedUpcs.length > 0 ? `DETECTED OFFICIAL UPC / GTIN CANDIDATES IN CRAWL:\n${detectedUpcs.join(', ')}\nOutput strictly the matching valid 12-digit UPC for this SKU.` : 'NO VERIFIED UPC FOUND IN CRAWLED DATA: Set "barcode": "" (empty string). NEVER fabricate a UPC.'}

${detectedPrices.length > 0 ? `DETECTED CANADIAN COMPETITOR PRICING (CAD):\n${detectedPrices.join(', ')}` : ''}

LIVE CRAWLED DISTRIBUTOR & SEARCH EVIDENCE:
${crawledEvidence ? crawledEvidence.slice(0, 9000) : 'Base synthesis on verified manufacturer catalog standards for this exact brand and SKU.'}

INSTRUCTIONS FOR CATALOG EXCELLENCE:
1. TITLE:
   - Format: "[Brand] [SKU] [Exact Model / Product Name] - [Color if applicable] - [Size / Key Specs]"
   - Examples:
     * "DeWalt DCF850B ATOMIC 20V MAX 1/4 in. 3-Speed Brushless Impact Driver - Tool Only"
     * "Milwaukee 0892-20 M18 Brushless Handheld Vacuum - Tool Only"
     * "Makita TW002GZ 40V Max XGT Brushless 1/2 in. Impact Wrench - Tool Only"

2. BODY (HTML):
   - Overview: 2-3 detailed, high-impact technical sentences explaining the engineered design, brushless motor efficiency, compact dimensions, and professional trade applications.
   - Features: "<h3>Key Features</h3><ul>" with 5-7 distinct bullet points formatted as "<li><strong>Feature Title:</strong> Detailed trade benefit and technical description</li>".
   - Specifications: "<h3>Specifications</h3><table style='width: 100%; border-collapse: collapse; margin-top: 10px;'><tbody>" with alternating row background styling listing all physical & technical specs (Voltage, Chuck/Drive Size, Max Torque in in-lbs & Nm, Max RPM, Impacts Per Minute (IPM), Length, Weight, Motor Type, LED Work Lights, Country of Origin, etc.).
   - Includes: "<h3>What's Included</h3><ul>" detailing exact package contents (e.g. Bare Tool, Belt Hook, Manual).
   - Warranty: "<h3>Manufacturer Warranty</h3>" stating the exact official manufacturer warranty.

3. ACCURACY, PRICING, ZERO-HALLUCINATION BARCODE & SEO:
   - Realistic Canadian Market MSRP in CAD dollars.
   - Barcode: Provide strictly the verified numeric UPC from crawled data. IF NO VERIFIED UPC EXISTS, OUTPUT AN EMPTY STRING "". NEVER GUESS A UPC.
   - SEO Title: "[Brand] [SKU] [Clean Title] | Wise Line Tools Canada"
   - SEO Description: Keyword-dense meta description (145-160 characters) highlighting authorized Canadian distributor, genuine manufacturer warranty, and trade specs.
   - Standard Shopify taxonomy category and trade-accurate Product Type.

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

      if (parsedData) {
        if (officialMfrTitle && officialMfrTitle.length > 3) {
          const lowerParsed = (parsedData.title || '').toLowerCase();
          const lowerMfr = officialMfrTitle.toLowerCase();
          if (lowerMfr.includes('vacuum') && !lowerParsed.includes('vacuum') && !lowerParsed.includes('vac')) {
            parsedData.title = `${brand} ${sku} ${officialMfrTitle}`;
            parsedData.product_type = 'Handheld Vacuums';
            parsedData.google_category = 'Hardware > Tools > Power Tools > Dust Extractors & Wet/Dry Vacuums';
          } else if (lowerMfr.includes('impact driver') && !lowerParsed.includes('impact driver')) {
            parsedData.title = `${brand} ${sku} ${officialMfrTitle}`;
            parsedData.product_type = 'Impact Drivers';
            parsedData.google_category = 'Hardware > Tools > Power Tools > Impact Drivers & Wrenches';
          }
        }
      }

                  // Pre-validate all candidate images with parallel HTTP GET/HEAD verification
      const lowerSku = String(sku || '').toLowerCase();
      const isBareTool = lowerSku.endsWith('b') || lowerSku.endsWith('-20') || lowerSku.endsWith('z') || lowerSku.includes('bare') || lowerSku.endsWith('-0');

      const rawCandidateImages = Array.from(new Set(discoveredImages))
        .filter(url => isImageMatchingSkuModel(url, brand, sku))
        .filter(url => {
          if (!isBareTool) return true;
          const lower = url.toLowerCase();
          const filename = (lower.split('?')[0].split('/').pop() || '').toLowerCase();
          
          if (lowerBrand.includes('dewalt')) {
            if (filename.includes('_k1') || filename.includes('_k2') || filename.includes('p1_') || filename.includes('p2_') || filename.includes('e1_') || filename.includes('e2_')) {
              return false;
            }
          } else if (lowerBrand.includes('milwaukee')) {
            if (filename.includes('-22_') || filename.includes('-21_') || filename.includes('-24_') || filename.includes('packout_kit')) {
              return false;
            }
          } else if (lowerBrand.includes('makita')) {
            if (filename.includes('m201') || filename.includes('t2_') || filename.includes('ct_')) {
              return false;
            }
          }
          return true;
        });

      const validatedCleanImages = [];
      const seenFingerprints = new Set();

      await Promise.allSettled(rawCandidateImages.slice(0, 25).map(async (imgUrl) => {
        try {
          const checkRes = await fetch(imgUrl, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(1800)
          });
          if (checkRes.ok) {
            const cType = checkRes.headers.get('content-type') || '';
            if (cType.includes('image') || cType.includes('application/octet-stream') || checkRes.status === 200) {
              const baseKey = getCanonicalAssetKey(imgUrl);
              if (!seenFingerprints.has(baseKey)) {
                seenFingerprints.add(baseKey);
                validatedCleanImages.push(imgUrl);
              }
            }
          }
        } catch (e) {}
      }));

      // Sort images: official white-background studio images first, then distributor gallery
      validatedCleanImages.sort((a, b) => {
        const aHero = a.includes('_1_1280') || a.includes('_1.jpg') || a.includes('001.jpg');
        const bHero = b.includes('_1_1280') || b.includes('_1.jpg') || b.includes('001.jpg');
        if (aHero && !bHero) return -1;
        if (!aHero && bHero) return 1;
        return 0;
      });

      return res.status(200).json({
        success: true,
        data: parsedData,
        images: validatedCleanImages.slice(0, 16)
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
      return res.status(500).json({ error: err.message || 'GraphQL Proxy Failed' });
    }
  }

  return res.status(404).json({ error: 'Endpoint Not Found' });
}
