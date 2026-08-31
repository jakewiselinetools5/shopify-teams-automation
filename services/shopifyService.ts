import { ProductRow, ShopifyConfig, ShopifyPushResult } from '../types';

const STORAGE_KEY = 'shopify_config';

export const getStoredShopifyConfig = (): ShopifyConfig => {
  const defaultDomain = process.env.SHOPIFY_STORE_DOMAIN || 'wise-line-tools-one.myshopify.com';
  const defaultToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';
  const defaultVersion = '2025-01';

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed.accessToken || defaultToken;
      const domain = parsed.storeDomain || defaultDomain;
      const version = parsed.apiVersion || defaultVersion;
      return { storeDomain: domain, accessToken: token, apiVersion: version };
    }
  } catch (e) {
    console.error('Failed to parse stored Shopify config:', e);
  }

  return {
    storeDomain: defaultDomain,
    accessToken: defaultToken,
    apiVersion: defaultVersion
  };
};

export const saveShopifyConfig = (config: ShopifyConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Shopify config to localStorage:', e);
  }
};

export const executeShopifyGraphQL = async (
  query: string,
  variables: Record<string, any> = {},
  customConfig?: ShopifyConfig
): Promise<any> => {
  const config = customConfig || getStoredShopifyConfig();

  if (!config.storeDomain || !config.accessToken) {
    throw new Error('Shopify Store Domain and Admin Access Token must be configured in Shopify Settings.');
  }

  let cleanStore = config.storeDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!cleanStore.includes('.')) {
    cleanStore += '.myshopify.com';
  }

  let response: Response;
  try {
    response = await fetch('/api/shopify/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Store': cleanStore,
        'X-Shopify-Access-Token': config.accessToken.trim(),
        'X-Shopify-Api-Version': config.apiVersion || '2025-01'
      },
      body: JSON.stringify({ query, variables })
    });
  } catch (netErr: any) {
    throw new Error(`Unable to connect to Shopify proxy: ${netErr.message || 'Network request failed'}`);
  }

  let json: any = null;
  try {
    json = await response.json();
  } catch (parseErr) {
    throw new Error(`Shopify returned HTTP ${response.status} (${response.statusText})`);
  }

  if (json?.errors) {
    let msg = '';
    if (Array.isArray(json.errors)) {
      msg = json.errors.map((e: any) => typeof e === 'string' ? e : (e.message || JSON.stringify(e))).join(' | ');
    } else if (typeof json.errors === 'string') {
      msg = json.errors;
    } else if (typeof json.errors === 'object') {
      msg = json.errors.message || JSON.stringify(json.errors);
    } else {
      msg = String(json.errors);
    }
    throw new Error(`Shopify API Error: ${msg}`);
  }

  if (!response.ok) {
    throw new Error(`Shopify HTTP ${response.status} (${response.statusText}): ${JSON.stringify(json)}`);
  }

  return json?.data;
};

export const testShopifyConnection = async (
  customConfig?: ShopifyConfig
): Promise<{ success: boolean; shopName?: string; domain?: string; currency?: string; error?: string }> => {
  try {
    const query = `
      query TestShopifyConnection {
        shop {
          name
          myshopifyDomain
          currencyCode
        }
      }
    `;

    const data = await executeShopifyGraphQL(query, {}, customConfig);
    if (data?.shop) {
      return {
        success: true,
        shopName: data.shop.name,
        domain: data.shop.myshopifyDomain,
        currency: data.shop.currencyCode
      };
    }
    return { success: false, error: 'Shop data not returned.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Connection failed' };
  }
};

export const getSalesChannels = async (
  customConfig?: ShopifyConfig
): Promise<{ id: string; name: string }[]> => {
  try {
    const query = `
      query GetPublications {
        publications(first: 50) {
          nodes {
            id
            name
            autoPublish
            catalog {
              id
              title
            }
          }
        }
      }
    `;

    const data = await executeShopifyGraphQL(query, {}, customConfig);
    const nodes = Array.isArray(data?.publications?.nodes) ? data.publications.nodes : [];
    return nodes.map((node: any) => ({
      id: node.id,
      name: node.catalog?.title || node.name || 'Sales Channel'
    }));
  } catch (e: any) {
    console.warn('Could not fetch sales channels:', e?.message || e);
    return [];
  }
};

/**
 * Live Shopify SKU existence & duplicate checker
 */
export interface ExistingShopifyProduct {
  id: string;
  numericId: string;
  title: string;
  handle: string;
  status: string;
  adminUrl: string;
  featuredImage?: string;
  variantCount: number;
}

export const checkShopifyProductBySku = async (
  sku: string,
  customConfig?: ShopifyConfig
): Promise<{ exists: boolean; product?: ExistingShopifyProduct }> => {
  if (!sku || !sku.trim()) return { exists: false };

  const config = customConfig || getStoredShopifyConfig();
  if (!config.storeDomain || !config.accessToken) return { exists: false };

  try {
    const cleanSku = sku.trim();
    const query = `
      query CheckSku($query: String!) {
        products(first: 1, query: $query) {
          nodes {
            id
            title
            handle
            status
            featuredImage {
              url
            }
            variants(first: 10) {
              nodes {
                id
                sku
              }
            }
          }
        }
      }
    `;

    const data = await executeShopifyGraphQL(query, { query: `sku:${cleanSku}` }, config);
    const node = data?.products?.nodes?.[0];
    if (!node) return { exists: false };

    const numericId = String(node.id || '').replace('gid://shopify/Product/', '');
    let cleanStore = config.storeDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '').replace('.myshopify.com', '');
    const adminUrl = `https://admin.shopify.com/store/${cleanStore}/products/${numericId}`;

    return {
      exists: true,
      product: {
        id: node.id,
        numericId,
        title: node.title,
        handle: node.handle,
        status: node.status,
        adminUrl,
        featuredImage: node.featuredImage?.url,
        variantCount: node.variants?.nodes?.length || 1
      }
    };
  } catch (e) {
    console.warn('SKU lookup error:', e);
    return { exists: false };
  }
};

/**
 * Smart Collection Management
 */
export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  productsCount?: number;
}

export const getShopifyCollections = async (
  customConfig?: ShopifyConfig
): Promise<ShopifyCollection[]> => {
  try {
    const query = `
      query GetCollections {
        collections(first: 100) {
          nodes {
            id
            title
            handle
            productsCount {
              count
            }
          }
        }
      }
    `;

    const data = await executeShopifyGraphQL(query, {}, customConfig);
    const nodes = Array.isArray(data?.collections?.nodes) ? data.collections.nodes : [];
    return nodes.map((c: any) => ({
      id: c.id,
      title: c.title,
      handle: c.handle,
      productsCount: c.productsCount?.count || 0
    }));
  } catch (e: any) {
    console.warn('Could not fetch Shopify collections:', e?.message || e);
    return [];
  }
};

export const matchSmartCollections = (
  product: ProductRow,
  availableCollections: ShopifyCollection[]
): ShopifyCollection[] => {
  if (!availableCollections || availableCollections.length === 0) return [];

  const textToSearch = `${product['Title'] || ''} ${product['Vendor'] || ''} ${product['Type'] || ''} ${product['Product Category'] || ''} ${product['Tags'] || ''}`.toLowerCase();
  const matches: ShopifyCollection[] = [];

  for (const col of availableCollections) {
    const colTitle = col.title.toLowerCase();
    const colHandle = col.handle.toLowerCase();

    if (colHandle === 'frontpage') continue;

    // Direct brand match
    if (product['Vendor'] && colTitle === product['Vendor'].toLowerCase()) {
      matches.push(col);
      continue;
    }

    // Exact category / word match
    if (
      (colTitle.length >= 4 && textToSearch.includes(colTitle)) ||
      (colHandle.length >= 4 && textToSearch.includes(colHandle.replace(/-/g, ' '))) ||
      (colHandle === 'plumbing' && (textToSearch.includes('water pump') || textToSearch.includes('pipe') || textToSearch.includes('plumb') || textToSearch.includes('tubing'))) ||
      (colHandle === 'power-saws' && (textToSearch.includes('saw') || textToSearch.includes('miter') || textToSearch.includes('circular') || textToSearch.includes('table saw') || textToSearch.includes('band saw'))) ||
      (colHandle === 'drilling' && (textToSearch.includes('drill') || textToSearch.includes('hammer drill') || textToSearch.includes('auger') || textToSearch.includes('hole saw'))) ||
      (colHandle === 'fastening' && (textToSearch.includes('impact') || textToSearch.includes('wrench') || textToSearch.includes('fasten') || textToSearch.includes('driver'))) ||
      (colHandle === 'work-wear' && (textToSearch.includes('glove') || textToSearch.includes('glasses') || textToSearch.includes('vest') || textToSearch.includes('safety') || textToSearch.includes('eyewear') || textToSearch.includes('respirator'))) ||
      (colHandle === 'metal-working' && (textToSearch.includes('metal') || textToSearch.includes('clamp') || textToSearch.includes('grinder') || textToSearch.includes('cutting') || textToSearch.includes('weld'))) ||
      (colHandle === 'outdoor-tools' && (textToSearch.includes('outdoor') || textToSearch.includes('blower') || textToSearch.includes('trimmer') || textToSearch.includes('mower') || textToSearch.includes('chainsaw'))) ||
      (colHandle === 'batteries-and-chargers' && (textToSearch.includes('battery') || textToSearch.includes('charger') || textToSearch.includes('starter kit'))) ||
      (colHandle === 'storage' && (textToSearch.includes('packout') || textToSearch.includes('tstack') || textToSearch.includes('toughsystem') || textToSearch.includes('storage') || textToSearch.includes('tool box') || textToSearch.includes('bag')))
    ) {
      if (!matches.some(m => m.id === col.id)) {
        matches.push(col);
      }
    }
  }

  return matches;
};

export const addProductToCollections = async (
  productId: string,
  collectionIds: string[],
  customConfig?: ShopifyConfig
): Promise<void> => {
  if (!collectionIds || collectionIds.length === 0) return;

  const config = customConfig || getStoredShopifyConfig();

  for (const collectionId of collectionIds) {
    try {
      const mutation = `
        mutation AddProductToCollection($id: ID!, $productIds: [ID!]!) {
          collectionAddProducts(id: $id, productIds: $productIds) {
            collection {
              id
              title
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      await executeShopifyGraphQL(mutation, { id: collectionId, productIds: [productId] }, config);
    } catch (e) {
      console.warn(`Non-fatal: could not add product to collection ${collectionId}:`, e);
    }
  }
};

/**
 * Dynamically resolves Shopify Standard Taxonomy Category GID
 */
export const resolveShopifyCategoryGid = async (
  productType?: string,
  category?: string,
  title?: string,
  config?: ShopifyConfig
): Promise<string | null> => {
  const cfg = config || getStoredShopifyConfig();
  const searchTerms = [
    productType,
    category?.split('>').pop()?.trim(),
    title?.split('-').pop()?.trim(),
    'Tools',
    'Hardware'
  ].filter(Boolean) as string[];

  for (const term of searchTerms) {
    const query = `
      query SearchTaxonomy($search: String!) {
        taxonomy {
          categories(first: 3, search: $search) {
            edges {
              node {
                id
                fullName
              }
            }
          }
        }
      }
    `;
    try {
      const res = await executeShopifyGraphQL(query, { search: term }, cfg);
      const edges = res?.taxonomy?.categories?.edges;
      if (edges && edges.length > 0) {
        return edges[0].node.id;
      }
    } catch (e) {
      console.warn('Taxonomy category search notice:', e);
    }
  }
  return null;
};

export const pushProductToShopify = async (
  groupRows: ProductRow[],
  mode: 'DRAFT' | 'ACTIVE',
  customConfig?: ShopifyConfig,
  targetCollectionIds?: string[]
): Promise<ShopifyPushResult> => {
  if (!groupRows || groupRows.length === 0) {
    throw new Error('No product data rows provided for Shopify push.');
  }

  const config = customConfig || getStoredShopifyConfig();
  const primaryRow = groupRows[0];
  const handle = primaryRow['Handle'] || `${primaryRow['Vendor']}-${primaryRow['Variant SKU']}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  try {
    // 1. Gather all images across group
    const images: string[] = [];
    groupRows.forEach(r => {
      if (r['Image Src'] && !r['Image Src'].includes('placehold.co')) {
        const splitImages = String(r['Image Src']).split(/[|,\n;]/).map(s => s.trim()).filter(Boolean);
        images.push(...splitImages);
      }
      if (r['_Raw_Assets']) {
        const rawAssets = String(r['_Raw_Assets']).split(/[|,\n;]/).map(s => s.trim()).filter(Boolean);
        images.push(...rawAssets);
      }
    });

    const uniqueImages = Array.from(new Set(images))
      .filter(url => url.startsWith('http://') || url.startsWith('https://'))
      .map(url => url.replace('http://', 'https://'));

    const media = uniqueImages.slice(0, 15).map(imgUrl => ({
      originalSource: imgUrl,
      mediaContentType: 'IMAGE',
      alt: primaryRow['Title'] || 'Product Image'
    }));

    // 2. Format tags
    const rawTags = primaryRow['Tags'] ? String(primaryRow['Tags']).split(',').map(t => t.trim()).filter(Boolean) : [];

    // 3. Resolve Shopify Standard Taxonomy Category
    const categoryGid = await resolveShopifyCategoryGid(
      primaryRow['Type'],
      primaryRow['Product Category'],
      primaryRow['Title'],
      config
    );

    // 4. Format product fields
    const productInput: Record<string, any> = {
      title: primaryRow['Title'] || 'Untitled Product',
      descriptionHtml: primaryRow['Body (HTML)'] || '',
      vendor: primaryRow['Vendor'] || '',
      productType: primaryRow['Type'] || primaryRow['Product Category'] || '',
      tags: rawTags,
      status: mode === 'ACTIVE' ? 'ACTIVE' : 'DRAFT'
    };

    if (categoryGid) {
      productInput.category = categoryGid;
    }

    if (primaryRow['SEO Title'] || primaryRow['SEO Description']) {
      productInput.seo = {
        title: primaryRow['SEO Title'] || undefined,
        description: primaryRow['SEO Description'] || undefined
      };
    }

    let targetProduct: any = null;

    // CREATE New Product Mutation
    const createMutation = `
      mutation CreateShopifyProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
        productCreate(product: $product, media: $media) {
          product {
            id
            title
            handle
            status
            createdAt
            variants(first: 50) {
              nodes {
                id
                sku
                price
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const createVars: Record<string, any> = {
      product: {
        ...productInput,
        handle: handle
      }
    };

    if (media.length > 0) {
      createVars.media = media;
    }

    let createRes = await executeShopifyGraphQL(createMutation, createVars, config);
    let userErrors = createRes?.productCreate?.userErrors || [];

    // If handle collision, retry without explicit handle so Shopify auto-generates a unique handle
    if (Array.isArray(userErrors) && userErrors.some((e: any) => String(e?.message || '').toLowerCase().includes('handle') && String(e?.message || '').toLowerCase().includes('already in use'))) {
      delete createVars.product.handle;
      createRes = await executeShopifyGraphQL(createMutation, createVars, config);
      userErrors = createRes?.productCreate?.userErrors || [];
    }

    if (userErrors && Array.isArray(userErrors) && userErrors.length > 0) {
      const errorMsg = userErrors.map((e: any) => {
        const fieldStr = Array.isArray(e?.field) ? e.field.join('.') + ': ' : (e?.field ? String(e.field) + ': ' : '');
        return `${fieldStr}${e?.message || JSON.stringify(e)}`;
      }).join(', ');
      throw new Error(errorMsg);
    }

    targetProduct = createRes?.productCreate?.product;

    if (!targetProduct || !targetProduct.id) {
      throw new Error('Shopify product operation failed to return a product ID.');
    }

    const productId = targetProduct.id; // gid://shopify/Product/123456789
    const numericId = productId.replace('gid://shopify/Product/', '');

    let cleanStore = config.storeDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleanStore.includes('.')) {
      cleanStore += '.myshopify.com';
    }
    const adminUrl = `https://${cleanStore}/admin/products/${numericId}`;

    // 6. Update primary variant details via productVariantsBulkUpdate
    const firstVariantNode = targetProduct.variants?.nodes?.[0];
    if (firstVariantNode && firstVariantNode.id) {
      const variantPrice = primaryRow['Variant Price'] ? String(primaryRow['Variant Price']).replace(/[^0-9.]/g, '') : undefined;
      const comparePrice = primaryRow['Variant Compare At Price'] ? String(primaryRow['Variant Compare At Price']).replace(/[^0-9.]/g, '') : undefined;
      const rawBarcode = primaryRow['Variant Barcode'] ? String(primaryRow['Variant Barcode']).replace(/^'/, '').trim() : undefined;
      const grams = primaryRow['Variant Grams'] ? parseFloat(String(primaryRow['Variant Grams']).replace(/[^0-9.]/g, '')) : 0;
      const rawCountry = primaryRow['Variant Country of Origin'] ? String(primaryRow['Variant Country of Origin']).trim().toUpperCase() : '';
      const countryCode = rawCountry.length === 2 ? rawCountry : 'CA';
      const rawHs = primaryRow['Variant HS Code'] ? String(primaryRow['Variant HS Code']).replace(/[^0-9]/g, '').substring(0, 6) : undefined;
      const costPrice = primaryRow['Cost per item'] ? String(primaryRow['Cost per item']).replace(/[^0-9.]/g, '') : undefined;

      const bulkUpdateMutation = `
        mutation UpdateDefaultVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              sku
              price
              compareAtPrice
              barcode
              inventoryPolicy
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variantInput: Record<string, any> = {
        id: firstVariantNode.id,
        price: variantPrice && parseFloat(variantPrice) > 0 ? variantPrice : '0.00',
        inventoryPolicy: 'CONTINUE',
        inventoryItem: {
          sku: String(primaryRow['Variant SKU'] || '').trim(),
          tracked: true
        }
      };

      if (comparePrice && parseFloat(comparePrice) > 0) {
        variantInput.compareAtPrice = comparePrice;
      }
      if (rawBarcode && rawBarcode.length >= 6) {
        variantInput.barcode = rawBarcode;
      }
      if (costPrice && parseFloat(costPrice) > 0) {
        variantInput.inventoryItem.cost = costPrice;
      }
      if (countryCode) {
        variantInput.inventoryItem.countryCodeOfOrigin = countryCode;
      }
      if (rawHs) {
        variantInput.inventoryItem.harmonizedSystemCode = rawHs;
      }
      if (grams > 0) {
        variantInput.inventoryItem.measurement = {
          weight: {
            unit: 'GRAMS',
            value: grams
          }
        };
      }

      try {
        const bulkRes = await executeShopifyGraphQL(bulkUpdateMutation, {
          productId: targetProduct.id,
          variants: [variantInput]
        }, config);
        const bulkErrors = bulkRes?.productVariantsBulkUpdate?.userErrors || [];
        if (bulkErrors.length > 0) {
          console.warn('Variant bulk update warning:', bulkErrors);
        }
      } catch (vErr) {
        console.warn('Non-fatal variant update warning:', vErr);
      }
    }

    // 7. If mode is ACTIVE, publish across all available sales channels
    let publishedChannelsCount = 0;
    if (mode === 'ACTIVE') {
      try {
        const channels = await getSalesChannels(config);
        if (channels.length > 0) {
          const publishMutation = `
            mutation PublishProduct($id: ID!, $input: [PublicationInput!]!) {
              publishablePublish(id: $id, input: $input) {
                publishable {
                  availablePublicationsCount {
                    count
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;

          const publishInput = channels.map(c => ({
            publicationId: c.id
          }));

          const pubRes = await executeShopifyGraphQL(publishMutation, { id: productId, input: publishInput }, config);
          publishedChannelsCount = pubRes?.publishablePublish?.publishable?.availablePublicationsCount?.count || channels.length;
        }
      } catch (pubErr) {
        console.warn('Publishing to sales channels had a non-fatal warning:', pubErr);
      }
    }

    // 9. Auto-assign to Target / Smart Collections
    if (targetCollectionIds && targetCollectionIds.length > 0) {
      try {
        await addProductToCollections(productId, targetCollectionIds, config);
      } catch (colErr) {
        console.warn('Adding product to collections had a non-fatal warning:', colErr);
      }
    }

    return {
      handle,
      status: mode === 'ACTIVE' ? 'published' : 'draft',
      productId,
      numericId,
      adminUrl,
      publishedChannelsCount,
      updatedAt: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      handle,
      status: 'error',
      error: error.message || 'Failed to push product to Shopify',
      updatedAt: new Date().toISOString()
    };
  }
};
