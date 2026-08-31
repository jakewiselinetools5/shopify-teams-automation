import * as XLSX_PKG from 'xlsx';
import { ProductRow, Mapping } from '../types';
import { GoogleGenAI } from "@google/genai";
import { resolveShopifyToolCategory } from '../constants';

// Handle ESM import variations for xlsx-js-style
// @ts-ignore
const XLSX = XLSX_PKG.default || XLSX_PKG;

// --- CONSTANTS ---
const getEffectiveApiKey = (passedKey?: string): string => {
  if (passedKey && typeof passedKey === 'string' && passedKey.trim().length > 5) return passedKey.trim();
  if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  if (typeof window !== 'undefined' && (window as any).GEMINI_API_KEY) return (window as any).GEMINI_API_KEY.trim();
  return process.env.GEMINI_API_KEY || '';
};

export const normalizeVendor = (raw: string): string => {
    if (!raw) return '';
    let v = String(raw).trim().toUpperCase();
    if (v.startsWith('MILWAUKEE')) return 'MILWAUKEE';
    if (v.startsWith('BOSCH')) return 'BOSCH';
    if (v.startsWith('DEWALT')) return 'DEWALT';
    if (v.startsWith('MAKITA')) return 'MAKITA';
    if (v.startsWith('BLUESTREAK') || v.startsWith('BLUE STREAK')) return 'BLUESTREAK';
    return v;
};

/**
 * Researches and generates an accurate, high-impact warranty block HTML and metadata
 * with brand-specific and category-specific precision for the Canadian tool market.
 */
export const generateWarrantyBlock = (
    brand: string, 
    sku: string, 
    warrantyPeriod?: string, 
    warrantyDetails?: string,
    title?: string,
    productType?: string
): { html: string; period: string; details: string } => {
    const cleanBrand = (brand || '').trim().toUpperCase();
    const cleanSku = (sku || '').trim().toUpperCase();
    const textContext = `${cleanBrand} ${cleanSku} ${title || ''} ${productType || ''}`.toUpperCase();

    let resolvedPeriod = (warrantyPeriod || '').trim();
    let resolvedDetails = (warrantyDetails || '').trim();

    if (!resolvedPeriod || resolvedPeriod.length < 3) {
        if (cleanBrand.includes('MILWAUKEE')) {
            if (textContext.includes('MX FUEL') || textContext.includes('MXF')) {
                resolvedPeriod = '2-Year Equipment & 2-Year Battery Warranty';
                resolvedDetails = 'Milwaukee MX FUEL light equipment, batteries, and chargers are backed by a 2-year limited warranty against defects in materials and workmanship, supported by Milwaukee authorized service centers across Canada.';
            } else if (textContext.includes('HAND TOOL') || textContext.includes('PLIER') || textContext.includes('KNIFE') || textContext.includes('TAPE MEASURE') || textContext.includes('LEVEL') || textContext.includes('WRENCH') || textContext.includes('SCREWDRIVER') || textContext.includes('HAMMER') || textContext.includes('SOCKET') || textContext.includes('RATCHET') || textContext.includes('FASTBACK') || textContext.includes('SNIP') || textContext.includes('CHISEL')) {
                resolvedPeriod = 'Limited Lifetime Warranty';
                resolvedDetails = 'Every Milwaukee hand tool is warranted to the original purchaser to be free from defects in material and workmanship for the normal useful life of the tool.';
            } else if (textContext.includes('HEATED') || textContext.includes('JACKET') || textContext.includes('HOODIE') || textContext.includes('VEST')) {
                resolvedPeriod = '1-Year Limited Warranty';
                resolvedDetails = 'Milwaukee heated gear jackets, hoodies, and power sources are covered by a 1-year limited warranty against defects in materials and craftsmanship.';
            } else if (textContext.includes('BATTERY') || textContext.includes('CHARGER') || textContext.includes('REDLITHIUM')) {
                resolvedPeriod = '3-Year Battery Warranty';
                resolvedDetails = 'Milwaukee REDLITHIUM XC, High Output, and FORGE battery packs carry a 3-year limited warranty (2-year on compact CP batteries) with hassle-free serial number tracking.';
            } else {
                resolvedPeriod = '5-Year Limited Tool Warranty';
                resolvedDetails = 'Milwaukee heavy-duty cordless power tools (M12, M18, and FUEL) include a 5-year limited manufacturer warranty covering defects in material and workmanship, serviceable across authorized Canadian hubs.';
            }
        } else if (cleanBrand.includes('DEWALT')) {
            if (textContext.includes('HAND TOOL') || textContext.includes('MECHANIC') || textContext.includes('SOCKET') || textContext.includes('RATCHET') || textContext.includes('WRENCH')) {
                resolvedPeriod = 'Full Lifetime Warranty';
                resolvedDetails = 'DEWALT hand and mechanics tools carry a full lifetime warranty. If any mechanics tool fails to perform, DEWALT will replace it hassle-free.';
            } else if (textContext.includes('LASER') || textContext.includes('LEVEL')) {
                resolvedPeriod = '3-Year Limited Warranty / 1-Year Free Service';
                resolvedDetails = 'DEWALT guarantees this laser with a 3-Year Limited Warranty, 1-Year Free Service Contract, and 90-Day Money-Back Guarantee.';
            } else {
                resolvedPeriod = '3-Year Limited Warranty / 1-Year Free Service / 90-Day Guarantee';
                resolvedDetails = 'DEWALT warrants this product with a 3-Year Limited Warranty, 1-Year Free Service Contract, and 90-Day Money-Back Guarantee through authorized Canadian warranty service centers.';
            }
        } else if (cleanBrand.includes('MAKITA')) {
            if (textContext.includes('GAS') || textContext.includes('PNEUMATIC')) {
                resolvedPeriod = '1-Year Limited Warranty';
                resolvedDetails = 'Makita warrants this pneumatic or gas equipment against defects in workmanship and materials for 1 year from original purchase date.';
            } else {
                resolvedPeriod = '3-Year Limited Warranty';
                resolvedDetails = 'Every Makita lithium-ion cordless power tool, battery, and charger is warranted to be free of defects from workmanship and materials for a period of 3 years from the original purchase date.';
            }
        } else if (cleanBrand.includes('BOSCH')) {
            if (textContext.includes('MEASURING') || textContext.includes('LASER')) {
                resolvedPeriod = '2-Year Limited Warranty';
                resolvedDetails = 'Bosch measuring and laser layout tools are covered by a 2-year limited warranty with product registration, ensuring jobsite calibration and repair.';
            } else {
                resolvedPeriod = '1-Year Limited (Extendable to 3-Year PROVantage)';
                resolvedDetails = 'Bosch Cordless 18V Tools include a 1-year limited warranty, extendable up to 3 years with complimentary Bosch PROVantage registration.';
            }
        } else if (cleanBrand.includes('KLEIN')) {
            resolvedPeriod = 'Lifetime Warranty';
            resolvedDetails = 'Klein Tools products are manufactured for normal life and warranted to be free from defects in materials and workmanship for the useful life of the product.';
        } else if (cleanBrand.includes('FESTOOL')) {
            resolvedPeriod = '3-Year All-Inclusive Warranty (Wear & Tear Covered)';
            resolvedDetails = 'Festool 3-Year All-Inclusive warranty covers all manufacturing defects, wear-and-tear repair costs, theft protection, and guaranteed 10-year spare parts availability.';
        } else if (cleanBrand.includes('KNIPEX') || cleanBrand.includes('WERA') || cleanBrand.includes('WIHA') || cleanBrand.includes('CHANNELLOCK') || cleanBrand.includes('CRESCENT')) {
            resolvedPeriod = 'Lifetime Manufacturer Warranty';
            resolvedDetails = 'Guaranteed against defects in material and workmanship under normal professional trade use for the lifetime of the product.';
        } else if (cleanBrand.includes('DIABLO') || cleanBrand.includes('FREUD')) {
            resolvedPeriod = 'Limited Lifetime Warranty';
            resolvedDetails = 'Diablo cutting tools, blades, and router bits are warranted against defects in materials and workmanship for the life of the tool.';
        } else if (cleanBrand.includes('OLIGHT')) {
            resolvedPeriod = 'Lifetime Limited Warranty';
            resolvedDetails = 'Olight products are covered by Olight Lifetime Limited Manufacturer Warranty against defects in materials and craftsmanship in North America.';
        } else if (cleanBrand.includes('BADGER') || cleanBrand.includes('OCCIDENTAL')) {
            resolvedPeriod = '2-Year Manufacturer Warranty';
            resolvedDetails = 'Occidental Leather & Badger Tool Belts 2-year manufacturer warranty covering defects in craftsmanship and materials under normal trade use.';
        } else {
            resolvedPeriod = 'Manufacturer Limited Warranty';
            resolvedDetails = 'Backed by official manufacturer warranty against defects in materials and workmanship under standard commercial and industrial operating conditions.';
        }
    }

    if (!resolvedDetails) {
        resolvedDetails = `Backed by ${cleanBrand || 'manufacturer'} warranty coverage against defects in materials and workmanship. Supported by authorized Canadian distribution centers.`;
    }

    // High-impact, responsive, styled HTML warranty block that looks exceptional in Shopify and web views
    const html = `
<div class="product-warranty-block" style="margin-top: 36px; padding: 22px 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
    <h4 style="margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #0f172a; display: flex; align-items: center; gap: 8px;">
      <svg style="width: 18px; height: 18px; color: #10b981; fill: currentColor; flex-shrink: 0;" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
      Manufacturer Warranty & Guarantee
    </h4>
    <span style="display: inline-block; font-size: 11px; font-weight: 800; color: #065f46; background: #d1fae5; border: 1px solid #a7f3d0; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;">
      ${resolvedPeriod}
    </span>
  </div>
  <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #1e293b;">
    <strong>Coverage:</strong> ${resolvedPeriod}
  </p>
  <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #475569;">
    ${resolvedDetails}
  </p>
</div>`.trim();

    return {
        html,
        period: resolvedPeriod,
        details: resolvedDetails
    };
};

/**
 * Derives a canonical fingerprint/key for an image URL to identify duplicates across
 * different resolutions, query parameters, proxy wrappers, and CDN variants.
 */
export const getCanonicalAssetKey = (url: string) => getImageFingerprint(url);
export const getImageFingerprint = (url: string): string => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) {
    // For base64 images, use the first 120 chars as fingerprint
    return trimmed.substring(0, 120);
  }

  try {
    const parsed = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : (trimmed.startsWith('http') ? trimmed : `https://${trimmed}`));
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let pathname = parsed.pathname.toLowerCase();

    // 1. Scene7 / Adobe Dynamic Media (e.g. /is/image/milwaukeetool/48-22-8424_hero?$...)
    if (hostname.includes('scene7') || hostname.includes('milwaukeetool') || hostname.includes('sbdinc') || hostname.includes('dewalt')) {
      const isImageMatch = pathname.match(/\/is\/image\/[^\/]+\/([^\/?#]+)/i);
      if (isImageMatch) {
        return `scene7:${isImageMatch[1].toLowerCase()}`;
      }
    }

    // 2. Shopify CDN (e.g. /files/48-22-8424_hero_2048x2048.jpg or /products/48-22-8424_large.png)
    if (hostname.includes('shopify') || hostname.includes('cdn.shopify.com')) {
      // Strip resolution suffixes like _2048x2048, _1024x1024, _grande, _medium, _small, etc.
      const cleanedShopify = pathname.replace(/_(?:pico|icon|thumb|small|compact|medium|large|grande|\d+x\d*|x\d+)\.(jpg|jpeg|png|webp|gif)$/i, '.$1');
      const filenameMatch = cleanedShopify.match(/\/([^\/?#]+)$/);
      if (filenameMatch) {
        return `shopify:${filenameMatch[1].toLowerCase()}`;
      }
    }

    // 3. Amazon Media (e.g. /images/I/71xyz._AC_SL1500_.jpg)
    if (hostname.includes('amazon')) {
      const amzMatch = pathname.match(/\/([A-Za-z0-9\-_]{8,})\.[^.\/]+\.(jpg|jpeg|png|webp)/i) || pathname.match(/\/([A-Za-z0-9\-_]{8,})\.(jpg|jpeg|png|webp)/i);
      if (amzMatch) {
        return `amazon:${amzMatch[1].toLowerCase()}`;
      }
    }

    // 4. Home Depot (thdstatic.com / homedepot.ca)
    if (hostname.includes('thdstatic') || hostname.includes('homedepot')) {
      const hdMatch = pathname.match(/\/([a-f0-9\-]{20,})\//i) || pathname.match(/\/([^\/?#]+?)(?:_(?:100|145|300|400|600|1000))?\.(?:jpg|jpeg|png|webp)/i);
      if (hdMatch) {
        return `homedepot:${hdMatch[1].toLowerCase()}`;
      }
    }

    // 5. Cloudinary / Imgix
    if (hostname.includes('cloudinary') || hostname.includes('imgix')) {
      const lastSegment = pathname.split('/').filter(Boolean).pop() || '';
      return `cdn:${lastSegment.toLowerCase()}`;
    }

    // 6. Generic clean filename match (strip dimensions, cachebusters, and common prefixes)
    const baseFilename = pathname.split('/').filter(Boolean).pop() || '';
    if (baseFilename) {
      // Strip resolution/dimension stamps like _1000x1000, -800x800, _2000, @2x
      const normalizedFilename = baseFilename
        .replace(/[-_](?:\d+x\d*|\d{3,4})(?=\.[a-z0-9]+$)/gi, '')
        .replace(/@\d+x(?=\.[a-z0-9]+$)/gi, '')
        .toLowerCase();
      
      return `${hostname}:${normalizedFilename}`;
    }

    return `${hostname}${pathname}`;
  } catch (e) {
    return trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
};

/**
 * Deduplicates an array of image URLs using both exact URL matches and
 * intelligent visual/CDN fingerprinting to weed out identical images at different resolutions.
 */
export const deduplicateImages = (urls: (string | undefined | null)[]): string[] => {
  if (!Array.isArray(urls)) return [];
  
  const seenUrls = new Set<string>();
  const seenFingerprints = new Set<string>();
  const result: string[] = [];

  for (const rawUrl of urls) {
    if (!rawUrl || typeof rawUrl !== 'string') continue;
    const clean = cleanImageUrl(rawUrl);
    if (!clean) continue;

    const lowerClean = clean.toLowerCase();
    if (seenUrls.has(lowerClean)) continue;

    const fingerprint = getImageFingerprint(clean);
    if (fingerprint && seenFingerprints.has(fingerprint)) {
      continue; // Duplicate identified through CDN/filename fingerprint
    }

    seenUrls.add(lowerClean);
    if (fingerprint) {
      seenFingerprints.add(fingerprint);
    }
    result.push(clean);
  }

  return result;
};

/**
 * Calculates a quality score for an image candidate to determine its suitability as the primary Hero photo.
 * Higher score = higher priority for position 1 (Hero).
 */
export const calculateHeroQualityScore = (url: string, brand = '', sku = ''): number => {
  if (!url || typeof url !== 'string') return -999;
  const cleanUrl = url.trim();
  const lowerUrl = cleanUrl.toLowerCase();
  let score = 100;

  // AI-generated crystal clear 3D studio shots on pure white backgrounds are top tier
  if (cleanUrl.startsWith('data:image')) {
    score += 150;
  }

  const cleanSku = (sku || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Filename & keyword boosts (Clear signs of primary hero/main product isolation)
  if (lowerUrl.includes('_hero') || lowerUrl.includes('-hero') || lowerUrl.includes('/hero')) score += 80;
  if (lowerUrl.includes('_main') || lowerUrl.includes('-main') || lowerUrl.includes('/main')) score += 70;
  if (lowerUrl.includes('_primary') || lowerUrl.includes('primary_')) score += 65;
  if (lowerUrl.includes('_iso') || lowerUrl.includes('isolated') || lowerUrl.includes('white_bg') || lowerUrl.includes('whitebg')) score += 60;
  if (lowerUrl.includes('_front') || lowerUrl.includes('front_view')) score += 50;
  if (lowerUrl.includes('_1.') || lowerUrl.includes('_01.') || lowerUrl.includes('_a1.') || lowerUrl.includes('_a.') || lowerUrl.includes('-1.') || lowerUrl.includes('-01.')) score += 45;

  // SKU exact presence in image filename
  if (cleanSku && cleanSku.length >= 3 && lowerUrl.includes(cleanSku)) {
    score += 35;
  }

  // 2. High-Trust Manufacturer CDNs & Retailer Main Galleries
  if (lowerUrl.includes('milwaukeetool.com') || lowerUrl.includes('dewalt.com') || lowerUrl.includes('makitatools.com') || lowerUrl.includes('boschtools.com') || lowerUrl.includes('sbdinc.com') || lowerUrl.includes('olightstore.com') || lowerUrl.includes('olightstore.ca')) {
    score += 30;
  }
  if (lowerUrl.includes('scene7.com')) {
    score += 25;
  }
  if (lowerUrl.includes('cdn.shopify.com')) {
    score += 15;
  }

  // 3. Heavy penalties for secondary, non-product, lifestyle, packaging, or diagram assets
  if (lowerUrl.includes('lifestyle') || lowerUrl.includes('_app') || lowerUrl.includes('in_use') || lowerUrl.includes('inuse') || lowerUrl.includes('action') || lowerUrl.includes('jobsite') || lowerUrl.includes('context')) {
    score -= 80; // Secondary angle, not hero
  }
  if (lowerUrl.includes('pkg') || lowerUrl.includes('package') || lowerUrl.includes('packaging') || lowerUrl.includes('_box') || lowerUrl.includes('carton')) {
    score -= 70; // Packaging is rarely the best main thumbnail
  }
  if (lowerUrl.includes('banner') || lowerUrl.includes('hero_banner') || lowerUrl.includes('header') || lowerUrl.includes('slide') || lowerUrl.includes('carousel')) {
    score -= 90; // Wide landscape banner graphics
  }
  if (lowerUrl.includes('dim') || lowerUrl.includes('dimension') || lowerUrl.includes('spec') || lowerUrl.includes('schematic') || lowerUrl.includes('diagram') || lowerUrl.includes('manual') || lowerUrl.includes('exploded') || lowerUrl.includes('parts')) {
    score -= 120; // Blueprint or spec diagram
  }
  if (lowerUrl.includes('icon') || lowerUrl.includes('badge') || lowerUrl.includes('logo') || lowerUrl.includes('warranty') || lowerUrl.includes('rating') || lowerUrl.includes('star')) {
    score -= 150; // Generic UI icons
  }
  if (lowerUrl.includes('_thumb') || lowerUrl.includes('_small') || lowerUrl.includes('_mini') || lowerUrl.includes('100x100') || lowerUrl.includes('150x150')) {
    score -= 60; // Tiny low-res variant
  }

  // 4. Subtle angle sorting for multi-angle sets (Position 1: Front/Hero > Angle 2 > Angle 3)
  if (lowerUrl.includes('_2.') || lowerUrl.includes('_02.') || lowerUrl.includes('_b.') || lowerUrl.includes('_a2.')) score -= 15;
  if (lowerUrl.includes('_3.') || lowerUrl.includes('_03.') || lowerUrl.includes('_c.') || lowerUrl.includes('_a3.')) score -= 25;
  if (lowerUrl.includes('_4.') || lowerUrl.includes('_04.') || lowerUrl.includes('_d.') || lowerUrl.includes('_a4.')) score -= 35;
  if (lowerUrl.includes('_5.') || lowerUrl.includes('_05.') || lowerUrl.includes('_e.') || lowerUrl.includes('_a5.')) score -= 45;

  return score;
};

/**
 * Ranks and orders product images using intelligent quality heuristics so that the cleanest,
 * highest-contrast isolated product shot is guaranteed at position 1 (Hero).
 */
export const rankImagesForHero = (urls: (string | undefined | null)[], brand = '', sku = ''): string[] => {
  const deduped = deduplicateImages(urls);
  if (deduped.length <= 1) return deduped;

  return deduped
    .map((url, originalIndex) => ({
      url,
      originalIndex,
      score: calculateHeroQualityScore(url, brand, sku)
    }))
    .sort((a, b) => {
      // Sort by score descending; if tied, preserve original discovery order
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.originalIndex - b.originalIndex;
    })
    .map(item => item.url);
};

export const upscaleImageUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return '';
  let upgraded = url.trim();

  try {
    const parsed = new URL(upgraded);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // 1. Scene7 / Adobe Dynamic Media (Milwaukee, DeWalt, Stanley, Craftsman, Black&Decker)
    if (host.includes('scene7.com') || host.includes('media.milwaukeetool.com') || host.includes('images.sbdinc.com') || host.includes('dewalt.com')) {
      parsed.searchParams.set('wid', '2000');
      parsed.searchParams.set('hei', '2000');
      parsed.searchParams.set('fmt', 'jpg');
      parsed.searchParams.set('qlt', '90');
      parsed.searchParams.set('fit', 'fit');
      parsed.searchParams.delete('crop');
      upgraded = parsed.toString().replace(/\$[^$]+?\$/g, '$zoom$');
      return upgraded;
    }

    // 2. Shopify CDN
    if (host.includes('cdn.shopify.com') || host.includes('shopify.com')) {
      upgraded = upgraded.replace(/_(?:pico|icon|thumb|small|compact|medium|large|grande|\d+x\d*|x\d+)\.(jpg|jpeg|png|webp)(\?.*)?$/i, '_2048x2048.$1$2');
      return upgraded;
    }

    // 3. Amazon Media CDN
    if (host.includes('media-amazon.com') || host.includes('images-amazon.com') || host.includes('ssl-images-amazon.com')) {
      upgraded = upgraded.replace(/\._[A-Za-z0-9_,]+_\./g, '.');
      return upgraded;
    }

    // 4. Home Depot CDN (thdstatic.com / homedepot.ca)
    if (host.includes('thdstatic.com') || host.includes('homedepot.ca') || host.includes('homedepot.com')) {
      upgraded = upgraded.replace(/\/(?:100|145|300|400|600)\.jpg/gi, '/1000.jpg');
      upgraded = upgraded.replace(/_(?:100|145|300|400|600)\.jpg/gi, '_1000.jpg');
      return upgraded;
    }

    // 5. Cloudinary
    if (host.includes('cloudinary.com') || host.includes('res.cloudinary.com')) {
      upgraded = upgraded.replace(/\/upload\/(?:[a-z0-9_,:]+\/)?/i, '/upload/q_auto,f_auto,w_2000/');
      return upgraded;
    }

    // 6. Grainger CDN
    if (host.includes('grainger.com')) {
      upgraded = upgraded.replace(/_(\d{2,3})\.(jpg|jpeg|png)/i, '_2000.$2');
      return upgraded;
    }

    // 7. General width/height query params
    if (parsed.searchParams.has('w') || parsed.searchParams.has('h') || parsed.searchParams.has('width') || parsed.searchParams.has('height')) {
      if (parsed.searchParams.has('w')) parsed.searchParams.set('w', '2000');
      if (parsed.searchParams.has('h')) parsed.searchParams.set('h', '2000');
      if (parsed.searchParams.has('width')) parsed.searchParams.set('width', '2000');
      if (parsed.searchParams.has('height')) parsed.searchParams.set('height', '2000');
      upgraded = parsed.toString();
    }
  } catch (e) {
    // If URL parsing fails, return original
  }

  return upgraded;
};

export const cleanImageUrl = (url: any): string => {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim().replace(/['"]/g, '').replace(/ /g, '%20');
  
  if (clean.startsWith('//')) clean = 'https:' + clean;
  if (clean.startsWith('http://')) clean = clean.replace('http://', 'https://');
  
  const lower = clean.toLowerCase();
  
  // STRICT BLOCKLIST: Placeholders, Badges, Icons, Ratings, Banners
  if (lower.includes('placehold.co') || 
      lower.includes('via.placeholder') || 
      lower.includes('dummyimage') ||
      lower.includes('placeholder') ||
      lower.includes('no-image') ||
      lower.includes('no_image') ||
      lower.includes('not_found') ||
      lower.includes('default_image') ||
      lower.includes('star-rating') ||
      lower.includes('shipping-truck') ||
      lower.includes('prop65') ||
      lower.includes('favicon') ||
      lower.includes('logo_small') ||
      lower.includes('badge') ||
      lower.includes('1x1') ||
      lower.includes('pixel.gif')) {
      return '';
  }

  // Filter out non-permanent or low-quality thumbnails/proxies
  if (lower.includes('gstatic.com') || 
      lower.includes('encrypted-tbn') || 
      lower.includes('googleusercontent.com') || 
      lower.includes('search_thumbnail') ||
      lower.startsWith('data:image')) {
      return '';
  }

  // Filter out bare domains or HTML pages
  try {
      const urlObj = new URL(clean);
      const path = urlObj.pathname.toLowerCase();
      if (path === '/' || path === '' || path.endsWith('.html') || path.endsWith('.php') || path.endsWith('.aspx') || path.endsWith('.jsp')) {
          return '';
      }
  } catch (e) {
      return '';
  }

  // Auto-upgrade CDN URLs to maximum available resolution
  clean = upscaleImageUrl(clean);

  return clean;
};

/**
 * Validates whether an image URL actually loads in the browser and meets minimum dimensions.
 */
export const validateImageUrl = (url: string, timeoutMs: number = 4000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return resolve(false);
    }
    
    // Quick block obvious dead patterns
    if (url.includes('placehold.co') || url.includes('via.placeholder') || url.includes('dummyimage')) {
      return resolve(false);
    }

    const img = new Image();
    let isResolved = false;

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        img.src = '';
        resolve(false);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        // Exclude tiny tracking pixels and broken icons
        if (img.naturalWidth >= 80 && img.naturalHeight >= 80) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    };

    img.onerror = () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        resolve(false);
      }
    };

    img.referrerPolicy = 'no-referrer';
    img.src = url;
  });
};

/**
 * Scrapes real image URLs directly from a webpage's HTML (JSON-LD, OpenGraph, DOM images).
 */
export const scrapeImagesFromWebPage = async (pageUrl: string): Promise<string[]> => {
  if (!pageUrl || !pageUrl.startsWith('http')) return [];
  const foundImages: string[] = [];

  const proxies = [
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
  ];

  for (const proxyFn of proxies) {
    try {
      const proxyUrl = proxyFn(pageUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(proxyUrl, { 
        signal: controller.signal,
        headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml' }
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const html = await res.text();
      if (!html || html.length < 200) continue;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 1. JSON-LD structured data extraction
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach(script => {
        try {
          const json = JSON.parse(script.textContent || '{}');
          const checkObject = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            if (obj.image) {
              if (Array.isArray(obj.image)) {
                obj.image.forEach((img: any) => {
                  if (typeof img === 'string') foundImages.push(img);
                  else if (img?.url) foundImages.push(img.url);
                  else if (img?.contentUrl) foundImages.push(img.contentUrl);
                });
              } else if (typeof obj.image === 'string') {
                foundImages.push(obj.image);
              } else if (obj.image.url) {
                foundImages.push(obj.image.url);
              }
            }
            if (Array.isArray(obj['@graph'])) {
              obj['@graph'].forEach(checkObject);
            }
          };
          checkObject(json);
        } catch (e) {}
      });

      // 2. OpenGraph & Meta Tags
      const metaTags = doc.querySelectorAll('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"], meta[name="twitter:image:src"], link[rel="image_src"]');
      metaTags.forEach(tag => {
        const content = tag.getAttribute('content') || tag.getAttribute('href');
        if (content) foundImages.push(content);
      });

      // 3. High-res product gallery image attributes
      const imgElements = doc.querySelectorAll('img[src], img[data-zoom-image], img[data-large], img[data-highres], img[data-src], img[data-old-hires], img[srcset]');
      imgElements.forEach(img => {
        const candidate = img.getAttribute('data-zoom-image') || 
                          img.getAttribute('data-large') || 
                          img.getAttribute('data-highres') || 
                          img.getAttribute('data-old-hires') ||
                          img.getAttribute('data-src') || 
                          img.getAttribute('src');
        if (candidate && !candidate.startsWith('data:')) {
          foundImages.push(candidate);
        }

        const srcset = img.getAttribute('srcset');
        if (srcset) {
          const parts = srcset.split(',').map(s => s.trim().split(' ')[0]).filter(Boolean);
          if (parts.length > 0) {
            foundImages.push(parts[parts.length - 1]); // Highest res in srcset
          }
        }
      });

      if (foundImages.length > 0) {
        break; // Successfully extracted images from page
      }
    } catch (e) {
      // Continue to next proxy
    }
  }

  // Resolve relative URLs against pageUrl base
  const resolved = foundImages.map(imgUrl => {
    try {
      if (imgUrl.startsWith('//')) return 'https:' + imgUrl;
      if (imgUrl.startsWith('/')) {
        const parsedBase = new URL(pageUrl);
        return `${parsedBase.origin}${imgUrl}`;
      }
      return imgUrl;
    } catch (e) {
      return imgUrl;
    }
  });

  return resolved;
};

/**
 * Dedicated Multi-Angle Product Image Scraper
 * Leverages Google Search Grounding, manufacturer page parsing, and live browser validation.
 */
export const scrapeProductImages = async (
    brand: string, 
    sku: string, 
    apiKey: string, 
    existingUrls: string[] = [],
    discoveredPageUrls: string[] = []
): Promise<string[]> => {
    const cleanBrand = (brand || '').trim();
    const cleanSku = (sku || '').trim();
    try {
        const ai = new GoogleGenAI({ apiKey: getEffectiveApiKey(apiKey) });
        const candidateUrls: string[] = [...existingUrls];
        const targetPages: string[] = [...discoveredPageUrls];
        
        const prompt = `Act as an industrial visual asset recovery engine for authorized tool retailer "Wise Line Tools" in Canada.
Task: Find REAL, working product page URLs and high-resolution photo URLs for tool:
Brand: "${cleanBrand}"
SKU / Model Number: "${cleanSku}"

Priority Search Steps:
1. Search specifically for "${cleanBrand} ${cleanSku}" on:
   - Official brand site (milwaukeetool.com, dewalt.com, makitatools.com, stealthvacs.com, boschtools.com, kleintools.com, olight.com, olightstore.ca, olightstore.com)
   - Major industrial & retail partners (homedepot.ca, homedepot.com, walmart.ca, walmart.com, lowes.com, acmetools.com, amazon.ca, amazon.com, grainger.ca, cpooutlets.com)
2. Return exact product page URLs where this item is sold or listed.
3. Return direct image URLs (jpg/png/webp) hosted on retailer/manufacturer CDNs (Scene7, Shopify CDN, Walmart Media, Amazon media, Home Depot THD static, Olight CDN).

JSON OUTPUT FORMAT ONLY:
{
  "product_pages": [
    "https://example.com/product-page-1",
    "https://example.com/product-page-2"
  ],
  "direct_images": [
    "https://example-cdn.com/product-image-hero.jpg",
    "https://example-cdn.com/product-image-angle.jpg"
  ]
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.7-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        // 1. Extract Web URIs discovered by Google Search Grounding chunks
        const groundingChunks = (response.candidates?.[0] as any)?.groundingMetadata?.groundingChunks || [];
        groundingChunks.forEach((chunk: any) => {
            const uri = chunk?.web?.uri;
            if (uri && uri.startsWith('http')) {
                targetPages.push(uri);
            }
        });

        let text = response.text || '';
        if (!text && response.candidates?.[0]?.content?.parts) {
            text = response.candidates[0].content.parts.map((p: any) => p.text || '').join('');
        }
        let parsed: any = {};
        try {
            let jsonStr = text;
            const match = text.match(/\`\`\`json\s*(\{[\s\S]*?\})\s*\`\`\`/);
            if (match) jsonStr = match[1];
            else {
                const first = text.indexOf('{');
                const last = text.lastIndexOf('}');
                if (first !== -1 && last !== -1) jsonStr = text.substring(first, last + 1);
            }
            parsed = JSON.parse(jsonStr);
        } catch (e) {}

        if (Array.isArray(parsed.product_pages)) {
            targetPages.push(...parsed.product_pages);
        }
        if (Array.isArray(parsed.direct_images)) {
            candidateUrls.push(...parsed.direct_images);
        }

        // 2. Parallel scrape of discovered HTML product pages for real JSON-LD & OG images
        const uniquePages = Array.from(new Set(targetPages.filter(p => p && p.startsWith('http')))).slice(0, 6);
        if (uniquePages.length > 0) {
            const pageScrapes = await Promise.allSettled(
                uniquePages.map(page => scrapeImagesFromWebPage(page))
            );
            pageScrapes.forEach(res => {
                if (res.status === 'fulfilled' && Array.isArray(res.value)) {
                    candidateUrls.push(...res.value);
                }
            });
        }

        // 3. Clean, normalize, and deduplicate all candidate image URLs
        const cleanedCandidates = rankImagesForHero(candidateUrls, cleanBrand, cleanSku);

        if (cleanedCandidates.length === 0) {
            return rankImagesForHero(existingUrls, cleanBrand, cleanSku);
        }

        // 4. Live in-browser validation: verify which image URLs actually load without 404s
        const validationResults = await Promise.all(
            cleanedCandidates.map(async (url) => {
                const isValid = await validateImageUrl(url, 3000);
                return { url, isValid };
            })
        );

        const verifiedWorking = rankImagesForHero(
            validationResults.filter(r => r.isValid).map(r => r.url),
            cleanBrand,
            cleanSku
        );

        if (verifiedWorking.length > 0) {
            return verifiedWorking;
        }

        // If all online candidates were blocked or 404'd, automatically generate a studio catalog photo
        try {
            const studioPhoto = await generateStudioProductPhoto(cleanBrand, cleanSku, cleanSku, 'hero', apiKey);
            if (studioPhoto) {
                return rankImagesForHero([studioPhoto, ...cleanedCandidates.slice(0, 4)], cleanBrand, cleanSku);
            }
        } catch (genErr) {
            console.warn("Studio photo generation fallback notice:", genErr);
        }

        // Return cleaned candidates if validation timed out
        return cleanedCandidates.slice(0, 8);
    } catch (e) {
        console.error("Image scraping error:", e);
        try {
            const studioPhoto = await generateStudioProductPhoto(cleanBrand, cleanSku, cleanSku, 'hero', apiKey);
            if (studioPhoto) return [studioPhoto];
        } catch {}
        return rankImagesForHero(existingUrls, cleanBrand, cleanSku);
    }
};

/**
 * Generates an ultra-crisp, commercial 3D studio catalog photograph of the tool
 * isolated on seamless pure white background (#FFFFFF) using Google's Imagen / Gemini models.
 */
export const generateStudioProductPhoto = async (
  brand: string,
  title: string,
  sku: string,
  angleType: 'hero' | 'angle' | 'packaging' = 'hero',
  apiKey: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getEffectiveApiKey(apiKey) });
  const cleanBrand = (brand || 'Professional Industrial').trim();
  const cleanSku = (sku || '').trim();
  const cleanTitle = (title || 'Industrial Tool Accessory').trim();

  let perspectiveDirective = 'centered front 3/4 hero perspective with soft natural contact shadows beneath it, perfectly isolated on seamless studio pure white background (#FFFFFF)';
  if (angleType === 'angle') {
    perspectiveDirective = 'profile side angle showcasing mechanical construction, ergonomic grip, and material finish, isolated on seamless pure white background (#FFFFFF)';
  } else if (angleType === 'packaging') {
    perspectiveDirective = 'complete retail unit with accessories neatly arranged next to the primary tool, isolated on seamless pure white background (#FFFFFF)';
  }

  const prompt = `Commercial e-commerce studio product photograph of ${cleanBrand} ${cleanTitle} (Model / SKU: ${cleanSku}).
Render style: High-end industrial hardware catalog photography.
Framing: ${perspectiveDirective}.
Lighting: Professional multi-point studio softbox lighting, crisp specular highlights on metal and poly-carbonate surfaces, zero background noise, 8k resolution, razor-sharp focus on branding and model numbers, photorealistic.`;

  // Try gemini-3.1-flash-lite-image first
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: '1:1' } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
  } catch (err1) {
    console.warn("gemini-3.1-flash-lite-image attempt error, trying gemini-3.1-flash-image:", err1);
    try {
      const response2 = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: '1:1', imageSize: '1K' } }
      });
      for (const part of response2.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    } catch (err2) {
      console.error("Studio photo fallback error:", err2);
      throw err2;
    }
  }
  throw new Error("Unable to generate studio photo.");
};

export const generatePromoImage = async (product: ProductRow, apiKey: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getEffectiveApiKey(apiKey) });
    
    const brand = product['Vendor'] || 'Unknown Brand';
    const sku = product['Variant SKU'] || 'Unknown SKU';
    const title = product['Title'] || 'Professional Tool';
    const price = product['Variant Price'] ? `$${product['Variant Price']}` : '';
    
    const prompt = `Generate a high-definition, premium promotional image for professional contractors.
    
    Product: ${brand} ${sku} - ${title}
    
    Technical Requirements:
    - Model Accuracy: Do not hallucinate tool designs. Render the tool with 100% mechanical accuracy based on the SKU ${sku}.
    - Branding: Replicate all logos (${brand}) and manufacturer text exactly.
    - Pricing Integration: ${price ? `Render the price "${price}" in a clean, bold, "Canadian Red" or "Construction Yellow" badge that looks integrated into the scene.` : 'No price badge needed.'}
    - Lighting & Environment: Use "Commercial Studio Lighting"—high contrast, sharp highlights on metal surfaces. Place products in professional environments like a clean oak workbench or a high-end job site.`;

    try {
      const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: {
              parts: [{ text: prompt }]
          },
          config: {
              imageConfig: {
                  aspectRatio: "16:9"
              }
          }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
              return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          }
      }
    } catch (err1) {
      console.warn("Promo image gen attempt 1 error, trying gemini-3.1-flash-image:", err1);
      const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image',
          contents: {
              parts: [{ text: prompt }]
          },
          config: {
              imageConfig: {
                  aspectRatio: "16:9",
                  imageSize: "1K"
              }
          }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
              return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          }
      }
    }
    
    throw new Error("Failed to generate promotional image.");
};

export const createProductFromSku = async (brand: string, sku: string, apiKey: string, existingContext: ProductRow = {}): Promise<ProductRow[]> => {
    const MAX_RETRIES = 3;
    let attempt = 0;
    
    // Prepare context string for AI
    const hasContext = Object.keys(existingContext).length > 0;
    const contextStr = hasContext 
        ? `EXISTING DATA (Prioritize this if valid, but fill gaps): ${JSON.stringify({
            title: existingContext['Title'],
            description_text: existingContext['Body (HTML)']?.replace(/<[^>]*>?/gm, ''), // Pass raw text to check for keywords
            price: existingContext['Variant Price'],
            weight: existingContext['Variant Grams'],
            barcode: existingContext['Variant Barcode'],
            image: existingContext['Image Src']
        })}` 
        : 'NO EXISTING DATA.';

    while (attempt < MAX_RETRIES) {
        attempt++;
        try {
            const ai = new GoogleGenAI({ apiKey: getEffectiveApiKey(apiKey) });
            
            const prompt = `Act as an elite world-class industrial product data architect and lead SEO strategist for authorized tool distributor "Wise Line Tools". 
            Your mission: Synthesize the absolute highest quality product data and visual catalog assets for: "${brand} ${sku}".
            
            ${contextStr}

            1. SEARCH & RECOVERY STRATEGY (CRITICAL):
            - Perform Google Searches for "${brand} ${sku}", "${brand} ${sku} specifications", "${brand} ${sku} price canada", and "${brand} ${sku} product images gallery".
            - Target official manufacturer portals (milwaukeetool.com/ca, dewalt.com/ca, makitatools.com/ca, boschtools.com, kleintools.com, olight.com, olightstore.ca).
            - Target authorized dealers (Home Depot Canada, Acme Tools, Grainger Canada, Tool Nut).

            2. MULTI-IMAGE ASSET EXTRACTION (HIGHEST PRIORITY):
            - Extract 4 to 8 REAL, HIGH-RESOLUTION product images (.jpg, .png, .webp).
            - Cover multiple distinct angles and views:
              * Angle 1: Primary Hero Shot (Tool isolated on white background)
              * Angle 2: 3D Perspective / Side Angle
              * Angle 3: Kit / Case / What's Included (Batteries, charger, case, accessories)
              * Angle 4: Close-up mechanism / chuck / motor / controls
              * Angle 5: Application / Jobsite in action
            - NEVER invent fake domains. Return direct CDN image URLs from manufacturer media CDNs (Scene7, Milwaukee Media, SBD Media, Shopify CDN, Home Depot CDN, Olight CDN).
            - Exclude logos, banners, icons, and low-res thumbnails.

            3. CANADIAN MARKET INTELLIGENCE:
            - If price is missing in EXISTING DATA, research exact current pricing (MSRP) from Canadian competitors.
            - Resulting price MUST be in CAD (numbers only).

            4. DEEP INDUSTRIAL METADATA:
            - Official GTIN/UPC Barcode (12-13 digits). If no verified barcode exists, leave empty "".
            - Product Weight in Grams.
            - Country of Origin (2-letter ISO).
            - HS Tariff Code.
            - Google Product Category.
            - Product Type.

            5. CONTENT ARCHITECTURE (HTML):
            - Professional HTML Description.
            - Start with a strong introductory paragraph (NO "Product Overview" heading).
            - Include: Performance Features (<ul>), Technical Specifications (<table>), What's Included.
            - Include: Accurate Manufacturer Warranty Block (<div class="product-warranty-block">) at the bottom.

            6. SEO & TAXONOMY:
            - Title: "[Brand] [SKU] [Product Name]".
            - Tags: Comma separated.

            7. MANUFACTURER WARRANTY RESEARCH (CRITICAL):
            - Research and verify the precise official manufacturer warranty terms for this brand and product type in Canada.
            - Return specific period and coverage details.

            OUTPUT JSON ONLY:
            {
              "title": "...",
              "price_cad": "...",
              "body_html": "...",
              "warranty_period": "...",
              "warranty_details": "...",
              "barcode": "...",
              "weight_grams": "...",
              "tags": "...",
              "product_type": "...",
              "country_of_origin": "...",
              "hs_code": "...",
              "google_category": "...",
              "seo_title": "...",
              "seo_description": "...",
              "included_in_box": ["..."],
              "product_page_url": "The actual URL of the manufacturer or main retailer product page found.",
              "competitor_urls": ["URL1", "URL2"],
              "images": [
                "https://.../main_hero.jpg",
                "https://.../angle_view.jpg",
                "https://.../kit_case.jpg",
                "https://.../close_up.jpg",
                "https://.../in_action.jpg"
              ]
            }`;

            let response: any;
            try {
                response = await ai.models.generateContent({
                    model: 'gemini-3.7-flash', 
                    contents: prompt,
                    config: { 
                        tools: [{ googleSearch: {} }]
                    }
                });
            } catch (searchErr) {
                console.warn("Search-grounded generation attempt failed, falling back to direct prompt:", searchErr);
                response = await ai.models.generateContent({
                    model: 'gemini-3.7-flash',
                    contents: prompt
                });
            }

            let text = response?.text || '';
            if (!text && response?.candidates?.[0]?.content?.parts) {
                text = response.candidates[0].content.parts.map((p: any) => p.text || '').join('');
            }
            if (!text) {
                // Try fallback without tools if text is still empty
                try {
                    const fallbackResponse = await ai.models.generateContent({
                        model: 'gemini-3.7-flash',
                        contents: prompt
                    });
                    text = fallbackResponse?.text || fallbackResponse?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
                } catch (fbErr) {
                    console.error("Direct prompt fallback failed:", fbErr);
                }
            }
            if (!text) throw new Error("Received empty response from Gemini API");

            let jsonStr = text;
            const match = text.match(/\`\`\`json\s*(\{[\s\S]*?\})\s*\`\`\`/);
            if (match) {
                jsonStr = match[1];
            } else {
                const firstBrace = text.indexOf('{');
                const lastBrace = text.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    jsonStr = text.substring(firstBrace, lastBrace + 1);
                }
            }
                
            let data: any = {};
            try {
                data = JSON.parse(jsonStr);
            } catch (parseError) {
                 const match = text.match(/\{[\s\S]*\}/);
                 if (match) {
                     try { data = JSON.parse(match[0]); } catch(e) {}
                 }
            }
            
            // Extract discovered web URIs from Google Search Grounding
            const discoveredPages: string[] = [];
            const groundingChunks = (response.candidates?.[0] as any)?.groundingMetadata?.groundingChunks || [];
            groundingChunks.forEach((chunk: any) => {
                const uri = chunk?.web?.uri;
                if (uri && uri.startsWith('http')) {
                    discoveredPages.push(uri);
                }
            });

            if (data.product_page_url) discoveredPages.push(data.product_page_url);
            if (Array.isArray(data.competitor_urls)) discoveredPages.push(...data.competitor_urls);

            // Extract and clean raw image URLs
            let rawImages: string[] = (Array.isArray(data.images) ? data.images.map((img: any) => String(img || '')) : []);
            if (existingContext['Image Src'] && !existingContext['Image Src'].includes('placehold.co')) {
                const existingImages = String(existingContext['Image Src']).split(/[|,\n;]/).map(s => s.trim()).filter(s => s);
                rawImages = [...existingImages, ...rawImages];
            }
            
            let uniqueImages = deduplicateImages(rawImages);

            // Run deep visual asset scraper and live HTML parser on discovered retailer/manufacturer pages
            try {
                const scraped = await scrapeProductImages(brand, sku, apiKey, uniqueImages, discoveredPages);
                if (scraped && scraped.length > 0) {
                    uniqueImages = deduplicateImages([...uniqueImages, ...scraped]);
                }
            } catch (scrapeErr) {
                console.warn("Secondary image scrape fallback notice:", scrapeErr);
            }

            // Verify candidates in browser to weed out 404s
            if (uniqueImages.length > 0) {
                const validationCheck = await Promise.all(
                    uniqueImages.slice(0, 8).map(async (u: string) => {
                        const ok = await validateImageUrl(u, 2500);
                        return { url: u, ok };
                    })
                );
                const workingOnes = rankImagesForHero(
                    validationCheck.filter(v => v.ok).map(v => v.url),
                    brand,
                    sku
                );
                if (workingOnes.length > 0) {
                    uniqueImages = workingOnes;
                }
            }

            // If still no valid images found, generate a studio photo so the product is never blank
            if (uniqueImages.length === 0) {
                try {
                    const studioPhoto = await generateStudioProductPhoto(brand, data.title || sku, sku, 'hero', apiKey);
                    if (studioPhoto) {
                        uniqueImages = [studioPhoto];
                    }
                } catch (genErr) {
                    console.warn("Product studio photo initialization notice:", genErr);
                }
            } else {
                uniqueImages = rankImagesForHero(uniqueImages, brand, sku);
            }

            let handle = existingContext['Handle'];
            if (!handle) {
                let baseName = (data.title || existingContext['Title'] || `${brand}-${sku}`).toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
                    
                const skuSlug = sku.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                if (!baseName.includes(skuSlug)) {
                    handle = `${baseName}-${skuSlug}`;
                } else {
                    handle = baseName;
                }
            }
            
            const safeRawAssets = rawImages.filter((u: any) => typeof u === 'string' && u && !u.startsWith('data:image') && u.length < 3000);
            
            // Use existing price if valid and AI didn't find one or if existing is preferred
            const aiPrice = data.price_cad ? String(data.price_cad).replace(/[^0-9.]/g, '') : '';
            const existingPrice = existingContext['Variant Price'] ? String(existingContext['Variant Price']).replace(/[^0-9.]/g, '') : '';
            const finalPrice = existingPrice && parseFloat(existingPrice) > 0 ? existingPrice : aiPrice;

            const aiGrams = data.weight_grams ? String(data.weight_grams).replace(/[^0-9]/g, '') : '';
            const existingGrams = existingContext['Variant Grams'] ? String(existingContext['Variant Grams']).replace(/[^0-9]/g, '') : '';
            const finalGrams = existingGrams && parseInt(existingGrams) > 0 ? existingGrams : aiGrams;

            const finalBarcode = (existingContext['Variant Barcode'] && String(existingContext['Variant Barcode']).length > 6) 
                ? existingContext['Variant Barcode'] 
                : (data.barcode ? `'${data.barcode}` : '');

            // Clean Body HTML to ensure "Product Overview" header is removed if AI generates it
            let cleanBody = data.body_html || existingContext['Body (HTML)'] || '';
            cleanBody = cleanBody
                .replace(/<h3>Product Overview<\/h3>/gi, '')
                .replace(/<h3>Overview<\/h3>/gi, '')
                .replace(/<h2>Product Overview<\/h2>/gi, '')
                .replace(/<h2>Overview<\/h2>/gi, '')
                .replace(/<strong>Product Overview<\/strong>/gi, '')
                .replace(/<b>Product Overview<\/b>/gi, '');

            // Researched accurate warranty block synthesis
            const warrantyInfo = generateWarrantyBlock(
                brand, 
                sku, 
                data.warranty_period, 
                data.warranty_details, 
                data.title || existingContext['Title'], 
                data.product_type || existingContext['Type']
            );

            // Ensure the Warranty block is placed at the bottom of the description cleanly
            if (cleanBody && !cleanBody.includes('product-warranty-block') && !cleanBody.includes('Manufacturer Warranty & Guarantee') && !cleanBody.includes('Manufacturer Warranty & Support')) {
                cleanBody = `${cleanBody.trim()}\n\n${warrantyInfo.html}`;
            } else if (!cleanBody) {
                cleanBody = warrantyInfo.html;
            }

            // Construct standard Shopify row with resolved product category and CONTINUE inventory policy
            const titleVal = data.title || existingContext['Title'] || `${brand} ${sku}`;
            const tagsVal = data.tags || existingContext['Tags'] || '';
            const resolvedCategory = resolveShopifyToolCategory(
                titleVal,
                brand,
                sku,
                tagsVal,
                data.google_category || existingContext['Product Category'] || ''
            );

            const mainRow: ProductRow = {
                ...existingContext,
                'Handle': handle,
                'Title': titleVal,
                'Body (HTML)': cleanBody,
                'Vendor': normalizeVendor(brand),
                'Product Category': resolvedCategory,
                'Type': data.product_type || existingContext['Type'] || resolvedCategory,
                'Tags': tagsVal,
                'Published': 'TRUE',
                'Option1 Name': existingContext['Option1 Name'] || 'Title',
                'Option1 Value': existingContext['Option1 Value'] || 'Default Title',
                'Option2 Name': existingContext['Option2 Name'] || '',
                'Option2 Value': existingContext['Option2 Value'] || '',
                'Option3 Name': existingContext['Option3 Name'] || '',
                'Option3 Value': existingContext['Option3 Value'] || '',
                'Variant SKU': sku,
                'Variant Grams': finalGrams,
                'Variant Inventory Tracker': existingContext['Variant Inventory Tracker'] || 'shopify',
                'Variant Inventory Qty': existingContext['Variant Inventory Qty'] || '',
                'Variant Inventory Policy': 'continue', 
                'Variant Fulfillment Service': existingContext['Variant Fulfillment Service'] || 'manual',
                'Variant Price': finalPrice,
                'Variant Compare At Price': existingContext['Variant Compare At Price'] || '',
                'Variant Requires Shipping': existingContext['Variant Requires Shipping'] || 'true',
                'Variant Taxable': existingContext['Variant Taxable'] || 'true',
                'Unit Price Total Measure': existingContext['Unit Price Total Measure'] || '',
                'Unit Price Total Measure Unit': existingContext['Unit Price Total Measure Unit'] || '',
                'Unit Price Base Measure': existingContext['Unit Price Base Measure'] || '',
                'Unit Price Base Measure Unit': existingContext['Unit Price Base Measure Unit'] || '',
                'Variant Barcode': finalBarcode,
                'Variant HS Code': data.hs_code || existingContext['Variant HS Code'] || '',
                'Variant Country of Origin': data.country_of_origin || existingContext['Variant Country of Origin'] || '',
                'Variant Image': existingContext['Variant Image'] || '',
                'Image Src': uniqueImages.join(' | '), // Store all images here so downloadCSV can split them
                'Image Position': 1,
                'Image Alt Text': '',
                'Gift Card': existingContext['Gift Card'] || 'false',
                'SEO Title': data.seo_title || existingContext['SEO Title'] || '',
                'SEO Description': data.seo_description || existingContext['SEO Description'] || '',
                'Google Shopping / Google Product Category': data.google_category || '',
                'Google Shopping / Condition': 'new',
                'Variant Weight Unit': existingContext['Variant Weight Unit'] || 'g',
                'Variant Tax Code': existingContext['Variant Tax Code'] || '',
                'Cost per item': existingContext['Cost per item'] || '',
                'Status': existingContext['Status'] || 'draft',
                'Warranty': warrantyInfo.period,
                '_Warranty_Details': warrantyInfo.details,
                '_Raw_Assets': safeRawAssets.join(' | '),
                '_Product_Page': data.product_page_url || '',
                '_Competitor_Links': (data.competitor_urls || []).join(' | '),
                'Included In Box': (data.included_in_box || []).join(', ')
            };

            return [mainRow];

        } catch (e: any) {
            console.error(`AI Research Attempt ${attempt} failed:`, e);
            if (attempt === MAX_RETRIES) {
                // Return original context if AI fails completely
                return [{
                    ...existingContext,
                    'Handle': `${brand}-${sku}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
                    'Title': existingContext['Title'] || `${brand} ${sku}`,
                    'Vendor': normalizeVendor(brand),
                    'Variant SKU': sku,
                    'Status': 'draft' // Default to draft
                }];
            }
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
    return [];
};

// --- DATA TEMPLATES ---

const SHOPIFY_HEADERS = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value', 'Option1 Linked To',
  'Option2 Name', 'Option2 Value', 'Option2 Linked To',
  'Option3 Name', 'Option3 Value', 'Option3 Linked To',
  'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Policy',
  'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price',
  'Variant Requires Shipping', 'Variant Taxable', 'Unit Price Total Measure',
  'Unit Price Total Measure Unit', 'Unit Price Base Measure', 'Unit Price Base Measure Unit',
  'Variant Barcode', 'Image Src', 'Image Position', 'Image Alt Text', 'Gift Card',
  'SEO Title', 'SEO Description', 'Google Shopping / Google Product Category',
  'Google Shopping / Gender', 'Google Shopping / Age Group', 'Google Shopping / MPN',
  'Google Shopping / Condition', 'Google Shopping / Custom Product',
  'Google Shopping / Custom Label 0', 'Google Shopping / Custom Label 1',
  'Google Shopping / Custom Label 2', 'Google Shopping / Custom Label 3',
  'Google Shopping / Custom Label 4',
  'Checkout Block Trigger (product.metafields.checkoutblocks.trigger)',
  'Attach and Save Products (product.metafields.custom.attach_and_save_products)',
  'CATEGORYS (product.metafields.custom.categorys)',
  'Category Hierarchy (product.metafields.custom.category_hierarchy)',
  'Coupon Code Message (product.metafields.custom.coupon)',
  'discount (product.metafields.custom.discount)',
  'Frequently Bought Together (product.metafields.custom.frequently_bought_together)',
  'Main Category (product.metafields.custom.main_category)',
  'Preorder ETA date (product.metafields.custom.preorder_eta_date)',
  'Product Video (product.metafields.custom.product_video)',
  'Promo end (product.metafields.custom.promo_end)',
  'Promo start (product.metafields.custom.promo_start)',
  'Short Shipping Info (product.metafields.custom.short_shipping_info)',
  'Sku (product.metafields.custom.sku)',
  'Subcategory (product.metafields.custom.subcategory)',
  'SUB CATEGORY 1 (product.metafields.custom.sub_category)',
  'SUB CATEGORY 2 (product.metafields.custom.sub_category_2)',
  'SUB CATEGORY 3 (product.metafields.custom.sub_category_3)',
  'SUB CATEGORY 4 (product.metafields.custom.sub_category_4)',
  'Sub-subcategory (product.metafields.custom.sub_subcategory)',
  'youtube_url (product.metafields.custom.youtube_url)',
  'EComposer product countdown end at (product.metafields.ecomposer.countdown)',
  'EComposer product countdown start at (product.metafields.ecomposer.countdown_from)',
  'Flipbook Link 01 (product.metafields.flipbook.url_1)',
  'Bought together products (product.metafields.globo--filter--product_recommendation.bought_together_products)',
  'Complementary products (product.metafields.globo--filter--product_recommendation.complementary_products)',
  'Related products (product.metafields.globo--filter--product_recommendation.related_products)',
  'Google: Custom Product (product.metafields.mm-google-shopping.custom_product)',
  'Product reccomend (product.metafields.product.rrecommend)',
  'Product rating count (product.metafields.reviews.rating_count)',
  'Abrasive material (product.metafields.shopify.abrasive-material)',
  'Accessory size (product.metafields.shopify.accessory-size)',
  'Age group (product.metafields.shopify.age-group)',
  'Allergen information (product.metafields.shopify.allergen-information)',
  'Animal type (product.metafields.shopify.animal-type)',
  'Audio connectivity (product.metafields.shopify.audio-connectivity)',
  'Audio purpose (product.metafields.shopify.audio-purpose)',
  'Backing material (product.metafields.shopify.backing-material)',
  'Bag/Case material (product.metafields.shopify.bag-case-material)',
  'Battery features (product.metafields.shopify.battery-features)',
  'Battery size (product.metafields.shopify.battery-size)',
  'Battery technology (product.metafields.shopify.battery-technology)',
  'Battery type (product.metafields.shopify.battery-type)',
  'Bevel type (product.metafields.shopify.bevel-type)',
  'Blade design (product.metafields.shopify.blade-design)',
  'Blade material (product.metafields.shopify.blade-material)',
  'Case type (product.metafields.shopify.case-type)',
  'Chemical product form (product.metafields.shopify.chemical-product-form)',
  'Chemical safety features (product.metafields.shopify.chemical-safety-features)',
  'Chuck type (product.metafields.shopify.chuck-type)',
  'Cleaning surfaces (product.metafields.shopify.cleaning-surfaces)',
  'Clothing accessory material (product.metafields.shopify.clothing-accessory-material)',
  'Color (product.metafields.shopify.color-pattern)',
  'Compatible vacuum type (product.metafields.shopify.compatible-vacuum-type)',
  'Connection type (product.metafields.shopify.connection-type)',
  'Connectivity technology (product.metafields.shopify.connectivity-technology)',
  'Cutting method (product.metafields.shopify.cutting-method)',
  'Device interface (product.metafields.shopify.device-interface)',
  'Device technology (product.metafields.shopify.device-technology)',
  'Dietary preferences (product.metafields.shopify.dietary-preferences)',
  'Dirt separating method (product.metafields.shopify.dirt-separating-method)',
  'Display technology (product.metafields.shopify.display-technology)',
  'Drill features (product.metafields.shopify.drill-features)',
  'Drinkware material (product.metafields.shopify.drinkware-material)',
  'Drive size (product.metafields.shopify.drive-size)',
  'Dry/Wet cleaning (product.metafields.shopify.dry-wet-cleaning)',
  'Dust container type (product.metafields.shopify.dust-container-type)',
  'Dust mask type (product.metafields.shopify.dust-mask-type)',
  'Earphone features (product.metafields.shopify.earphone-features)',
  'Fabric (product.metafields.shopify.fabric)',
  'Fastener finish (product.metafields.shopify.fastener-finish)',
  'Features (product.metafields.shopify.features)',
  'Filtration class (product.metafields.shopify.filtration-class)',
  'Food product form (product.metafields.shopify.food-product-form)',
  'Frequency/Radio bands supported (product.metafields.shopify.frequency-radio-bands-supported)',
  'Furniture/Fixture material (product.metafields.shopify.furniture-fixture-material)',
  'Gear material (product.metafields.shopify.gear-material)',
  'Grit type (product.metafields.shopify.grit-type)',
  'Hammer head material (product.metafields.shopify.hammer-head-material)',
  'Hand side (product.metafields.shopify.hand-side)',
  'Handle color (product.metafields.shopify.handle-color)',
  'Handle design (product.metafields.shopify.handle-design)',
  'Handle material (product.metafields.shopify.handle-material)',
  'Handwear features (product.metafields.shopify.handwear-features)',
  'Handwear material (product.metafields.shopify.handwear-material)',
  'Handwear type (product.metafields.shopify.handwear-type)',
  'Hardware material (product.metafields.shopify.hardware-material)',
  'Hardware mounting type (product.metafields.shopify.hardware-mounting-type)',
  'Headphone style (product.metafields.shopify.headphone-style)',
  'Hunting/Survival knife design (product.metafields.shopify.hunting-survival-knife-design)',
  'Ignition system (product.metafields.shopify.ignition-system)',
  'Knife type (product.metafields.shopify.knife-type)',
  'Light source (product.metafields.shopify.light-source)',
  'Lock type (product.metafields.shopify.lock-type)',
  'Material (product.metafields.shopify.material)',
  'Meat type (product.metafields.shopify.meat-type)',
  'Microphone type (product.metafields.shopify.microphone-type)',
  'Mobile phone case features (product.metafields.shopify.mobile-phone-case-features)',
  'Mounting type (product.metafields.shopify.mounting-type)',
  'Outdoor power accessories included (product.metafields.shopify.outdoor-power-accessories-included)',
  'Outerwear clothing features (product.metafields.shopify.outerwear-clothing-features)',
  'Package type (product.metafields.shopify.package-type)',
  'Pairing method (product.metafields.shopify.pairing-method)',
  'Pen type (product.metafields.shopify.pen-type)',
  'Phase type (product.metafields.shopify.phase-type)',
  'Power source (product.metafields.shopify.power-source)',
  'Propulsion type (product.metafields.shopify.propulsion-type)',
  'Protective gear features (product.metafields.shopify.protective-gear-features)',
  'Protective mask features (product.metafields.shopify.protective-mask-features)',
  'Rotating direction (product.metafields.shopify.rotating-direction)',
  'Sanding application (product.metafields.shopify.sanding-application)',
  'Size (product.metafields.shopify.size)',
  'Sleeve length type (product.metafields.shopify.sleeve-length-type)',
  'Socket driver tip (product.metafields.shopify.socket-driver-tip)',
  'Speaker design (product.metafields.shopify.speaker-design)',
  'Speaker features (product.metafields.shopify.speaker-features)',
  'Speaker technology (product.metafields.shopify.speaker-technology)',
  'Suitable for material type (product.metafields.shopify.suitable-for-material-type)',
  'Suitable space (product.metafields.shopify.suitable-space)',
  'System of measurement (product.metafields.shopify.system-of-measurement)',
  'Target gender (product.metafields.shopify.target-gender)',
  'Tool key tip (product.metafields.shopify.tool-key-tip)',
  'Tool operation (product.metafields.shopify.tool-operation)',
  'Top length type (product.metafields.shopify.top-length-type)',
  'Tuner type (product.metafields.shopify.tuner-type)',
  'Units of measurement (product.metafields.shopify.units-of-measurement)',
  'Usage type (product.metafields.shopify.usage-type)',
  'Vacuum air filtering technology (product.metafields.shopify.vacuum-air-filtering-technology)',
  'Vehicle application area (product.metafields.shopify.vehicle-application-area)',
  'Vehicle cleaning item features (product.metafields.shopify.vehicle-cleaning-item-features)',
  'Vehicle fluid features (product.metafields.shopify.vehicle-fluid-features)',
  'Vehicle oil features (product.metafields.shopify.vehicle-oil-features)',
  'Vehicle type (product.metafields.shopify.vehicle-type)',
  'Viscosity (product.metafields.shopify.viscosity)',
  'Complementary products (product.metafields.shopify--discovery--product_recommendation.complementary_products)',
  'Related products (product.metafields.shopify--discovery--product_recommendation.related_products)',
  'Related products settings (product.metafields.shopify--discovery--product_recommendation.related_products_display)',
  'Search product boosts (product.metafields.shopify--discovery--product_search_boost.queries)',
  'Variant Image',
  'Variant Weight Unit',
  'Variant Tax Code',
  'Cost per item',
  'Included / Canada',
  'Price / Canada',
  'Compare At Price / Canada',
  'Included / Australia',
  'Price / Australia',
  'Compare At Price / Australia',
  'Included / Bulgaria',
  'Price / Bulgaria',
  'Compare At Price / Bulgaria',
  'Included / Finland',
  'Price / Finland',
  'Compare At Price / Finland',
  'Included / France',
  'Price / France',
  'Compare At Price / France',
  'Included / Germany',
  'Price / Germany',
  'Compare At Price / Germany',
  'Included / Ireland',
  'Price / Ireland',
  'Compare At Price / Ireland',
  'Included / Italy',
  'Price / Italy',
  'Compare At Price / Italy',
  'Included / Japan',
  'Price / Japan',
  'Compare At Price / Japan',
  'Included / Mexico',
  'Price / Mexico',
  'Compare At Price / Mexico',
  'Included / Netherlands',
  'Price / Netherlands',
  'Compare At Price / Netherlands',
  'Included / New Zealand',
  'Price / New Zealand',
  'Compare At Price / New Zealand',
  'Included / Norway',
  'Price / Norway',
  'Compare At Price / Norway',
  'Included / Singapore',
  'Price / Singapore',
  'Compare At Price / Singapore',
  'Included / Slovakia',
  'Price / Slovakia',
  'Compare At Price / Slovakia',
  'Included / South Korea',
  'Price / South Korea',
  'Compare At Price / South Korea',
  'Included / United Kingdom',
  'Price / United Kingdom',
  'Compare At Price / United Kingdom',
  'Included / United States',
  'Price / United States',
  'Compare At Price / United States',
  'Status'
];

export const downloadCSV = (data: ProductRow[]) => {
  const groupedData: Record<string, ProductRow[]> = {};
  data.forEach(row => {
      const handle = row['Handle'];
      if (!handle) return;
      if (!groupedData[handle]) groupedData[handle] = [];
      groupedData[handle].push(row);
  });

  const transformedRows: any[][] = [];
  
  Object.values(groupedData).forEach(group => {
      // Collect all images from the group
      const images: string[] = [];
      group.forEach(r => {
          if (r['Image Src'] && !r['Image Src'].includes('placehold.co')) {
              const splitImages = String(r['Image Src']).split(/[|,\n;]/).map(s => s.trim()).filter(s => s);
              images.push(...splitImages);
          }
      });
      
      // Rigorously deduplicate images across all variants and multi-angle records
      const uniqueImages = deduplicateImages(images);

      // Output all rows in the group (e.g. variants)
      group.forEach((row, index) => {
          const rowData = SHOPIFY_HEADERS.map(header => {
              if (header === 'Image Src') {
                  // Only put the FIRST image on the FIRST row of the group
                  if (index === 0) return uniqueImages[0] || '';
                  return ''; // Clear Image Src for subsequent variant rows to prevent duplicates in gallery
              }
              if (header === 'Image Position') {
                  if (index === 0) return uniqueImages.length > 0 ? 1 : '';
                  return '';
              }
              
              if (header === 'Option1 Name' && (!row['Option1 Name'] || row['Option1 Name'] === 'Title')) {
                  return group.length > 1 ? 'Variant SKU' : 'Title';
              }
              if (header === 'Option1 Value' && (!row['Option1 Value'] || row['Option1 Value'] === 'Default Title')) {
                  return group.length > 1 ? (row['Variant SKU'] || `Variant ${index + 1}`) : 'Default Title';
              }
              
              // Specific Overrides for Main Row (index 0)
              if (index === 0) {
                  if (header === 'Published') return 'TRUE';
                  if (header === 'Status' && !row['Status']) return 'draft';
              } else {
                  // For subsequent variants, clear out product-level fields to avoid Shopify errors
                  if (['Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published', 'Status', 'SEO Title', 'SEO Description', 'Gift Card'].includes(header)) {
                      return '';
                  }
              }
              
              return row[header] !== undefined ? row[header] : '';
          });
          transformedRows.push(rowData);
      });

      // Rows N..M: Additional Images
      for (let i = 1; i < uniqueImages.length; i++) {
          const imgRowData = SHOPIFY_HEADERS.map(header => {
              if (header === 'Handle') return group[0]['Handle'];
              if (header === 'Image Src') return uniqueImages[i];
              if (header === 'Image Position') return i + 1;
              return ''; // All other fields empty for image rows
          });
          transformedRows.push(imgRowData);
      }
  });

  const ws = XLSX.utils.aoa_to_sheet([SHOPIFY_HEADERS, ...transformedRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  XLSX.writeFile(wb, 'Shopify_Import_Ready.csv', { bookType: 'csv' });
};

export const parseExcel = async (file: File): Promise<{ headers: string[], data: ProductRow[], logs: string[] }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                
                const logs: string[] = [];
                let primaryData: any[] = [];
                const exactSkuKeywords = ['sku', 'handle', 'variant sku', 'material', 'item', 'model', 'part number', 'item number', 'material number', 'model number', 'product id', 'item id', 'upc', 'product number', 'product no', 'product #', 'item no', 'part no', 'material #', 'model #', 'item #', 'part #', 'mfg part #'];
                const includesSkuKeywords = ['sku', 'handle', 'part number', 'item number', 'item no', 'part no', 'item id', 'product id', 'material #', 'model #', 'item #', 'part #', 'product number', 'product no', 'product #', 'mfg part #'];
                
                const normalizeSku = (sku: string) => String(sku).trim().toLowerCase();
                
                let primarySkuColName = 'SKU';
                let isFirstProcessedSheet = true;
                const allRows: any[] = [];

                for (let i = 0; i < workbook.SheetNames.length; i++) {
                    const sheetName = workbook.SheetNames[i];
                    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" }) as any[][];
                    if (rawData.length === 0) continue;
                    
                    // Find the actual header row (scan first 10 rows)
                    let headerRowIndex = 0;
                    let maxScore = -1;
                    
                    const commonHeaders = ['title', 'name', 'description', 'price', 'image', 'qty', 'quantity', 'vendor', 'brand', 'category', 'type', 'status', 'published', 'tags'];
                    
                    for (let r = 0; r < Math.min(10, rawData.length); r++) {
                        const row = rawData[r];
                        if (!row || !Array.isArray(row)) continue;
                        
                        let score = 0;
                        const rowStrings = row.map(c => String(c).toLowerCase().trim());
                        
                        // High score if it contains an EXACT known SKU column
                        if (rowStrings.some(c => exactSkuKeywords.includes(c))) {
                            score += 100;
                        } else if (rowStrings.some(c => includesSkuKeywords.some(k => c === k || c.startsWith(k + ' ')))) {
                            score += 50;
                        }
                        
                        // Reward rows that have other common header names
                        const commonMatchCount = rowStrings.filter(c => commonHeaders.includes(c) || c.includes('price') || c.includes('image')).length;
                        score += (commonMatchCount * 10);
                        
                        // Reward rows with more filled columns (likely the header row)
                        score += rowStrings.filter(c => c.length > 0).length;
                        
                        if (score > maxScore) {
                            maxScore = score;
                            headerRowIndex = r;
                        }
                    }
                    
                    const sheetHeaders = rawData[headerRowIndex].map(c => String(c).trim());
                    
                    // Convert the rest of the data to objects
                    const sheetData: any[] = [];
                    for (let r = headerRowIndex + 1; r < rawData.length; r++) {
                        const rowObj: any = {};
                        let hasData = false;
                        for (let c = 0; c < sheetHeaders.length; c++) {
                            const header = sheetHeaders[c];
                            if (header) {
                                rowObj[header] = rawData[r][c];
                                if (rawData[r][c] !== "" && rawData[r][c] !== undefined) hasData = true;
                            }
                        }
                        if (hasData) sheetData.push(rowObj);
                    }
                    
                    if (sheetData.length === 0) {
                        logs.push(`Skipped sheet '${sheetName}' (no data found after header row).`);
                        continue;
                    }
                    
                    let sheetSkuCol = sheetHeaders.find(h => exactSkuKeywords.includes(h.toLowerCase()));
                    if (!sheetSkuCol) {
                        sheetSkuCol = sheetHeaders.find(h => includesSkuKeywords.some(k => h.toLowerCase().includes(k)));
                    }
                    if (!sheetSkuCol && sheetHeaders.length > 0) {
                        const firstCol = sheetHeaders[0].toLowerCase();
                        if (firstCol.includes('code') || firstCol.includes('id') || firstCol.includes('number') || firstCol.includes('no.') || firstCol === 'material' || firstCol === 'model' || firstCol === 'item') {
                            sheetSkuCol = sheetHeaders[0];
                        }
                    }
                    
                    if (!sheetSkuCol) {
                        logs.push(`Skipped sheet '${sheetName}' (no SKU/Handle column found). Headers: ${sheetHeaders.slice(0, 5).join(', ')}...`);
                        continue;
                    }
                    
                    const isBaseSheet = isFirstProcessedSheet;
                    if (isFirstProcessedSheet) {
                        primarySkuColName = sheetSkuCol;
                        isFirstProcessedSheet = false;
                    }
                    
                    const fieldNameCol = sheetHeaders.find(h => h.toLowerCase() === 'field name' || h.toLowerCase() === 'attribute name');
                    const fieldValueCol = sheetHeaders.find(h => h.toLowerCase() === 'field value' || h.toLowerCase() === 'attribute value');
                    const isEAV = !!(fieldNameCol && fieldValueCol);
                    
                    logs.push(`Processing sheet '${sheetName}' using key '${sheetSkuCol}'${isEAV ? ' (EAV format)' : ''}.`);
                    
                    if (isEAV) {
                        // For EAV, we group by SKU and aggregate attributes
                        const eavGrouped = new Map<string, any>();
                        sheetData.forEach(row => {
                            const skuVal = normalizeSku(row[sheetSkuCol]);
                            if (!skuVal) return;
                            
                            if (!eavGrouped.has(skuVal)) {
                                eavGrouped.set(skuVal, { [sheetSkuCol]: row[sheetSkuCol] });
                            }
                            const mergedRow = eavGrouped.get(skuVal);
                            
                            const fName = String(row[fieldNameCol]).trim();
                            const fVal = String(row[fieldValueCol]).trim();
                            if (fName && fVal) {
                                if (mergedRow[fName]) {
                                    if (!mergedRow[fName].includes(fVal)) {
                                        mergedRow[fName] += ` | ${fVal}`;
                                    }
                                } else {
                                    mergedRow[fName] = fVal;
                                }
                            }
                        });
                        
                        // If it's the first sheet, these are our primary rows
                        if (isBaseSheet) {
                            allRows.push(...Array.from(eavGrouped.values()));
                        } else {
                            // Merge into existing rows
                            allRows.forEach(row => {
                                const skuVal = normalizeSku(row[primarySkuColName]);
                                if (!skuVal) return;
                                
                                const matchingKeys = Array.from(eavGrouped.keys()).filter(k => 
                                    k === skuVal || k.startsWith(skuVal + '_') || k.startsWith(skuVal + '-') || k.startsWith(skuVal + ' ') || skuVal.startsWith(k + '_') || skuVal.startsWith(k + '-')
                                );
                                
                                matchingKeys.forEach(matchKey => {
                                    const eavData = eavGrouped.get(matchKey);
                                    if (eavData) {
                                        Object.keys(eavData).forEach(k => {
                                            if (k !== sheetSkuCol && eavData[k]) {
                                                if (row[k]) {
                                                    if (!String(row[k]).includes(String(eavData[k]))) {
                                                        row[k] += ` | ${eavData[k]}`;
                                                    }
                                                } else {
                                                    row[k] = eavData[k];
                                                }
                                            }
                                        });
                                    }
                                });
                            });
                        }
                    } else {
                        // Non-EAV sheet
                        if (isBaseSheet) {
                            // First sheet
                            const sheetGrouped = new Map<string, any[]>();
                            sheetData.forEach(row => {
                                const skuVal = normalizeSku(row[sheetSkuCol]);
                                if (!skuVal) return;
                                if (!sheetGrouped.has(skuVal)) sheetGrouped.set(skuVal, []);
                                sheetGrouped.get(skuVal)!.push(row);
                            });
                            
                            sheetGrouped.forEach((rows, sku) => {
                                if (rows.length === 1) {
                                    allRows.push(rows[0]);
                                } else {
                                    // We have multiple rows for the same SKU.
                                    // Check if subsequent rows are just "image-only" rows (like in Shopify CSVs)
                                    // An image-only row typically lacks a Title, Price, or Option values.
                                    const parentRow = { ...rows[0] };
                                    const variants = [parentRow];
                                    
                                    for (let j = 1; j < rows.length; j++) {
                                        const currentRow = rows[j];
                                        
                                        // Heuristic: an image-only row only has values in SKU/Handle and Image columns
                                        let isImageOnly = true;
                                        Object.keys(currentRow).forEach(k => {
                                            if (!currentRow[k]) return; // ignore empty columns
                                            const kLower = k.toLowerCase();
                                            if (kLower === sheetSkuCol.toLowerCase()) return; // ignore SKU column
                                            if (kLower.includes('image') || kLower.includes('pic') || kLower.includes('src') || kLower.includes('photo') || kLower.includes('url')) return; // ignore image columns
                                            // If it has any other column with a value, it's not an image-only row
                                            isImageOnly = false;
                                        });
                                        
                                        if (isImageOnly) {
                                            // It's likely an image-only row. Merge its images into the parent row.
                                            Object.keys(currentRow).forEach(k => {
                                                const kLower = k.toLowerCase();
                                                if (kLower.includes('image') || kLower.includes('pic') || kLower.includes('src') || kLower.includes('photo') || kLower.includes('url') || kLower.includes('asset') || kLower.includes('media') || kLower.includes('link')) {
                                                    if (currentRow[k]) {
                                                        if (parentRow[k]) {
                                                            if (!String(parentRow[k]).includes(String(currentRow[k]))) {
                                                                parentRow[k] += ` | ${currentRow[k]}`;
                                                            }
                                                        } else {
                                                            parentRow[k] = currentRow[k];
                                                        }
                                                    }
                                                }
                                            });
                                        } else {
                                            // It's a variant row
                                            variants.push(currentRow);
                                        }
                                    }
                                    allRows.push(...variants);
                                }
                            });
                        } else {
                            // Subsequent sheets, left join by SKU
                            const sheetGrouped = new Map<string, any>();
                            sheetData.forEach(row => {
                                const skuVal = normalizeSku(row[sheetSkuCol]);
                                if (!skuVal) return;
                                // If multiple rows have same SKU in subsequent sheet, merge them
                                if (!sheetGrouped.has(skuVal)) {
                                    sheetGrouped.set(skuVal, { ...row });
                                } else {
                                    const existing = sheetGrouped.get(skuVal);
                                    Object.keys(row).forEach(k => {
                                        if (k !== sheetSkuCol && row[k]) {
                                            if (existing[k]) {
                                                if (!String(existing[k]).includes(String(row[k]))) {
                                                    existing[k] += ` | ${row[k]}`;
                                                }
                                            } else {
                                                existing[k] = row[k];
                                            }
                                        }
                                    });
                                }
                            });
                            
                            allRows.forEach(row => {
                                const skuVal = normalizeSku(row[primarySkuColName]);
                                if (!skuVal) return;
                                
                                const matchingKeys = Array.from(sheetGrouped.keys()).filter(k => 
                                    k === skuVal || 
                                    k.startsWith(skuVal + '_') || 
                                    k.startsWith(skuVal + '-') || 
                                    skuVal.startsWith(k + '_') || 
                                    skuVal.startsWith(k + '-')
                                );
                                
                                matchingKeys.forEach(matchKey => {
                                    const extraData = sheetGrouped.get(matchKey);
                                    if (extraData) {
                                        // Merge the extra data object into the current row
                                        Object.keys(extraData).forEach(k => {
                                            if (k !== sheetSkuCol && extraData[k]) {
                                                if (row[k]) {
                                                    if (!String(row[k]).includes(String(extraData[k]))) {
                                                        row[k] += ` | ${extraData[k]}`;
                                                    }
                                                } else {
                                                    row[k] = extraData[k];
                                                }
                                            }
                                        });
                                    }
                                });
                            });
                        }
                    }
                }
                
                primaryData = allRows;
                logs.push(`Successfully processed ${primaryData.length} rows.`);
                
                // Final pass: aggregate any image columns in primaryData into 'All Images'
                primaryData.forEach(row => {
                    const rowImages: string[] = [];
                    if (row['All Images']) {
                        rowImages.push(...String(row['All Images']).split(/[|,\n;]/).map(s => s.trim()).filter(Boolean));
                    }
                    
                    Object.keys(row).forEach(key => {
                        if (key === 'All Images') return;
                        const keyLower = key.toLowerCase();
                        if (keyLower.includes('image') || keyLower.includes('pic') || keyLower.includes('asset') || keyLower.includes('media') || keyLower.includes('url') || keyLower.includes('photo') || keyLower.includes('file') || keyLower.includes('document') || keyLower.includes('attachment') || keyLower.includes('link') || keyLower.includes('widen') || keyLower.includes('thumbnail') || keyLower.includes('hires') || keyLower.includes('highres') || keyLower.includes('path') || keyLower.includes('original') || keyLower.includes('source')) {
                            const valStr = String(row[key]).trim();
                            if (valStr) {
                                const parts = valStr.split(/[|,\n;]/);
                                parts.forEach(part => {
                                    const p = part.trim();
                                    if (p && !rowImages.includes(p)) {
                                        rowImages.push(p);
                                    }
                                });
                            }
                        }
                    });
                    
                    if (rowImages.length > 0) {
                        row['All Images'] = rowImages.join(' | ');
                    }
                });
                
                const finalHeaders = Array.from(new Set(primaryData.flatMap(row => Object.keys(row))));
                resolve({ headers: finalHeaders, data: primaryData, logs });
            } catch (err: any) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsBinaryString(file);
    });
};

export const generateShopifyData = (sourceData: ProductRow[], mapping: Mapping): ProductRow[] => {
    return sourceData.map(row => {
        const newRow: ProductRow = {};
        Object.entries(mapping).forEach(([shopifyField, sourceHeader]) => {
            if (sourceHeader) newRow[shopifyField] = row[sourceHeader];
        });
        
        // Auto-generate Handle if missing
        if (!newRow['Handle'] && newRow['Title']) {
            newRow['Handle'] = String(newRow['Title'])
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }

        // Auto-resolve Product Category
        const resolvedCategory = resolveShopifyToolCategory(
            String(newRow['Title'] || ''),
            String(newRow['Vendor'] || ''),
            String(newRow['Variant SKU'] || ''),
            String(newRow['Tags'] || ''),
            String(newRow['Product Category'] || newRow['Google Shopping / Google Product Category'] || '')
        );

        newRow['Product Category'] = resolvedCategory;
        if (!newRow['Type']) {
            newRow['Type'] = resolvedCategory;
        }

        // Set Shopify defaults for mapped data
        newRow['Option1 Name'] = newRow['Option1 Name'] || 'Title';
        newRow['Option1 Value'] = newRow['Option1 Value'] || 'Default Title';
        newRow['Published'] = 'TRUE'; // Default to true per user request
        newRow['Status'] = newRow['Status'] || 'draft'; // Default to draft for safety
        newRow['Variant Inventory Tracker'] = newRow['Variant Inventory Tracker'] || 'shopify';
        newRow['Variant Inventory Policy'] = 'continue'; // "Sell when out of stock" explicitly enabled
        newRow['Variant Fulfillment Service'] = newRow['Variant Fulfillment Service'] || 'manual';
        newRow['Variant Requires Shipping'] = newRow['Variant Requires Shipping'] || 'true';
        newRow['Variant Taxable'] = newRow['Variant Taxable'] || 'true';
        newRow['Gift Card'] = newRow['Gift Card'] || 'false';

        return newRow;
    });
};

export const VALID_ROOTS = [
  'Animals & Pet Supplies',
  'Apparel & Accessories',
  'Arts & Entertainment',
  'Baby & Toddler',
  'Business & Industrial',
  'Cameras & Optics',
  'Electronics',
  'Food, Beverages & Tobacco',
  'Furniture',
  'Hardware',
  'Health & Beauty',
  'Home & Garden',
  'Luggage & Bags',
  'Mature',
  'Media',
  'Office Supplies',
  'Religious & Ceremonial',
  'Software',
  'Sporting Goods',
  'Toys & Games',
  'Vehicles & Parts'
];

export const SHOPIFY_TOOL_CATEGORIES = [
  'Hardware > Tools > Power Tools > Drills & Drivers',
  'Hardware > Tools > Power Tools > Impact Drivers & Wrenches',
  'Hardware > Tools > Power Tools > Power Saws > Circular Saws',
  'Hardware > Tools > Power Tools > Power Saws > Reciprocating Saws (Sawzall)',
  'Hardware > Tools > Power Tools > Power Saws > Miter & Table Saws',
  'Hardware > Tools > Power Tools > Power Saws > Band Saws',
  'Hardware > Tools > Power Tools > Power Saws > Jigsaws',
  'Hardware > Tools > Power Tools > Grinders & Polishers',
  'Hardware > Tools > Power Tools > Sanders',
  'Hardware > Tools > Power Tools > Rotary Hammers & Demolition Hammers',
  'Hardware > Tools > Power Tools > Power Tool Combo Kits',
  'Hardware > Tools > Power Tools > Dust Extractors & Wet/Dry Vacuums',
  'Hardware > Tools > Power Tools > Heat Guns & Blowers',
  'Hardware > Tools > Power Tools > Routers & Jointers',
  'Hardware > Tools > Power Tools > Nailers & Staplers',
  'Hardware > Tools > Power Tools > Power Cutters & Shears',
  'Hardware > Tools > Power Tools > Concrete & Masonry Tools',
  'Hardware > Tools > Power Tools > Pipe & Plumbing Tools',
  'Hardware > Tools > Hand Tools > Pliers & Cutters',
  'Hardware > Tools > Hand Tools > Wrenches & Ratchets',
  'Hardware > Tools > Hand Tools > Screwdrivers & Nut Drivers',
  'Hardware > Tools > Hand Tools > Measuring & Layout Tools > Tape Measures',
  'Hardware > Tools > Hand Tools > Measuring & Layout Tools > Levels',
  'Hardware > Tools > Hand Tools > Measuring & Layout Tools > Laser Levels',
  'Hardware > Tools > Hand Tools > Hammers & Mallets',
  'Hardware > Tools > Hand Tools > Utility Knives, Blades & Multi-Tools',
  'Hardware > Tools > Hand Tools > Handsaws & Cutting Tools',
  'Hardware > Tools > Hand Tools > Clamps & Vises',
  'Hardware > Tools > Hand Tools > Chisels & Punches',
  'Hardware > Tools > Hand Tools > Wire Strippers & Crimpers',
  'Hardware > Tools > Tool Storage & Organization > Modular Storage Systems (PACKOUT)',
  'Hardware > Tools > Tool Storage & Organization > Tool Boxes & Chests',
  'Hardware > Tools > Tool Storage & Organization > Tool Bags & Backpacks',
  'Hardware > Tools > Tool Storage & Organization > Tool Belts & Pouches',
  'Hardware > Tools > Tool Accessories > Power Tool Batteries & Chargers',
  'Hardware > Tools > Tool Accessories > Saw Blades',
  'Hardware > Tools > Tool Accessories > Drill Bits & Driver Bits',
  'Hardware > Tools > Tool Accessories > Abrasives & Sanding Discs',
  'Hardware > Tools > Tool Accessories > Socket Sets & Adapters',
  'Hardware > Tools > Tool Accessories > Hole Saws & Core Bits',
  'Hardware > Tools > Tool Accessories > Router Bits',
  'Hardware > Tools > Work Lights & Jobsite Lighting',
  'Hardware > Tools > Outdoor Power Equipment > String Trimmers & Edgers',
  'Hardware > Tools > Outdoor Power Equipment > Leaf Blowers',
  'Hardware > Tools > Outdoor Power Equipment > Chainsaws & Pole Saws',
  'Hardware > Tools > Outdoor Power Equipment > Lawn Mowers',
  'Hardware > Tools > Outdoor Power Equipment > Hedge Trimmers',
  'Hardware > Tools > Safety & Workwear > Heated Gear & Jackets',
  'Hardware > Tools > Safety & Workwear > Work Gloves',
  'Hardware > Tools > Safety & Workwear > Eye Protection & Safety Glasses',
  'Hardware > Tools > Safety & Workwear > Hard Hats & Helmets',
  'Hardware > Tools > Safety & Workwear > Hearing Protection',
  'Hardware > Tools > Safety & Workwear > High Visibility Vests & Clothing',
  'Hardware > Tools > Safety & Workwear > Dust Masks & Respirators',
  'Hardware > Tools > Plumbing Tools & Equipment > Pipe Threaders & Press Tools',
  'Hardware > Tools > Plumbing Tools & Equipment > Drain Cleaning & Inspection',
  'Hardware > Tools > Electrical Tools & Testers > Multimeters & Clamp Meters',
  'Hardware > Tools > Electrical Tools & Testers > Cable Cutters & Knockout Tools',
  'Hardware > Tools > Automotive Tools & Equipment',
  'Hardware > Tools > Inspection & Thermal Imaging Cameras'
];

/**
 * Intelligently resolves the most accurate Shopify Product Category for any tool or hardware item.
 */
export const resolveShopifyToolCategory = (
  title: string = '',
  vendor: string = '',
  sku: string = '',
  tags: string = '',
  currentCategory: string = ''
): string => {
  if (currentCategory && currentCategory.includes(' > ') && currentCategory.length > 20) {
    return currentCategory;
  }

  const text = `${title} ${vendor} ${sku} ${tags} ${currentCategory}`.toLowerCase();

  // Storage / PACKOUT
  if (text.includes('packout') || (text.includes('modular') && text.includes('storage'))) {
    return 'Hardware > Tools > Tool Storage & Organization > Modular Storage Systems (PACKOUT)';
  }
  if (text.includes('toolbox') || text.includes('tool box') || text.includes('chest') || text.includes('cabinet') || text.includes('drawers')) {
    return 'Hardware > Tools > Tool Storage & Organization > Tool Boxes & Chests';
  }
  if (text.includes('tool bag') || text.includes('backpack') || text.includes('tote')) {
    return 'Hardware > Tools > Tool Storage & Organization > Tool Bags & Backpacks';
  }
  if (text.includes('tool belt') || text.includes('pouch') || text.includes('holster')) {
    return 'Hardware > Tools > Tool Storage & Organization > Tool Belts & Pouches';
  }

  // Batteries & Chargers
  if (text.includes('battery') || text.includes('charger') || text.includes('redlithium') || text.includes('flexvolt') || text.includes('powerstack')) {
    return 'Hardware > Tools > Tool Accessories > Power Tool Batteries & Chargers';
  }

  // Lighting
  if (text.includes('light') || text.includes('tower light') || text.includes('flood light') || text.includes('headlamp') || text.includes('lantern') || text.includes('spotlight') || text.includes('rover') || text.includes('flashlight')) {
    return 'Hardware > Tools > Work Lights & Jobsite Lighting';
  }

  // Outdoor Power Equipment
  if (text.includes('chainsaw') || text.includes('pole saw')) {
    return 'Hardware > Tools > Outdoor Power Equipment > Chainsaws & Pole Saws';
  }
  if (text.includes('blower') && (text.includes('leaf') || text.includes('yard') || text.includes('outdoor'))) {
    return 'Hardware > Tools > Outdoor Power Equipment > Leaf Blowers';
  }
  if (text.includes('string trimmer') || text.includes('edger') || text.includes('weed eater') || text.includes('line trimmer')) {
    return 'Hardware > Tools > Outdoor Power Equipment > String Trimmers & Edgers';
  }
  if (text.includes('lawn mower') || text.includes('mower')) {
    return 'Hardware > Tools > Outdoor Power Equipment > Lawn Mowers';
  }
  if (text.includes('hedge trimmer')) {
    return 'Hardware > Tools > Outdoor Power Equipment > Hedge Trimmers';
  }

  // Heated Gear & Apparel
  if (text.includes('heated') || text.includes('jacket') || text.includes('hoodie') || text.includes('vest') && text.includes('heated')) {
    return 'Hardware > Tools > Safety & Workwear > Heated Gear & Jackets';
  }
  if (text.includes('glove') || text.includes('cut resistant')) {
    return 'Hardware > Tools > Safety & Workwear > Work Gloves';
  }
  if (text.includes('glasses') || text.includes('goggles') || text.includes('eye protection')) {
    return 'Hardware > Tools > Safety & Workwear > Eye Protection & Safety Glasses';
  }
  if (text.includes('hard hat') || text.includes('helmet')) {
    return 'Hardware > Tools > Safety & Workwear > Hard Hats & Helmets';
  }
  if (text.includes('ear plug') || text.includes('earmuff') || text.includes('hearing')) {
    return 'Hardware > Tools > Safety & Workwear > Hearing Protection';
  }
  if (text.includes('respirator') || text.includes('mask') || text.includes('n95')) {
    return 'Hardware > Tools > Safety & Workwear > Dust Masks & Respirators';
  }

  // Power Saws
  if (text.includes('circular saw') || text.includes('track saw') || text.includes('worm drive')) {
    return 'Hardware > Tools > Power Tools > Power Saws > Circular Saws';
  }
  if (text.includes('sawzall') || text.includes('hackzall') || text.includes('reciprocating saw') || text.includes('recip saw')) {
    return 'Hardware > Tools > Power Tools > Power Saws > Reciprocating Saws (Sawzall)';
  }
  if (text.includes('miter saw') || text.includes('table saw')) {
    return 'Hardware > Tools > Power Tools > Power Saws > Miter & Table Saws';
  }
  if (text.includes('band saw') || text.includes('bandsaw')) {
    return 'Hardware > Tools > Power Tools > Power Saws > Band Saws';
  }
  if (text.includes('jigsaw') || text.includes('jig saw')) {
    return 'Hardware > Tools > Power Tools > Power Saws > Jigsaws';
  }

  // Drills & Fastening
  if (text.includes('impact wrench') || text.includes('impact driver') || text.includes('high torque impact')) {
    return 'Hardware > Tools > Power Tools > Impact Drivers & Wrenches';
  }
  if (text.includes('hammer drill') || text.includes('drill/driver') || text.includes('drill driver') || text.includes('drill') || text.includes('driver')) {
    return 'Hardware > Tools > Power Tools > Drills & Drivers';
  }
  if (text.includes('combo kit') || text.includes('tool kit') || text.includes('2-tool') || text.includes('4-tool') || text.includes('6-tool')) {
    return 'Hardware > Tools > Power Tools > Power Tool Combo Kits';
  }
  if (text.includes('rotary hammer') || text.includes('demolition hammer') || text.includes('sds-plus') || text.includes('sds-max') || text.includes('sds max')) {
    return 'Hardware > Tools > Power Tools > Rotary Hammers & Demolition Hammers';
  }
  if (text.includes('grinder') || text.includes('polisher') || text.includes('angle grinder') || text.includes('die grinder')) {
    return 'Hardware > Tools > Power Tools > Grinders & Polishers';
  }
  if (text.includes('sander') || text.includes('orbital sander') || text.includes('belt sander')) {
    return 'Hardware > Tools > Power Tools > Sanders';
  }
  if (text.includes('vacuum') || text.includes('dust extractor') || text.includes('vac') || text.includes('dust collection')) {
    return 'Hardware > Tools > Power Tools > Dust Extractors & Wet/Dry Vacuums';
  }
  if (text.includes('nailer') || text.includes('stapler') || text.includes('brad nailer') || text.includes('framing nailer') || text.includes('pin nailer')) {
    return 'Hardware > Tools > Power Tools > Nailers & Staplers';
  }
  if (text.includes('router') || text.includes('planer') || text.includes('jointer')) {
    return 'Hardware > Tools > Power Tools > Routers & Jointers';
  }
  if (text.includes('heat gun') || text.includes('compact blower')) {
    return 'Hardware > Tools > Power Tools > Heat Guns & Blowers';
  }

  // Hand Tools
  if (text.includes('plier') || text.includes('cutters') || text.includes('lineman') || text.includes('diagonal cutter') || text.includes('channel lock') || text.includes('crimper')) {
    return 'Hardware > Tools > Hand Tools > Pliers & Cutters';
  }
  if (text.includes('wrench') || text.includes('ratchet') || text.includes('socket set') || text.includes('torque wrench')) {
    return 'Hardware > Tools > Hand Tools > Wrenches & Ratchets';
  }
  if (text.includes('screwdriver') || text.includes('nut driver') || text.includes('hex key') || text.includes('torx')) {
    return 'Hardware > Tools > Hand Tools > Screwdrivers & Nut Drivers';
  }
  if (text.includes('tape measure') || text.includes('tape rule') || text.includes('measuring tape')) {
    return 'Hardware > Tools > Hand Tools > Measuring & Layout Tools > Tape Measures';
  }
  if (text.includes('laser level') || text.includes('cross line laser') || text.includes('rotary laser')) {
    return 'Hardware > Tools > Hand Tools > Measuring & Layout Tools > Laser Levels';
  }
  if (text.includes('level') || text.includes('torpedo level') || text.includes('box level') || text.includes('digital level')) {
    return 'Hardware > Tools > Hand Tools > Measuring & Layout Tools > Levels';
  }
  if (text.includes('hammer') || text.includes('mallet') || text.includes('sledge')) {
    return 'Hardware > Tools > Hand Tools > Hammers & Mallets';
  }
  if (text.includes('knife') || text.includes('utility knife') || text.includes('blade') || text.includes('fastback') || text.includes('multi-tool')) {
    return 'Hardware > Tools > Hand Tools > Utility Knives, Blades & Multi-Tools';
  }
  if (text.includes('clamp') || text.includes('vise') || text.includes('c-clamp')) {
    return 'Hardware > Tools > Hand Tools > Clamps & Vises';
  }

  // Plumbing / Electrical Specialized
  if (text.includes('press tool') || text.includes('pipe threader') || text.includes('pex') || text.includes('drain cleaner') || text.includes('pipe cutter') || text.includes('transfer pump')) {
    return 'Hardware > Tools > Plumbing Tools & Equipment > Pipe Threaders & Press Tools';
  }
  if (text.includes('multimeter') || text.includes('clamp meter') || text.includes('voltage detector') || text.includes('cable cutter') || text.includes('fish tape')) {
    return 'Hardware > Tools > Electrical Tools & Testers > Multimeters & Clamp Meters';
  }
  if (text.includes('thermal camera') || text.includes('inspection camera') || text.includes('borescope')) {
    return 'Hardware > Tools > Inspection & Thermal Imaging Cameras';
  }

  // Tool Accessories
  if (text.includes('blade') || text.includes('carbide blade') || text.includes('diamond blade')) {
    return 'Hardware > Tools > Tool Accessories > Saw Blades';
  }
  if (text.includes('drill bit') || text.includes('driver bit') || text.includes('step bit') || text.includes('auger') || text.includes('sds bit')) {
    return 'Hardware > Tools > Tool Accessories > Drill Bits & Driver Bits';
  }
  if (text.includes('abrasive') || text.includes('sanding disc') || text.includes('grinding wheel') || text.includes('flap disc') || text.includes('cutoff wheel')) {
    return 'Hardware > Tools > Tool Accessories > Abrasives & Sanding Discs';
  }
  if (text.includes('hole saw') || text.includes('core bit')) {
    return 'Hardware > Tools > Tool Accessories > Hole Saws & Core Bits';
  }

  // General fallback
  return 'Hardware > Tools > Power Tools > Drills & Drivers';
};

export const SUGGESTED_MAPPINGS: Record<string, string[]> = {
  // Title: Prioritize explicit "Product Name" or "Item Desc" over generic "Name"
  'Title': ['product name', 'item description', 'description 1', 'product title', 'item name', 'short description', 'material description', 'title', 'name', 'desc'],
  'Body (HTML)': ['marketing copy', 'long description', 'romance copy', 'extended description', 'web description', 'details', 'features', 'marketing'],
  // Vendor: Specific 'mfg name' vs just 'mfg'
  'Vendor': ['brand', 'manufacturer', 'vendor', 'make', 'mfg name', 'brand name'],
  // SKU: Put 'mfg part number' FIRST to ensure it catches before others
  'Variant SKU': ['mfg part number', 'mfg part #', 'mfg #', 'part number', 'sku', 'item #', 'model', 'material #', 'prod id', 'part #', 'item id'],
  'Variant Price': ['price', 'msrp', 'cost', 'retail', 'list price', 'unit price'],
  'Variant Inventory Qty': ['qty', 'quantity', 'stock', 'inventory', 'on hand', 'available'],
  'Image Src': ['all images', 'image', 'primary image', 'main image', 'image url', 'pic', 'photo', 'asset', 'url', 'digital asset', 'media', 'file'],
  'Variant Grams': ['weight', 'shipping weight', 'mass', 'gross weight'],
  'Variant Barcode': ['upc', 'ean', 'gtin', 'barcode'],
  'Tags': ['category', 'class', 'sub-class', 'group', 'keywords', 'tags']
};
