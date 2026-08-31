
export type ProductRow = Record<string, any>;

export type Mapping = Record<string, string>;

export interface ProcessedData {
  headers: string[];
  data: ProductRow[];
  log: string[];
}

export interface SheetData {
  name: string;
  data: ProductRow[];
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  MAPPING = 'MAPPING',
  PREVIEW = 'PREVIEW',
}

export interface ShopifyConfig {
  storeDomain: string;
  accessToken: string;
  apiVersion?: string;
}

export type ShopifyPushStatus = 'idle' | 'pushing' | 'draft' | 'published' | 'error';

export interface ShopifyPushResult {
  handle: string;
  status: ShopifyPushStatus;
  productId?: string;
  numericId?: string;
  adminUrl?: string;
  error?: string;
  publishedChannelsCount?: number;
  updatedAt?: string;
}

export const SHOPIFY_FIELDS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Product Category',
  'Type',
  'Tags',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Variant SKU',
  'Variant Grams',
  'Variant Inventory Tracker',
  'Variant Inventory Qty',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Variant Barcode',
  'Variant Weight Unit',
  'Variant HS Code',
  'Variant Country of Origin',
  'Image Src',
  'Image Position',
  'Image Alt Text',
  'Gift Card',
  'SEO Title',
  'SEO Description',
  'Google Product Category',
  'Status'
];
