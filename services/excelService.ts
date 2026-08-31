
import * as XLSX_PKG from 'xlsx';
import { ProductRow, Mapping } from '../types';
import { GoogleGenAI } from "@google/genai";

// Handle ESM import variations for xlsx-js-style
// @ts-ignore
const XLSX = XLSX_PKG.default || XLSX_PKG;

// --- CONSTANTS ---
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

export function resolveBrandWarranty(brand: string, productType?: string, title?: string, sku?: string, aiWarranty?: string): string {
  if (aiWarranty && aiWarranty.trim().length > 10) {
    return aiWarranty.trim();
  }

  const b = String(brand || '').toUpperCase();
  const t = String(title || '').toLowerCase();
  const p = String(productType || '').toLowerCase();

  const isPowerTool = t.includes('cordless') || t.includes('fuel') || t.includes('m12') || t.includes('m18') || 
                      t.includes('20v') || t.includes('40v') || t.includes('18v') || t.includes('xgt') || 
                      t.includes('lxt') || t.includes('impact') || t.includes('drill') || t.includes('saw') || 
                      t.includes('grinder') || t.includes('sander') || t.includes('router') || t.includes('blower') ||
                      t.includes('compressor') || t.includes('rotary hammer') ||
                      p.includes('power') || p.includes('cordless') || p.includes('saw') || p.includes('drill') || p.includes('impact');

  const isHandTool = t.includes('wrench') || t.includes('socket') || t.includes('ratchet') || t.includes('plier') || 
                     t.includes('cutter') || t.includes('screwdriver') || t.includes('hex key') || t.includes('clamp') || 
                     t.includes('hammer') || t.includes('tape') || t.includes('level') || t.includes('knife') || 
                     t.includes('snip') || t.includes('pry bar') || t.includes('punch') || t.includes('chisel') ||
                     p.includes('hand tool') || p.includes('wrench') || p.includes('plier');

  if (b.includes('MILWAUKEE')) {
    if (t.includes('trimmer') || t.includes('blower') || t.includes('chainsaw') || t.includes('mower') || p.includes('outdoor')) {
      return 'MILWAUKEE 3-Year Limited Warranty on M18 FUEL Outdoor Power Equipment, and 3-Year Limited Warranty on REDLITHIUM High Output battery packs.';
    }
    if (isPowerTool) {
      return 'MILWAUKEE 5-Year Limited Tool Warranty on cordless power tools, 3-Year Limited Warranty on REDLITHIUM XC battery packs, and 2-Year Warranty on compact batteries.';
    }
    if (isHandTool) {
      return 'MILWAUKEE Limited Lifetime Warranty: Hand tools are warranted to the original purchaser to be free from defects in material and workmanship for the useful life of the tool.';
    }
    return 'MILWAUKEE Limited Lifetime Warranty on Hand Tools against defects in materials and workmanship.';
  }
  if (b.includes('DEWALT')) {
    if (isPowerTool) {
      return 'DEWALT 3-Year Limited Warranty, 1-Year Free Service Contract, and 90-Day Money-Back Guarantee on cordless power tools.';
    }
    if (isHandTool) {
      return 'DEWALT Full Lifetime Warranty on mechanics hand tools, ratchets, and wrenches.';
    }
    return 'DEWALT 3-Year Limited Warranty on power tools, or Full Lifetime Warranty on manual hand tools.';
  }
  if (b.includes('BOSCH')) {
    return 'Bosch 1-Year Limited Manufacturer Warranty with PRO+3 Extended Warranty coverage available upon online product registration.';
  }
  if (b.includes('BLUESTREAK') || b.includes('BLUE STREAK')) {
    return 'Bluestreak Lifetime Magnet Warranty: Permanent rare-earth and ceramic magnet assemblies are guaranteed never to lose magnetic strength under normal operating conditions.';
  }
  if (b.includes('MAKITA')) {
    return 'Makita 3-Year Limited Warranty on 18V LXT / 40V XGT cordless tools, lithium-ion batteries, and chargers against defects from faulty materials or workmanship.';
  }
  if (b.includes('FESTOOL')) {
    return 'Festool 3-Year All-Inclusive Warranty: Includes comprehensive coverage for repair costs, wear-and-tear replacement parts, theft protection, and a 10-year dedicated parts availability guarantee.';
  }
  if (b.includes('STABILA')) {
    if (t.includes('laser') || p.includes('laser') || t.includes('electronic') || p.includes('tech')) {
      return 'STABILA 2-Year Limited Manufacturer Warranty: Covers electronic sensors, laser diodes, and internal circuitry against defects in materials and workmanship.';
    }
    return 'STABILA Lifetime Accuracy Warranty: Precision-cast acrylic vials are guaranteed never to fog, leak, or lose accuracy under normal jobsite use.';
  }
  if (b.includes('TOPCON')) {
    return 'Topcon 2-Year / 3-Year Limited Manufacturer Warranty on construction lasers, total stations, and positioning equipment against manufacturing defects and calibration drift under standard field conditions.';
  }
  if (b.includes('TAJIMA')) {
    return 'TAJIMA Limited Lifetime Warranty against defects in material and workmanship under normal professional trade use.';
  }
  if (b.includes('WERA')) {
    return 'Wera Lifetime Limited Warranty: Wera warrants its hand tools, torque wrenches, and bit systems against defects in materials and workmanship under normal professional trade conditions.';
  }
  if (b.includes('WIHA')) {
    return 'Wiha Lifetime Guarantee: Wiha tools are guaranteed against defects in materials and craftsmanship for the life of the product.';
  }
  if (b.includes('BESSEY')) {
    return 'BESSEY Lifetime Limited Warranty: Guaranteed against defects in materials and workmanship under normal professional trade use.';
  }
  if (b.includes('WATSON')) {
    return 'Watson Gloves Manufacturer Guarantee against defects in craftsmanship and materials under normal commercial trade use.';
  }
  if (b.includes('KNIPEX')) {
    return 'KNIPEX Lifetime Limited Warranty: Precision forged in Germany, guaranteed against defects in materials and workmanship under normal professional trade use.';
  }
  if (b.includes('OX TOOLS') || b.includes('OX ') || b === 'OX' || b.includes('AUX TOOLS')) {
    if (t.includes('level') || p.includes('level')) {
      return 'OX Tools Lifetime Vial Warranty: Vials are guaranteed for life against leakage, fogging, and loss of accuracy (±0.0005 in/in / 0.5 mm/m); backed by OX Tools 3-Year Limited Manufacturer Warranty on level frame and body.';
    }
    if (t.includes('diamond') || t.includes('blade') || p.includes('blade')) {
      return 'OX Tools Guaranteed Tough Diamond Blade Warranty against segment loss or core cracking under recommended operating RPMs.';
    }
    return 'OX Tools Hand Tool Limited Lifetime Warranty against defects in materials and craftsmanship under normal commercial trade use.';
  }
  if (b.includes('SOLA')) {
    return 'SOLA Lifetime Vial Warranty: Patented FOCUS acrylic vials are guaranteed for life against leakage and fading with ±0.5 mm/m precision accuracy.';
  }
  if (b.includes('EGO')) {
    return 'EGO Power+ 5-Year Limited Tool Warranty and 3-Year Limited Battery Warranty for residential use (1-Year Commercial Warranty) against defects in materials and workmanship. Wise Line Tools is an authorized Canadian supplier.';
  }
  if (b.includes('EDGE') || b.includes('EDGE EYEWEAR')) {
    return 'Edge Eyewear Manufacturer Limited Warranty against defects in materials and craftsmanship. Meets ANSI Z87.1+ and CSA Z94.3 safety benchmarks for high-impact industrial eye protection.';
  }
  if (b.includes('DYNAMIC') || b.includes('DYNAMIC SAFETY')) {
    return 'Dynamic Safety / PIP Canada Manufacturer Guarantee against defects in materials and workmanship. Certified to applicable NIOSH, CSA, and ANSI personal protective equipment (PPE) safety standards.';
  }
  return `Official ${b || 'Manufacturer'} Canadian Manufacturer Warranty applies. Wise Line Tools is an authorized Canadian supplier with full warranty and service support.`;
}

export const NON_PRODUCT_BLOCKLIST = [
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

export function normalizeAndCanonicalizeUrl(rawUrl: string): string {
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

export function getCanonicalAssetKey(url: string): string {
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

export const cleanImageUrl = (url: any): string => {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim().replace(/['"]/g, '').replace(/ /g, '%20');
  
  if (clean.startsWith('//')) clean = 'https:' + clean;
  if (clean.startsWith('http://')) clean = clean.replace('http://', 'https://');
  
  const lower = clean.toLowerCase();
  
  // STRICT BLOCKLIST: Placeholders, Logos, Banners, Separator Lines, and Blocked CDNs
  if (lower.includes('placehold.co') || 
      lower.includes('via.placeholder') || 
      lower.includes('dummyimage') ||
      lower.includes('placeholder') ||
      lower.includes('no-image') ||
      lower.includes('no_image') ||
      lower.includes('not_found') ||
      lower.includes('default_image') ||
      lower.includes('thdstatic.com') ||
      lower.includes('logo') ||
      lower.includes('banner') ||
      lower.includes('badge') ||
      lower.includes('mapleleaf') ||
      lower.includes('image-manager') ||
      lower.includes('beaver') ||
      lower.includes('bis-') ||
      lower.includes('divider') ||
      lower.includes('separator') ||
      lower.includes('gradient') ||
      NON_PRODUCT_BLOCKLIST.some(k => lower.includes(k))) {
      return '';
  }

  // Filter out non-permanent or low-quality thumbnails/proxies
  if (lower.includes('gstatic.com') || 
      lower.includes('encrypted-tbn') || 
      lower.includes('search_thumbnail') ||
      lower.startsWith('data:image')) {
      return '';
  }

  // Filter out bare domains or HTML pages (must have an image extension or look like a CDN path)
  try {
      const urlObj = new URL(clean);
      const path = urlObj.pathname.toLowerCase();
      if (path === '/' || path === '' || path.endsWith('.html') || path.endsWith('.php') || path.endsWith('.aspx')) {
          return '';
      }
  } catch (e) {
      return '';
  }

  return normalizeAndCanonicalizeUrl(clean);
};

export const generatePromoImage = async (product: ProductRow, apiKey: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    
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

    const candidateModels = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-3.1-flash-image'];

    for (const model of candidateModels) {
        try {
            const response = await ai.models.generateContent({
                model,
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
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        } catch (e) {
            console.warn(`Promo image generation with model ${model} failed, trying next...`, e);
        }
    }
    
    throw new Error("Failed to generate promotional image with available models.");
};

export const resolveDirectBrandGrounding = (brand: string, sku: string): any => {
  const b = String(brand || '').toUpperCase();
  const s = String(sku || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const cleanSku = s.replace(/^[A-Z]{2,4}-/i, '');

  // 1. BOSCH TOOLS
  if (b.includes('BOSCH')) {
    if (s.includes('GCM18V-12GDCN14') || s.includes('GCM18V12GDCN14') || (s.includes('GCM18V') && s.includes('12GDC'))) {
      return {
        title: 'Bosch GCM18V-12GDCN14 18V PROFACTOR 12" Dual-Bevel Glide Miter Saw Kit',
        price_cad: '1149.00',
        barcode: '000346487654',
        weight_grams: '29000',
        country_of_origin: 'MX',
        hs_code: '8467.29',
        google_category: 'Hardware > Tools > Saws > Miter Saws',
        product_type: 'Miter Saws',
        tags: 'BOSCH, GCM18V-12GDCN14, 18V PROFACTOR, Axial-Glide, Dual-Bevel Miter Saw, Cordless Power Tools, Wise Line Tools',
        included_in_box: [
          '(1) GCM18V-12GDCN14 18V PROFACTOR 12" Dual-Bevel Glide Miter Saw',
          '(1) GBA18V120 18V CORE18V 12.0Ah PROFACTOR High Power Battery',
          '(1) GAL18V-160C 18V 16-Amp Hell-ion Turbo Charger',
          '(1) 12" 60-Tooth Carbide-Tipped Precision Saw Blade',
          '(1) Material Clamp & High-Efficiency Dust Collection Bag',
          '(1) Tool-Free Blade Change Wrench'
        ],
        features: [
          'Axial-Glide System: Patented articulating glide arm delivers wider cross-cuts and velvety smooth alignment while saving up to 12 inches of workspace versus traditional slide rails.',
          'BITURBO Brushless Technology: High-performance brushless motor and drive-train system engineered to deliver power equivalent to a 15-amp corded miter saw.',
          'Large Cutting Capacity: Features 3.5 in. depth of cut and 14 in. width/crosscut capacity for cutting thick dimensional lumber and large baseboards.',
          'Dual-Bevel Versatility: Features easy-to-read upfront bevel controls and detents with 0° to 47° bevel capacity left and right.',
          'Integrated Cutline LED Worklight: Casts a shadow line across the workpiece for precise, fast blade alignment in any lighting condition.'
        ],
        specs: [
          { name: 'Manufacturer', value: 'BOSCH' },
          { name: 'Model / Part Number', value: 'GCM18V-12GDCN14' },
          { name: 'Blade Diameter', value: '12 Inches (305 mm)' },
          { name: 'Arbor Size', value: '1 Inch' },
          { name: 'Voltage', value: '18V Lithium-Ion (CORE18V PROFACTOR)' },
          { name: 'No Load RPM', value: '4,000 RPM' },
          { name: 'Bevel Angle Range', value: '0° to 47° Left & Right' },
          { name: 'Miter Angle Range', value: '0° to 52° Left, 0° to 60° Right' },
          { name: 'Tool Weight', value: '64 lbs (29,000 g)' },
          { name: 'Country of Origin', value: 'Mexico (MX)' }
        ],
        images: [
          'https://cdn11.bigcommerce.com/s-c7n52h/images/stencil/1280x1280/products/33393/62508/cordlessmitersaw18vboschGCM18V12GDCN14kit4__61906.1736188930.png',
          'https://cdn11.bigcommerce.com/s-c7n52h/images/stencil/1280x1280/products/33393/62513/Cordlessmitersaw18vGCM18V12GDCN14walkaround2__01071.1629318423.png',
          'https://cdn11.bigcommerce.com/s-c7n52h/images/stencil/1280x1280/products/33393/62515/cordlessmitersaw18vboschGCM18V12GDCN14beauty6__88333.1629318428.png',
          'https://cdn11.bigcommerce.com/s-c7n52h/images/stencil/1280x1280/products/33393/62512/Cordlessmitersaw18vGCM18V12GDCN14_extended_bare2__19980.1629318422.png',
          'https://cdn11.bigcommerce.com/s-c7n52h/images/stencil/1280x1280/products/33393/62511/Cordlessmitersaw18vGCM18V12GDCN14_tilt2__56790.1629318419.png',
          'https://cdn11.bigcommerce.com/s-c7n52h/images/stencil/1280x1280/products/33393/62514/Cordlessmitersaw18vGCM18V12GDCN14_HMI2__23754.1629318425.png',
          'https://cdn11.bigcommerce.com/s-c7n52h/images/stencil/1280x1280/products/33393/62507/Cordlessmitersaw18vGCM18V12GDCN_2_x_42__08957.1629318413.png',
          'https://cdn11.bigcommerce.com/s-c7n52h/images/stencil/1280x1280/products/33393/62509/Cordlessmitersaw18vGCM18V12GDCN_2_x_82__22673.1629318413.png'
        ]
      };
    }
    if (s.includes('LR8') || s.includes('LR-8')) {
      return {
        title: 'Bosch LR8 Dual-Sided Line Laser Receiver for Green and Red Beam Lasers',
        price_cad: '139.99',
        barcode: '000346648753',
        weight_grams: '420',
        country_of_origin: 'MY',
        hs_code: '9031.80',
        google_category: 'Hardware > Tools > Measuring Tools & Sensors > Level Sensors & Laser Receivers',
        product_type: 'Laser Receivers',
        tags: 'BOSCH, LR8, Laser Receiver, Green Beam, Red Beam, Leveling, Wise Line Tools',
        included_in_box: [
          '(1) LR8 Line Laser Receiver',
          '(1) Quick-Release Mounting Bracket',
          '(2) AA Batteries',
          '(1) Protective Belt Pouch'
        ],
        features: [
          'Dual-Beam Compatibility: Detects both green-beam and red-beam Bosch line lasers over extended distances.',
          'Extended Working Range: Extends laser line reception up to 330 ft. diameter in bright ambient light and outdoor environments.',
          'Dual-Sided Backlit LCD Display: Clear visual readout on front and back allows easy viewing from either side during alignment.',
          'Audible Detection Indicator: Volume-adjustable audio signal provides clear acoustic feedback when centered on the laser line.',
          'Top-Mounted Heavy-Duty Magnets: Securely adheres to steel studs and drop ceiling track for hands-free operation.'
        ],
        specs: [
          { name: 'Brand', value: 'BOSCH' },
          { name: 'Model Number', value: 'LR8' },
          { name: 'Laser Diode Compatibility', value: 'Red (630–650 nm) & Green (500–540 nm)' },
          { name: 'Working Range', value: 'Up to 330 ft. (100 m) Diameter' },
          { name: 'Ingress Protection', value: 'IP54 (Dust & Splash Resistant)' }
        ],
        images: [
          'https://cdn11.bigcommerce.com/s-c7n52h/images/stencil/1280x1280/products/26987/42347/Untitled-1__54613.1545160992.jpg'
        ]
      };
    }
  }

  // 2. BLUESTREAK MAGNETIC SWEEPERS
  if (b.includes('BLUESTREAK') || b.includes('BLUE STREAK')) {
    if (s.includes('PSPRO12') || s.includes('PSPR012') || s.includes('POW-PSPRO12')) {
      return {
        title: 'Bluestreak POW-PSPRO12 Powerstik Pro 12" Handheld Magnetic Sweeper',
        price_cad: '259.00',
        barcode: '062805510101',
        weight_grams: '2720',
        country_of_origin: 'CA',
        hs_code: '8505.11',
        google_category: 'Hardware > Tools > Sweepers > Magnetic Sweepers',
        product_type: 'Magnetic Sweepers',
        tags: 'Bluestreak, POW-PSPRO12, Powerstik Pro, Magnetic Sweeper, Handheld Sweeper, Clean-Up Tools, Wise Line Tools',
        included_in_box: [
          '(1) Bluestreak POW-PSPRO12 12" Powerstik Pro Magnetic Sweeper',
          '(1) Quick-Release T-Handle Clean-Off Mechanism',
          '(1) Heavy-Duty Wall Mounting Storage Bracket'
        ],
        features: [
          'Instant Debris Release: High-strength sliding internal magnet core instantly drops all collected nails, screws, and metal shavings with one pull.',
          'Permanent Rare-Earth & Ceramic Magnet Core: Guaranteed never to lose magnetic charge under standard operating conditions.',
          'Aircraft-Grade Anodized Aluminum Housing: Lightweight, non-rusting, and impact-resistant for harsh jobsite environments.',
          'Ergonomic Non-Slip Grip: Designed for continuous one-handed clean-up around workshops, fabrication bays, and roofing jobsites.'
        ],
        specs: [
          { name: 'Manufacturer', value: 'Bluestreak Equipment' },
          { name: 'Model / Part Number', value: 'POW-PSPRO12' },
          { name: 'Sweeping Width', value: '12 Inches (30.5 cm)' },
          { name: 'Lifting Capacity', value: 'Up to 30 lbs of Metal Hardware' },
          { name: 'Housing Material', value: 'Anodized Aircraft Aluminum' },
          { name: 'Country of Origin', value: 'Canada (CA)' }
        ],
        images: [
          'https://cdn11.bigcommerce.com/s-c7n52h/images/stencil/1280x1280/products/92362/143112/VEL-WB-600-G-C__84540.1787857023.jpg'
        ]
      };
    }
  }

  // 3. WATSON GLOVES
  if (b.includes('WATSON') && (s.includes('2775') || s.toLowerCase().includes('sexy'))) {
    return {
      title: 'Watson Gloves 2775 Sexy Back - Heavy Metal MIG Welding Gloves',
      price_cad: '28.99',
      barcode: '065537815739',
      weight_grams: '320',
      country_of_origin: 'CN',
      hs_code: '4203.29',
      google_category: 'Business & Industrial > Work Safety Protective Gear > Protective Gloves',
      product_type: 'Welding Gloves',
      tags: 'Watson Gloves, 2775, Sexy Back, MIG Welding Gloves, Leather Safety Gloves, Wise Line Tools',
      included_in_box: [
        '(1 Pair) Watson Gloves 2775 Sexy Back MIG Welding Gloves'
      ],
      features: [
        'Made for MIG Welding: Engineered for heavy-duty welding, fabrication, and metalworking.',
        'Full-Grain Cowhide Leather: Premium grain palm provides exceptional dexterity and abrasion resistance.',
        'Kevlar® Heat-Resistant Stitching: Sewn with genuine Kevlar® thread for superior seam strength and burnout protection.',
        'Gauntlet Safety Cuff: Heavy split cowhide cuff with pulse protector guards wrist and forearm against sparks and heat.'
      ],
      specs: [
        { name: 'Brand', value: 'Watson Gloves' },
        { name: 'Model Number', value: '2775 (Sexy Back)' },
        { name: 'Material', value: 'Full-Grain Cowhide & Split Leather' },
        { name: 'Stitching', value: '100% Kevlar® Flame-Resistant Thread' },
        { name: 'Heat Rating', value: 'ANSI Conductive Heat Level 3' }
      ],
      images: [
        'https://www.watsongloves.com/wp-content/uploads/2012/11/2775-Sexy-Back-1.png'
      ]
    };
  }

  // 4. WIHA TOOLS
  if (b.includes('WIHA') && (cleanSku === '38048' || cleanSku.includes('38048') || s.includes('STUBBY'))) {
    return {
      title: 'Wiha 38048 SoftFinish® Stubby Pop-Up Bit Holder Screwdriver Set (6-Piece)',
      price_cad: '33.99',
      barcode: '084705380485',
      weight_grams: '140',
      country_of_origin: 'DE',
      hs_code: '8205.40',
      google_category: 'Hardware > Tools > Screwdrivers',
      product_type: 'Screwdrivers & Bit Sets',
      tags: 'Wiha, 38048, SoftFinish, Stubby Screwdriver, Pop-Up Bit Holder, Precision Hand Tools, Wise Line Tools',
      included_in_box: [
        '(1) Wiha SoftFinish® Stubby 1/4" Magnetic Bit Holder Screwdriver',
        '(2) Phillips Insert Bits: #1, #2',
        '(2) Square (Robertson) Insert Bits: #1, #2',
        '(2) Slotted Insert Bits: 4.5mm, 6.5mm'
      ],
      features: [
        'SoftFinish® Cushion Grip: Patented multi-component handle engineered for maximum torque transfer and hand comfort.',
        'Pop-Up Bit Storage: Internal spring-loaded magazine provides organized storage and instant access to 6 insert bits.',
        'Stubby Compact Profile: Short handle allows effortless leverage and fastener driving in tight, confined spaces.',
        'Wiha CVM Tool Steel: Precision-machined bit tips from premium Chrome-Vanadium-Molybdenum steel for exact fastener fit.'
      ],
      specs: [
        { name: 'Brand', value: 'WIHA' },
        { name: 'Part Number', value: '38048 (WIH-38048)' },
        { name: 'Drive Size', value: '1/4" Hex Magnetic Bit Holder' },
        { name: 'Handle Type', value: 'SoftFinish® Stubby Pop-Up' },
        { name: 'Country of Origin', value: 'Germany (DE)' }
      ],
      images: [
        'https://cdn11.bigcommerce.com/s-c7n52h/images/stencil/1280x1280/products/23837/28972/38048-3__44871.1467061609__51686.1490273242.jpg'
      ]
    };
  }

  return null;
};

export const createProductFromSku = async (
    brand: string, 
    sku: string, 
    modelHint?: string, 
    existingContext: ProductRow = {}
): Promise<ProductRow[]> => {
    const directGrounding = resolveDirectBrandGrounding(brand, sku);

    try {
        console.log(`[AI Synthesis] Initiating server-side synthesis for ${brand} ${sku}...`);
        const response = await fetch('/api/ai/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                brand,
                sku,
                systemTitleHint: modelHint || existingContext['Title'] || '',
                existingContext
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.data) {
            if (result.error && result.error.includes('allowance has temporarily been reached')) {
                throw new Error(result.error);
            }
            throw new Error(result.error || 'Failed to synthesize product data.');
        }

        const { modelUsed, isFallback, sourceUrls, data, images: serverDiscoveredImages } = result;
        console.log(`[AI Synthesis Success] Model: ${modelUsed} (${isFallback ? 'FREE FALLBACK' : 'PRIMARY MODEL'})`);

        // Perform image verification & scraping
        let scrapedImages: string[] = [];
        try {
            const scrapeRes = await fetch('/api/media/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brand,
                    sku,
                    candidateUrls: [
                        ...(Array.isArray(data.images) ? data.images : []),
                        ...(serverDiscoveredImages || [])
                    ].filter(Boolean)
                })
            });
            if (scrapeRes.ok) {
                const scrapeJson = await scrapeRes.json();
                if (scrapeJson.images && Array.isArray(scrapeJson.images)) {
                    scrapedImages = scrapeJson.images;
                }
            }
        } catch (scrapeErr) {
            console.warn('Scraping notice:', scrapeErr);
        }

        const candidateImages = [
            ...(directGrounding?.images || []),
            ...scrapedImages,
            ...(serverDiscoveredImages || []),
            ...(Array.isArray(data.images) ? data.images : [])
        ];

        const validImages: string[] = [];
        const seenAssetKeys = new Set<string>();

        for (const rawImg of candidateImages) {
            const cleaned = cleanImageUrl(rawImg);
            if (!cleaned) continue;
            const assetKey = getCanonicalAssetKey(cleaned);
            if (!seenAssetKeys.has(assetKey)) {
                seenAssetKeys.add(assetKey);
                validImages.push(cleaned);
            }
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

        const aiPrice = data.price_cad ? String(data.price_cad).replace(/[^0-9.]/g, '') : (directGrounding?.price_cad || '');
        const existingPrice = existingContext['Variant Price'] ? String(existingContext['Variant Price']).replace(/[^0-9.]/g, '') : '';
        const finalPrice = existingPrice && parseFloat(existingPrice) > 0 ? existingPrice : aiPrice;

        const aiGrams = data.weight_grams ? String(data.weight_grams).replace(/[^0-9]/g, '') : (directGrounding?.weight_grams || '');
        const existingGrams = existingContext['Variant Grams'] ? String(existingContext['Variant Grams']).replace(/[^0-9]/g, '') : '';
        const finalGrams = existingGrams && parseInt(existingGrams) > 0 ? existingGrams : aiGrams;

        const finalBarcode = (existingContext['Variant Barcode'] && String(existingContext['Variant Barcode']).length > 6) 
            ? existingContext['Variant Barcode'] 
            : (data.barcode ? `'${String(data.barcode).replace(/[^0-9]/g, '')}` : (directGrounding?.barcode ? `'${directGrounding.barcode}` : ''));

        let cleanBody = data.body_html || existingContext['Body (HTML)'] || '';
        cleanBody = cleanBody
            .replace(/<h3>Product Overview<\/h3>/gi, '')
            .replace(/<h3>Overview<\/h3>/gi, '')
            .replace(/<h2>Product Overview<\/h2>/gi, '')
            .replace(/<h2>Overview<\/h2>/gi, '')
            .replace(/<strong>Product Overview<\/strong>/gi, '')
            .replace(/<b>Product Overview<\/b>/gi, '')
            .replace(/(?:As an authorized[^,]*,?\s*)?(?:Wise\s*Line\s*Tools\s*(?:presents|is pleased to present|proudly presents|introduces|offers)\s*(?:the\s*)?)/gi, '')
            .replace(/<p>\s*Wise Line Tools\s*(?:presents|is pleased to present|proudly presents|introduces|offers)\s*(?:the\s*)?/gi, '<p>The ')
            .replace(/Wise Line Tools presents\s*(?:the\s*)?/gi, 'The ');

        const warrantyText = resolveBrandWarranty(brand, data.product_type || directGrounding?.product_type, data.title || directGrounding?.title, sku, data.warranty);
        if (!cleanBody.toLowerCase().includes('warranty')) {
            cleanBody += `\n<h3>Manufacturer Warranty</h3>\n<p>${warrantyText}</p>`;
        }

        const estimatedCost = finalPrice && parseFloat(finalPrice) > 0 
            ? (parseFloat(finalPrice) * 0.70).toFixed(2) 
            : '';

        const mainRow: ProductRow = {
            ...existingContext,
            'Handle': handle,
            'Title': data.title || existingContext['Title'] || directGrounding?.title || `${brand} ${sku}`,
            'Body (HTML)': cleanBody,
            'Vendor': normalizeVendor(brand),
            'Product Category': data.google_category || existingContext['Product Category'] || directGrounding?.google_category || 'Hardware > Tools',
            'Type': data.product_type || existingContext['Type'] || directGrounding?.product_type || 'Hardware',
            'Tags': data.tags || existingContext['Tags'] || directGrounding?.tags || `${brand}, ${sku}, Wise Line Tools`,
            'Published': 'TRUE',
            'Option1 Name': existingContext['Option1 Name'] || 'Title',
            'Option1 Value': existingContext['Option1 Value'] || 'Default Title',
            'Option2 Name': existingContext['Option2 Name'] || '',
            'Option2 Value': existingContext['Option2 Value'] || '',
            'Option3 Name': existingContext['Option3 Name'] || '',
            'Option3 Value': existingContext['Option3 Value'] || '',
            'Variant SKU': sku,
            'Variant Grams': finalGrams,
            'Variant Inventory Tracker': 'shopify',
            'Variant Inventory Qty': existingContext['Variant Inventory Qty'] || '10',
            'Variant Inventory Policy': 'continue', 
            'Variant Fulfillment Service': existingContext['Variant Fulfillment Service'] || 'manual',
            'Variant Price': finalPrice,
            'Variant Compare At Price': existingContext['Variant Compare At Price'] || '',
            'Variant Requires Shipping': 'true',
            'Variant Taxable': 'true',
            'Unit Price Total Measure': existingContext['Unit Price Total Measure'] || '',
            'Unit Price Total Measure Unit': existingContext['Unit Price Total Measure Unit'] || '',
            'Unit Price Base Measure': existingContext['Unit Price Base Measure'] || '',
            'Unit Price Base Measure Unit': existingContext['Unit Price Base Measure Unit'] || '',
            'Variant Barcode': finalBarcode,
            'Variant HS Code': data.hs_code || existingContext['Variant HS Code'] || directGrounding?.hs_code || '',
            'Variant Country of Origin': data.country_of_origin || existingContext['Variant Country of Origin'] || directGrounding?.country_of_origin || 'CA',
            'Variant Image': existingContext['Variant Image'] || '',
            'Image Src': validImages.join(' | '),
            'Image Position': 1,
            'Image Alt Text': data.title || `${brand} ${sku}`,
            'Gift Card': 'false',
            'SEO Title': data.seo_title || data.title || `${brand} ${sku} | Wise Line Tools Canada`,
            'SEO Description': data.seo_description || `Buy the official ${brand} ${sku} at Wise Line Tools Canada. Authorized distributor with warranty and fast shipping.`,
            'Google Shopping / Google Product Category': data.google_category || directGrounding?.google_category || 'Hardware > Tools',
            'Google Shopping / Condition': 'new',
            'Variant Weight Unit': 'g',
            'Variant Tax Code': existingContext['Variant Tax Code'] || '',
            'Cost per item': existingContext['Cost per item'] || estimatedCost,
            'Status': existingContext['Status'] || 'draft',
            '_Product_Page': (sourceUrls && sourceUrls[0]) || '',
            '_Competitor_Links': (sourceUrls || []).join(' | '),
            'Included In Box': Array.isArray(data.included_in_box) ? data.included_in_box.join(', ') : (data.included_in_box || '')
        };

        return [mainRow];

    } catch (err: any) {
        console.error('Synthesis error:', err.message || err);

        // Fallback to directGrounding if available
        if (directGrounding) {
            console.log(`[Fallback] Using Direct Brand Grounding for ${brand} ${sku}`);
            const featuresHtml = (directGrounding.features && directGrounding.features.length > 0)
                ? `<h3>Key Features & Performance</h3>\n<ul>\n${directGrounding.features.map((f: string) => `  <li><strong>${f.split(':')[0]}:</strong>${f.split(':').slice(1).join(':') || f}</li>`).join('\n')}\n</ul>`
                : '';

            const specsHtml = (directGrounding.specs && directGrounding.specs.length > 0)
                ? `<h3>Technical Specifications</h3>\n<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">\n  <tbody>\n${directGrounding.specs.map((s: any) => `    <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 35%;">${s.name}</td><td style="padding: 8px 12px; color: #1e293b;">${s.value}</td></tr>`).join('\n')}\n  </tbody>\n</table>`
                : '';

            const includesHtml = (directGrounding.included_in_box && directGrounding.included_in_box.length > 0)
                ? `<h3>What's Included In The Box</h3>\n<ul>\n${directGrounding.included_in_box.map((i: string) => `  <li>${i}</li>`).join('\n')}\n</ul>`
                : '';

            const warrantyText = resolveBrandWarranty(brand, directGrounding.product_type, directGrounding.title, sku);
            const warrantyHtml = `<h3>Manufacturer Warranty & Support</h3>\n<p>${warrantyText}</p>`;

            const fullDescription = `<p>The <strong>${directGrounding.title}</strong> is engineered to deliver professional tradespeople unmatched precision, power, and jobsite reliability. Purpose-built for demanding commercial and industrial applications.</p>\n\n${featuresHtml}\n\n${specsHtml}\n\n${includesHtml}\n\n${warrantyHtml}`;

            let handle = (directGrounding.title || `${brand}-${sku}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

            return [{
                ...existingContext,
                'Handle': handle,
                'Title': directGrounding.title,
                'Body (HTML)': fullDescription,
                'Vendor': normalizeVendor(brand),
                'Product Category': directGrounding.google_category || 'Hardware > Tools',
                'Type': directGrounding.product_type || 'Hardware',
                'Tags': directGrounding.tags || `${brand}, ${sku}, Wise Line Tools`,
                'Published': 'TRUE',
                'Option1 Name': 'Title',
                'Option1 Value': 'Default Title',
                'Variant SKU': sku,
                'Variant Grams': directGrounding.weight_grams || '0',
                'Variant Inventory Tracker': 'shopify',
                'Variant Inventory Policy': 'continue',
                'Variant Fulfillment Service': 'manual',
                'Variant Price': directGrounding.price_cad || '0.00',
                'Variant Compare At Price': '',
                'Variant Requires Shipping': 'TRUE',
                'Variant Taxable': 'TRUE',
                'Variant Barcode': directGrounding.barcode ? `'${directGrounding.barcode}` : '',
                'Image Src': (directGrounding.images || []).join(' | '),
                'Image Position': 1,
                'Image Alt Text': directGrounding.title,
                'Cost per item': (parseFloat(directGrounding.price_cad || '0') * 0.7).toFixed(2),
                'Status': 'draft'
            }];
        }

        throw err;
    }
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
      
      // Normalize and dedupe
      const normalizedImages = images.map(img => {
          let clean = img;
          if (clean.startsWith('http://')) clean = clean.replace('http://', 'https://');
          return clean;
      });
      const uniqueImages = Array.from(new Set(normalizedImages));

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
                                
                                // Find all rows in the current sheet that belong to this SKU
                                // We match if the sheet SKU starts with the primary SKU (e.g. 48-22-6240 matches 48-22-6240_101)
                                // OR if the primary SKU starts with the sheet SKU (e.g. 48-22-6240_101 matches 48-22-6240)
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

        // Set Shopify defaults for mapped data
        newRow['Option1 Name'] = newRow['Option1 Name'] || 'Title';
        newRow['Option1 Value'] = newRow['Option1 Value'] || 'Default Title';
        newRow['Published'] = 'TRUE'; // Default to true per user request
        newRow['Status'] = newRow['Status'] || 'draft'; // Default to draft for safety
        newRow['Variant Inventory Tracker'] = newRow['Variant Inventory Tracker'] || 'shopify';
        newRow['Variant Inventory Policy'] = newRow['Variant Inventory Policy'] || 'deny';
        newRow['Variant Fulfillment Service'] = newRow['Variant Fulfillment Service'] || 'manual';
        newRow['Variant Requires Shipping'] = newRow['Variant Requires Shipping'] || 'true';
        newRow['Variant Taxable'] = newRow['Variant Taxable'] || 'true';
        newRow['Gift Card'] = newRow['Gift Card'] || 'false';

        return newRow;
    });
};
