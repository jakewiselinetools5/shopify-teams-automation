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
      u.pathname = u.pathname.replace(/_[0-9]+x[0-9]+(?=\.[a-z0-9]+$)/i, '_1200x1200')
                             .replace(/_(?:small|thumb|compact|medium|large|grande)(?=\.[a-z0-9]+$)/i, '_1200x1200');
    } else if (u.hostname.includes('insitecloud.net') || u.pathname.includes('insitecloud.net')) {
      u.search = '';
      u.pathname = u.pathname.replace(/_(?:sm|md|thumb)(?=\.[a-z0-9]+$)/i, '_lg');
    } else if (u.pathname.includes('/stencil/')) {
      u.pathname = u.pathname.replace(/\/stencil\/\d+x\d+\//, '/stencil/1280x1280/').replace(/\/stencil\/\d+w\//, '/stencil/1280x1280/');
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
    pathname = pathname.replace(/_(?:sm|md|lg|thumb|medium|large|small|_1200x1200)(?=\.[a-z0-9]+$)/i, '');
    const filename = pathname.split('/').pop() || '';
    return `${u.hostname}/${filename}`;
  } catch {
    return url.toLowerCase();
  }
}


function getMatchingTaxonomyRules(brand, sku) {
  const b = String(brand || '').toUpperCase();
  const s = String(sku || '').toUpperCase();
  const rules = [];

  if (s.includes('ARKPRO') || (b.includes('OLIGHT') && s.includes('PUR'))) {
    rules.push('OLIGHT ARKPRO SERIES: ARKPRO-PUR = ArkPro 1500-Lumen Flat EDC Multi-Source Flashlight with UV & Green Laser - Nebula Violet Purple ($139.99 CAD MSRP). Dual magnetic MCC + USB-C fast charging.');
  } else if (b.includes('OLIGHT') && (s.includes('BATON') || s.includes('SEEKER') || s.includes('WARRIOR') || s.includes('ARKFELD'))) {
    rules.push('OLIGHT PREMIUM FLASHLIGHTS: Synthesize exact lumens, beam distance, battery, and color matching SKU: ' + s);
  }

  if (s.includes('461055') || s.includes('461010') || s.includes('461020') || s.includes('461030') || s.includes('462055') || s.includes('463055') || s.includes('464055')) {
    rules.push('BADGER TOOL BELTS / OCCIDENTAL: 461055 = Carpenter Set - Olive Drab ($562.90 - $599.00 CAD); 461010 = Gunmetal Grey; 461020 = Black; 461030 = Sawdust Sage. 1000D Cordura, Made in USA.');
  }

  if (s.includes('0931-20') || s.includes('0931')) {
    rules.push('MILWAUKEE 0931-20: 6.5 Peak HP Wet/Dry Vacuum Motor Head (Corded 120V AC, 12 Amp motor head for modular vacuum tanks 0912-20, 0922-20, 0932-20 - $189.00 - $219.00 CAD MSRP).');
  } else if (s.includes('0892-20') || s.includes('0892')) {
    rules.push('MILWAUKEE 0892-20: M18 Brushless Handheld Vacuum (Bare Tool). Cyclonic debris separator, HEPA filter (49-90-1948), 40 CFM, 63" water lift, LED nozzle light, 0.25-gal tank - $179.00 - $199.00 CAD.');
  }

  if (s.includes('TW001G') || s.includes('TW002G') || s.includes('TW004G') || s.includes('DTW')) {
    rules.push('MAKITA IMPACT WRENCHES: TW002G = 40V Max XGT 1/2" High Torque Brushless Impact Wrench (1,250 ft-lbs fastening / 1,620 ft-lbs nut-busting). Suffix Z = Tool Only.');
  }

  return rules.join('\n');
}

const TOOL_TAXONOMY_RULES = `
INDUSTRIAL TOOL SKU DECODING & FACT VERIFICATION RULES:
- OLIGHT / OLIGHT TECHNOLOGY:
  * ARKPRO-PUR = ArkPro 1500-Lumen Flat EDC Multi-Source Flashlight with UV & Green Laser - Nebula Violet Purple ($139.99 CAD MSRP).
    - Features: 1,500-lumen pure floodlight, 800-lumen spotlight (205m beam distance), 365nm UV light, Class 3R green laser beam, dual magnetic MCC + USB-C fast charging, aerospace aluminum unibody in Nebula Violet purple.
  * ARKPRO-ODG / ARKPRO-GRN = ArkPro 1500-Lumen Flat EDC Flashlight - Olive Green ($139.99 CAD).
  * ARKPRO-TAN = ArkPro 1500-Lumen Flat EDC Flashlight - Desert Tan ($139.99 CAD).
  * ARKPRO-BLK = ArkPro 1500-Lumen Flat EDC Flashlight - Matte Black ($139.99 CAD).
  * ARKFELD-PRO = Arkfeld Pro Flat EDC Flashlight with 1300 Lumens, 365nm UV & Green Laser ($119.99 - $129.99 CAD).
  * BATON-3 / BATON-4 = Baton Premium EDC Flashlight ($89.99 - $119.99 CAD).
  * SEEKER-4-PRO = Seeker 4 Pro 4600-Lumen High-Output Flashlight ($179.99 CAD).
  * WARRIOR-3S = Warrior 3S Tactical Flashlight ($149.99 CAD).
  * Suffix '-PUR' / 'PUR' = Nebula Violet / Purple
  * Suffix '-ODG' / '-GRN' = Olive Green / OD Green
  * Suffix '-TAN' = Desert Tan / Coyote
  * Suffix '-BLK' = Matte Black
  * Suffix '-BLU' = Midnight Blue
  * Suffix '-ORG' = Safety Orange
  * Olight Warranty: "Olight Lifetime Limited Manufacturer Warranty (North America)."

- BADGER TOOL BELTS / OCCIDENTAL LEATHER:
  * 461055 / OCC-461055 = Carpenter Tool Belt Set - Olive Drab with Black (Includes Carpenter Tool Bag, Side-by-Side Fastener Bag, 4" Contoured Padded Belt with Metal COBRA Buckle - 1000D USA Cordura Nylon, Made in USA - $562.90 - $599.00 CAD MSRP).
    - 461055SM = Small (28"-31" waist)
    - 461055MD = Medium (32"-35" waist)
    - 461055LG / 461055-LG = Large (36"-39" waist)
    - 461055XL / 461055-XL = X-Large (40"-43" waist)
    - 4610552X = 2X-Large (44"-47" waist)
  * 461010 / OCC-461010 = Carpenter Tool Belt Set - Gunmetal Grey ($562.90 - $599.00 CAD MSRP).
  * 461020 / OCC-461020 = Carpenter Tool Belt Set - Midnight Black ($562.90 - $599.00 CAD MSRP).
  * 461030 / OCC-461030 = Carpenter Tool Belt Set - Sawdust Sage / Coyote Tan ($562.90 - $599.00 CAD MSRP).
  * 462055 / OCC-462055 = Framer Tool Belt Set - Olive Drab with Black ($569.00 - $619.00 CAD).
  * 462010 / OCC-462010 = Framer Tool Belt Set - Gunmetal Grey ($569.00 - $619.00 CAD).
  * 462020 / OCC-462020 = Framer Tool Belt Set - Midnight Black ($569.00 - $619.00 CAD).
  * 462030 / OCC-462030 = Framer Tool Belt Set - Sawdust Sage ($569.00 - $619.00 CAD).
  * 463055 / OCC-463055 = Trimmer Tool Belt Set - Olive Drab ($529.00 - $569.00 CAD).
  * 463010 / OCC-463010 = Trimmer Tool Belt Set - Gunmetal Grey ($529.00 - $569.00 CAD).
  * 464055 / OCC-464055 = Electrician Tool Belt Set - Olive Drab ($549.00 - $599.00 CAD).
  * 464010 / OCC-464010 = Electrician Tool Belt Set - Gunmetal Grey ($549.00 - $599.00 CAD).
  * 454030 / OCC-454030 = Carpenter Tool Belt Set - Gunmetal Grey ($549.00 CAD).
  * Occidental / Badger Warranty: "Occidental Leather & Badger Tool Belts 2-Year Manufacturer Warranty against defects in materials and craftsmanship."

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

- MILWAUKEE MODULAR WET/DRY VACUUM SYSTEM & MOTOR HEADS:
  * 0931-20 = 6.5 Peak HP Wet/Dry Vacuum Motor Head (Corded 120V AC, 12 Amp motor head for Milwaukee modular vacuum tanks 0912-20, 0922-20, 0932-20 - $189.00 - $219.00 CAD MSRP).
  * 0911-20 = M18 FUEL™ Wet/Dry Vacuum Motor Head (Bare Tool - Single 18V Battery Platform) ($249.00 - $269.00 CAD).
  * 0921-20 = M18 FUEL™ Dual-Battery Wet/Dry Vacuum Motor Head (Bare Tool - Dual 18V Battery Platform) ($299.00 - $329.00 CAD).
  * 0910-20 = M18 FUEL™ 6 Gallon Wet/Dry Vacuum ($399.00 CAD).
  * 0920-20 = M18 FUEL™ 9 Gallon Wet/Dry Vacuum ($449.00 CAD).
  * 0930-20 = M18 FUEL™ Dual-Battery 12 Gallon Wet/Dry Vacuum ($499.00 CAD).
  * 0912-20 = 6 Gallon Wet/Dry Vacuum Tank ($119.00 CAD).
  * 0922-20 = 9 Gallon Wet/Dry Vacuum Tank ($139.00 CAD).
  * 0932-20 = 12 Gallon Wet/Dry Vacuum Tank ($159.00 CAD).
  * 0933-19 = Wet/Dry Vacuum Premium Cart ($179.00 CAD).
  * 0892-20 / 0892 = M18™ Brushless Handheld Vacuum (Bare Tool / Tool Only). High-efficiency brushless motor, integrated cyclonic debris separator, HEPA dry-cleanable filter, 40 CFM airflow, 63" water lift suction, shadowless LED ring nozzle light, removable 0.25-gallon tank with quick-release latch. Includes: (1) 0892-20 M18 Brushless Handheld Vacuum, (1) HEPA Filter (49-90-1948), (1) Extension Wand, (1) Crevice Tool, (1) Floor Tool, (1) Flexible Hose, (1) Brush Tool ($179.00 - $199.00 CAD MSRP).
  * 0880-20 = M18™ 2-Gallon Wet/Dry Vacuum ($179.00 - $199.00 CAD).
  * 0882-20 = M18™ Compact Vacuum ($169.00 - $189.00 CAD).
  * 0885-20 / 0885-21 = M18 FUEL™ 3-in-1 Backpack Vacuum.
  * 0940-20 = M12™ Compact Vacuum ($119.00 CAD).
  * 0970-20 = M18 FUEL™ PACKOUT™ 2.5 Gallon Wet/Dry Vacuum ($279.00 - $299.00 CAD).
  * 0960-20 = M12 FUEL™ 1.6 Gallon Wet/Dry Vacuum ($219.00 - $249.00 CAD).
  * 2767 = M18 FUEL 1/2" High Torque Impact Wrench w/ Friction Ring
  * 2766 = M18 FUEL 1/2" High Torque Impact Wrench w/ Pin Detent
  * 2864 = M18 FUEL ONE-KEY 3/4" High Torque Impact Wrench
  * 2967 = M18 FUEL 1/2" High Torque Impact Wrench (Gen 2)
  * 2962 = M18 FUEL 1/2" Mid-Torque Impact Wrench
  * 2960 = M18 FUEL 3/8" Mid-Torque Impact Wrench
  * 2854 = M18 FUEL 3/8" Compact Impact Wrench
  * 2853 / 2953 = M18 FUEL 1/4" Hex Impact Driver
  * 2572 / 2572B = M12 AIRSNAKE™ Drain Cleaning Air Gun
  * 2470 = M12 Cordless Plastic Pipe Shear
  * 2471 = M12 Cordless Copper Tubing Cutter
  * 2771 = M18 Cordless Transfer Pump
  * 2821 / 2822 = M18 FUEL SAWZALL® Reciprocating Saw
  * 2526 = M12 FUEL Oscillating Multi-Tool
  * 2836 = M18 FUEL Oscillating Multi-Tool
  * 2522 = M12 FUEL 3" Compact Cut Off Tool
  * 49-66-6801 = 19PC SHOCKWAVE™ Impact Duty 3/8" Drive Metric Deep Well PACKOUT™ Socket Set (Includes: 6mm, 7mm, 8mm, 9mm, 10mm, 11mm, 12mm, 13mm, 14mm, 15mm, 16mm, 17mm, 18mm, 19mm, 20mm, 21mm, 22mm, 23mm, 24mm deep impact sockets, removable socket storage tray, and compact PACKOUT organizer case - $159.00 - $179.00 CAD MSRP).
  * 49-66-6800 = 15PC SHOCKWAVE™ Impact Duty 3/8" Drive SAE Deep Well PACKOUT™ Socket Set ($139.00 - $159.00 CAD).
  * 49-66-6802 = 31PC SHOCKWAVE™ Impact Duty 3/8" Drive SAE & Metric Deep Well PACKOUT™ Socket Set ($249.00 - $279.00 CAD).
  * 49-66-6803 = 43PC SHOCKWAVE™ Impact Duty 3/8" Drive SAE & Metric Standard & Deep PACKOUT™ Socket Set ($299.00 - $349.00 CAD).
  * 49-66-6804 = 29PC SHOCKWAVE™ Impact Duty 1/2" Drive Metric Deep Well PACKOUT™ Socket Set ($249.00 - $289.00 CAD).
  * 49-66-6805 = 31PC SHOCKWAVE™ Impact Duty 1/2" Drive SAE & Metric Deep Well PACKOUT™ Socket Set ($279.00 - $319.00 CAD).
  * 49-66-6806 = 19PC SHOCKWAVE™ Impact Duty 1/2" Drive Metric Deep Well PACKOUT™ Socket Set ($189.00 - $219.00 CAD).
  * 49-66-6831 = 19PC 3/8" Drive Metric PACKOUT Socket Storage Tray Only ($29.99 CAD).
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

- STEALTH / STEALTH AIR / STANLEY WET DRY VAC:
  * ST08-2502 / 08-2502 = 2-1/2" x 20" Universal Wet/Dry Vacuum Extension Wand ($9.99 - $14.99 CAD). Fits all standard 2-1/2" diameter wet/dry vacuum hoses. High-durability black poly construction for workshop, auto detailing, and jobsite clean-up.
  * ST08-2518 / 08-2518 = 2-1/2" x 8' Locking Wet/Dry Vacuum Hose ($24.99 - $32.99 CAD).
  * ST08-2566 / 08-2566 = Wet/Dry Vacuum Cartridge Filter for 5-18 Gallon Vacuums ($24.99 - $34.99 CAD).
  * ST08-2503 = 2-1/2" Utility Nozzle for Wet/Dry Vacuums ($9.99 - $12.99 CAD).
  * ST08-2504 = 2-1/2" Crevice Tool for Wet/Dry Vacuums ($8.99 - $11.99 CAD).
  * ST08-2505 = 2-1/2" Floor Nozzle with Squeegee ($14.99 - $19.99 CAD).
  * ST08-2506 = 2-1/2" Round Dusting Brush ($8.99 - $11.99 CAD).

- OX TOOLS / AUX TOOLS:
  * OX-P0244 / P0244 = OX Pro Box Spirit Level Series (Heavy-duty aluminum box-beam profile, Dual-View Plumb Site® vial, UV-resistant magnified acrylic block vials ±0.0005 in/in / 0.5 mm/m precision).
  * OX-P024424 / OX-P024496 / 96" = 96" (2400mm / 8ft) Non-Magnetic Pro Box Spirit Level ($179.00 - $199.00 CAD)
  * Warranty for OX Levels: "OX Tools Lifetime Vial Warranty: Vials are guaranteed for life against leakage, fogging, and loss of accuracy (±0.0005 in/in / 0.5 mm/m); backed by OX Tools 3-Year Limited Manufacturer Warranty on level frame and body."
`;

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

      // 1. Direct official manufacturer URLs
      if (lowerBrand.includes('milwaukee')) {
        candidateProductUrls.push(`https://www.milwaukeetool.com/Products/${cleanMfrSku}`);
        candidateProductUrls.push(`https://www.milwaukeetool.ca/Products/${cleanMfrSku}`);
      } else if (lowerBrand.includes('dewalt')) {
        candidateProductUrls.push(`https://www.dewalt.com/product/${cleanMfrSku.toLowerCase()}`);
        candidateProductUrls.push(`https://www.dewalt.ca/product/${cleanMfrSku.toLowerCase()}`);
      } else if (lowerBrand.includes('makita')) {
        candidateProductUrls.push(`https://www.makitatools.com/products/details/${cleanMfrSku}`);
      } else if (lowerBrand.includes('stealth')) {
        candidateProductUrls.push(`https://stealthvacs.com/products/${cleanMfrSku.toLowerCase()}`);
        candidateProductUrls.push(`https://www.stealthvacs.com/products/${sku.toLowerCase()}`);
      } else if (lowerBrand.includes('badger') || lowerBrand.includes('occidental')) {
        candidateProductUrls.push(`https://badgertoolbelts.com/search?q=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://badgertoolbelts.com/products/${cleanMfrSku.toLowerCase()}`);
        candidateProductUrls.push(`https://squareshardware.ca/search?q=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://www.burnstools.com/catalogsearch/result/?q=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://www.atlas-machinery.com/search.php?search_query=${encodeURIComponent(cleanMfrSku)}`);
      } else if (lowerBrand.includes('olight')) {
        candidateProductUrls.push(`https://www.olightstore.ca/search?q=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://www.olightstore.com/search?q=${encodeURIComponent(cleanMfrSku)}`);
        candidateProductUrls.push(`https://ca.olight.com/products/${cleanMfrSku.toLowerCase()}`);
        candidateProductUrls.push(`https://www.olight.com/products/${cleanMfrSku.toLowerCase()}`);
      } else if (lowerBrand.includes('malco')) {
        candidateProductUrls.push(`https://www.malcopro.com/product/${cleanMfrSku.toLowerCase()}`);
      } else if (lowerBrand.includes('knipex')) {
        candidateProductUrls.push(`https://www.knipex.com/products/${cleanMfrSku.replace(/\s+/g, '')}`);
      } else if (lowerBrand.includes('wiha')) {
        candidateProductUrls.push(`https://www.wihatools.com/products/${cleanMfrSku.toLowerCase()}`);
      } else if (lowerBrand.includes('ox')) {
        candidateProductUrls.push(`https://oxtools.ca/products/${cleanMfrSku.toLowerCase()}`);
      }

      // 2. Canadian Authorized Industrial Distributors
      const cadDistributorUrls = [
        `https://www.mississaugahardware.com/search?q=${encodeURIComponent(cleanMfrSku)}`,
        `https://thetoolstore.ca/search?type=product&q=${encodeURIComponent(cleanMfrSku)}`,
        `https://www.atlas-machinery.com/search.php?search_query=${encodeURIComponent(cleanMfrSku)}`,
        `https://www.bcfasteners.com/?s=${encodeURIComponent(cleanMfrSku)}&post_type=product`,
        `https://www.kmstools.com/catalogsearch/result/?q=${encodeURIComponent(cleanMfrSku)}`
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
                  if (cleanMfrSku.includes('PUR') && (lower.includes('tan') || lower.includes('desert') || lower.includes('green') || lower.includes('odg') || lower.includes('black') || lower.includes('blue'))) continue;
                  if (cleanMfrSku.includes('ODG') && (lower.includes('purple') || lower.includes('violet') || lower.includes('tan') || lower.includes('desert') || lower.includes('blue'))) continue;
                  if (cleanMfrSku.includes('TAN') && (lower.includes('purple') || lower.includes('violet') || lower.includes('green') || lower.includes('odg') || lower.includes('blue') || lower.includes('black'))) continue;
                  if (
                    (lower.includes('arkpro') || lower.includes('arkpurple') || lower.includes('violet') || lower.includes('purple') || lower.includes('olightstore')) &&
                    !NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k))
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
                if (cleanMfrSku.includes('461055') && (ogLower.includes('grey') || ogLower.includes('gunmetal') || ogLower.includes('coyote') || ogLower.includes('sage') || ogLower.includes('461010') || ogLower.includes('461030'))) {
                  // Skip conflicting color
                } else if (cleanMfrSku.includes('PUR') && (ogLower.includes('tan') || ogLower.includes('desert') || ogLower.includes('green') || ogLower.includes('odg') || ogLower.includes('black') || ogLower.includes('blue'))) {
                  // Skip conflicting color
                } else if (!NON_PRODUCT_BLOCKLIST.some(k => ogLower.includes(k))) {
                  const canonical = normalizeAndCanonicalizeUrl(ogUrl);
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

      // Universal Direct Exact-Image Search with tool context
      if (mfrStudioImages.length + secondaryImages.length < 4) {
        try {
          const toolCategoryHint = lowerBrand.includes('badger') || lowerBrand.includes('occidental') ? 'tool belt' : (lowerBrand.includes('olight') ? 'flashlight' : '');
          const bQueries = [
            `"${brand}" "${sku}" ${toolCategoryHint}`.trim(),
            `"${brand}" "${cleanMfrSku}" ${toolCategoryHint}`.trim(),
            `"${cleanMfrSku}" ${toolCategoryHint}`.trim()
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
                  if (cleanMfrSku.includes('461055') && (lower.includes('grey') || lower.includes('gunmetal') || lower.includes('coyote') || lower.includes('sage') || lower.includes('461010') || lower.includes('461030'))) continue;
                  if (cleanMfrSku.includes('PUR') && (lower.includes('tan') || lower.includes('desert') || lower.includes('green') || lower.includes('odg') || lower.includes('black') || lower.includes('blue'))) continue;
                  if (!NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k))) {
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
      const modelsToTry = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
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
