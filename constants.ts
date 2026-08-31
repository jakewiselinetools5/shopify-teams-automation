
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
