import React, { useState, useEffect } from 'react';
import { ProductRow, ShopifyConfig, ShopifyPushResult } from '../types';
import { downloadCSV, generatePromoImage, cleanImageUrl, getCanonicalAssetKey } from '../services/excelService';
import {
  getStoredShopifyConfig,
  pushProductToShopify,
  testShopifyConnection,
  checkShopifyProductBySku,
  getShopifyCollections,
  matchSmartCollections,
  ShopifyCollection,
  ExistingShopifyProduct
} from '../services/shopifyService';
import { ShopifySettingsModal } from './ShopifySettingsModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Search, Download, ExternalLink, Image as ImageIcon, FileText, CheckCircle2, Copy, Store, UploadCloud, Settings2, AlertCircle, RefreshCw, Layers, Trash2, Plus, X, Tag, Check, FolderPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PreviewStepProps {
  data: ProductRow[];
  onDataUpdate: (newData: ProductRow[]) => void;
  onReset: () => void;
}

export const PreviewStep: React.FC<PreviewStepProps> = ({ data, onDataUpdate, onReset }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'stats'>('preview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [promoImages, setPromoImages] = useState<Record<string, string>>({});
  const [isGeneratingPromo, setIsGeneratingPromo] = useState(false);

  // Shopify Integration States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [shopifyConfig, setShopifyConfig] = useState<ShopifyConfig>(getStoredShopifyConfig());
  const [connectionStatus, setConnectionStatus] = useState<{ isConnected: boolean; shopName?: string }>({ isConnected: false });
  const [pushResults, setPushResults] = useState<Record<string, ShopifyPushResult>>({});
  const [isPushingCurrent, setIsPushingCurrent] = useState(false);
  const [isPushingBatch, setIsPushingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  // Collections & Duplicate Checking States
  const [storeCollections, setStoreCollections] = useState<ShopifyCollection[]>([]);
  const [selectedCollectionsByHandle, setSelectedCollectionsByHandle] = useState<Record<string, string[]>>({});
  const [skuShopifyStatus, setSkuShopifyStatus] = useState<Record<string, ExistingShopifyProduct | null>>({});
  const [isCheckingSkus, setIsCheckingSkus] = useState(false);

  useEffect(() => {
    const initShopifyData = async () => {
      const conf = getStoredShopifyConfig();
      setShopifyConfig(conf);
      if (conf.storeDomain && conf.accessToken) {
        const res = await testShopifyConnection(conf);
        if (res.success) {
          setConnectionStatus({ isConnected: true, shopName: res.shopName });
          // Fetch store collections
          try {
            const cols = await getShopifyCollections(conf);
            setStoreCollections(cols);

            // Auto-match smart collections for each unique product
            const initialMap: Record<string, string[]> = {};
            const handles = Array.from(new Set(data.map(r => r['Handle']).filter(Boolean)));
            handles.forEach(h => {
              const primaryRow = data.find(r => r['Handle'] === h);
              if (primaryRow) {
                const matched = matchSmartCollections(primaryRow, cols);
                initialMap[h] = matched.map(m => m.id);
              }
            });
            setSelectedCollectionsByHandle(prev => ({ ...initialMap, ...prev }));
          } catch (e) {
            console.warn('Error loading collections:', e);
          }
        } else {
          setConnectionStatus({ isConnected: false });
        }
      } else {
        setConnectionStatus({ isConnected: false });
      }
    };
    initShopifyData();
  }, [data.length]);

  // Live SKU duplicate check across current catalog
  useEffect(() => {
    const checkSkus = async () => {
      const conf = getStoredShopifyConfig();
      if (!conf.storeDomain || !conf.accessToken) return;

      const uniqueSkus = Array.from(new Set(data.map(r => r['Variant SKU']).filter(Boolean))) as string[];
      if (uniqueSkus.length === 0) return;

      setIsCheckingSkus(true);
      const resultsMap: Record<string, ExistingShopifyProduct | null> = {};

      for (const s of uniqueSkus) {
        try {
          const res = await checkShopifyProductBySku(s, conf);
          resultsMap[s] = res.exists && res.product ? res.product : null;
        } catch (e) {
          resultsMap[s] = null;
        }
      }

      setSkuShopifyStatus(prev => ({ ...prev, ...resultsMap }));
      setIsCheckingSkus(false);
    };

    checkSkus();
  }, [data.length]);

  const uniqueHandles = Array.from(new Set(data.map(r => r['Handle'])));
  const totalProductsCount = uniqueHandles.length;
  const withImagesCount = uniqueHandles.filter(h => data.some(r => r['Handle'] === h && r['Image Src'])).length;

  const chartData = [
    { name: 'Total SKUs', value: totalProductsCount },
    { name: 'With Assets', value: withImagesCount },
  ];

  const handleDownload = () => {
    downloadCSV(data);
  };

  const handleGeneratePromo = async () => {
    const selectedProduct = filteredData[selectedRowIndex];
    if (!selectedProduct) return;
    
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      alert("API Key is missing.");
      return;
    }

    setIsGeneratingPromo(true);
    try {
      const imageUrl = await generatePromoImage(selectedProduct, apiKey);
      setPromoImages(prev => ({
        ...prev,
        [selectedProduct['Variant SKU'] as string]: imageUrl
      }));
    } catch (error: any) {
      alert(`Failed to generate promo image: ${error.message}`);
    } finally {
      setIsGeneratingPromo(false);
    }
  };

  const getProxiedUrl = (url: string) => {
    if (!url || url.includes('placehold.co') || url.startsWith('data:image')) return url;
    return `/api/media/proxy?url=${encodeURIComponent(url)}`;
  };

  // Filter out the image-only rows for the list view
  const mainProductRows = data.filter(row => row['Title'] && row['Handle']);
  
  const filteredData = mainProductRows.filter(row => 
    Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedProduct = filteredData[selectedRowIndex];
  const selectedHandle = selectedProduct?.['Handle'] || '';
  
  // Find all assets for the currently selected product
  const productAssets: string[] = [];
  data.filter(r => r['Handle'] === selectedHandle && r['Image Src']).forEach(r => {
    const splitImages = String(r['Image Src']).split(/[|,\n;]/).map(s => s.trim()).filter(Boolean);
    productAssets.push(...splitImages);
  });
  
  const uniqueProductAssets: string[] = [];
  const seenAssetKeys = new Set<string>();
  productAssets.forEach(img => {
    const cleaned = cleanImageUrl(img);
    if (!cleaned) return;
    const assetKey = getCanonicalAssetKey(cleaned);
    if (!seenAssetKeys.has(assetKey)) {
      seenAssetKeys.add(assetKey);
      uniqueProductAssets.push(cleaned);
    }
  });

  const rawRecoveryLinks = selectedProduct?.['_Raw_Assets'] ? selectedProduct['_Raw_Assets'].split(' | ') : [];
  const officialLink = selectedProduct?.['_Product_Page'];
  const competitorLinks = selectedProduct?.['_Competitor_Links'] ? selectedProduct['_Competitor_Links'].split(' | ') : [];

  const currentPushResult = selectedHandle ? pushResults[selectedHandle] : undefined;

  const [newImageUrl, setNewImageUrl] = useState('');
  const [showAddImage, setShowAddImage] = useState(false);

  const handleRemoveImage = (imageToRemove: string) => {
    if (!selectedHandle) return;
    const updatedData = data.map(r => {
      if (r['Handle'] === selectedHandle) {
        const currentImages = String(r['Image Src'] || '').split(/[|,\n;]/).map(s => s.trim()).filter(Boolean);
        const filtered = currentImages.filter(img => img !== imageToRemove);
        const rawAssets = String(r['_Raw_Assets'] || '').split(/[|,\n;]/).map(s => s.trim()).filter(Boolean);
        const filteredRaw = rawAssets.filter(img => img !== imageToRemove);

        return {
          ...r,
          'Image Src': filtered.join(' | '),
          '_Raw_Assets': filteredRaw.join(' | ')
        };
      }
      return r;
    });
    onDataUpdate(updatedData);
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim() || !selectedHandle) return;
    const clean = newImageUrl.trim();
    const updatedData = data.map(r => {
      if (r['Handle'] === selectedHandle) {
        const currentImages = String(r['Image Src'] || '').split(/[|,\n;]/).map(s => s.trim()).filter(Boolean);
        if (!currentImages.includes(clean)) {
          currentImages.push(clean);
        }
        return {
          ...r,
          'Image Src': currentImages.join(' | ')
        };
      }
      return r;
    });
    onDataUpdate(updatedData);
    setNewImageUrl('');
    setShowAddImage(false);
  };

  const toggleCollection = (targetHandle: string, colId: string) => {
    setSelectedCollectionsByHandle(prev => {
      const current = prev[targetHandle] || [];
      const updated = current.includes(colId)
        ? current.filter(id => id !== colId)
        : [...current, colId];
      return { ...prev, [targetHandle]: updated };
    });
  };

  // Single Product Push Handler
  const handlePushSingle = async (mode: 'DRAFT' | 'ACTIVE') => {
    if (!shopifyConfig.storeDomain || !shopifyConfig.accessToken) {
      setIsSettingsOpen(true);
      return;
    }

    if (!selectedHandle) return;
    const groupRows = data.filter(r => r['Handle'] === selectedHandle);
    if (groupRows.length === 0) return;

    setIsPushingCurrent(true);
    setPushResults(prev => ({
      ...prev,
      [selectedHandle]: { handle: selectedHandle, status: 'pushing' }
    }));

    try {
      const targetCols = selectedCollectionsByHandle[selectedHandle] || [];
      const result = await pushProductToShopify(groupRows, mode, shopifyConfig, targetCols);
      
      setPushResults(prev => ({
        ...prev,
        [selectedHandle]: result,
        ...(result.handle ? { [result.handle]: result } : {})
      }));

      if (result.status === 'published' || result.status === 'draft') {
        const sku = groupRows[0]['Variant SKU'];
        if (sku) {
          setSkuShopifyStatus(prev => ({
            ...prev,
            [sku]: {
              id: result.productId || '',
              numericId: result.numericId || '',
              title: groupRows[0]['Title'] || '',
              handle: result.handle,
              status: result.status === 'published' ? 'ACTIVE' : 'DRAFT',
              adminUrl: result.adminUrl || '',
              variantCount: 1
            }
          }));
        }
      }
    } catch (err: any) {
      setPushResults(prev => ({
        ...prev,
        [selectedHandle]: { handle: selectedHandle, status: 'error', error: err.message }
      }));
    } finally {
      setIsPushingCurrent(false);
    }
  };

  // Batch Push Handler
  const handlePushBatch = async (mode: 'DRAFT' | 'ACTIVE') => {
    if (!shopifyConfig.storeDomain || !shopifyConfig.accessToken) {
      setIsSettingsOpen(true);
      return;
    }

    const handles = Array.from(new Set(filteredData.map(r => r['Handle']).filter(Boolean)));
    if (handles.length === 0) return;

    const confirmMsg = mode === 'ACTIVE'
      ? `Publish ${handles.length} products LIVE to all sales channels in Shopify?`
      : `Push ${handles.length} products as DRAFTS to Shopify?`;

    if (!window.confirm(confirmMsg)) return;

    setIsPushingBatch(true);

    for (let i = 0; i < handles.length; i++) {
      const h = handles[i];
      const groupRows = data.filter(r => r['Handle'] === h);
      if (groupRows.length === 0) continue;

      setBatchProgress({
        current: i + 1,
        total: handles.length,
        message: `${mode === 'ACTIVE' ? 'Publishing' : 'Pushing'} (${i + 1}/${handles.length}): ${groupRows[0]['Title'] || h}...`
      });

      setPushResults(prev => ({
        ...prev,
        [h]: { handle: h, status: 'pushing' }
      }));

      try {
        const targetCols = selectedCollectionsByHandle[h] || [];
        const res = await pushProductToShopify(groupRows, mode, shopifyConfig, targetCols);
        
        setPushResults(prev => ({
          ...prev,
          [h]: res,
          ...(res.handle ? { [res.handle]: res } : {})
        }));

        if (res.status === 'published' || res.status === 'draft') {
          const sku = groupRows[0]['Variant SKU'];
          if (sku) {
            setSkuShopifyStatus(prev => ({
              ...prev,
              [sku]: {
                id: res.productId || '',
                numericId: res.numericId || '',
                title: groupRows[0]['Title'] || '',
                handle: res.handle,
                status: res.status === 'published' ? 'ACTIVE' : 'DRAFT',
                adminUrl: res.adminUrl || '',
                variantCount: 1
              }
            }));
          }
        }
      } catch (err: any) {
        setPushResults(prev => ({
          ...prev,
          [h]: { handle: h, status: 'error', error: err.message }
        }));
      }

      if (i < handles.length - 1) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    setIsPushingBatch(false);
    setBatchProgress(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white flex flex-col h-full overflow-hidden relative font-sans"
    >
      {/* HEADER BAR */}
      <div className="px-8 py-5 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center bg-white z-20 gap-4 flex-none">
        <div className="flex items-center space-x-6 w-full xl:w-auto">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Catalog Explorer</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 italic">Industrial Premium Synthesis • Shopify Direct</p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl relative">
            <motion.div 
              className="absolute inset-y-1 bg-white rounded-lg shadow-sm ring-1 ring-slate-900/5"
              layoutId="previewTab"
              initial={false}
              animate={{
                left: activeTab === 'preview' ? '4px' : 'calc(50% + 2px)',
                width: 'calc(50% - 6px)'
              }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
            <button onClick={() => setActiveTab('preview')} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-colors relative z-10 ${activeTab === 'preview' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>GRID</button>
            <button onClick={() => setActiveTab('stats')} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-colors relative z-10 ${activeTab === 'stats' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>STATS</button>
          </div>

          {/* Shopify Connection Pill */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
              connectionStatus.isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>{connectionStatus.isConnected ? `Connected: ${connectionStatus.shopName || 'Shopify'}` : 'Configure Shopify API'}</span>
            <Settings2 className="w-3 h-3 ml-1 opacity-60" />
          </button>
        </div>
        
        <div className="flex items-center space-x-3 w-full xl:w-auto flex-wrap gap-y-2">
          <div className="relative flex-1 xl:w-64 min-w-[200px]">
            <input 
              type="text" 
              placeholder="Search SKUs, Brands, Titles..." 
              className="w-full p-2.5 pl-9 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold bg-slate-50"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          </div>

          {/* Batch Shopify Push Buttons */}
          <button
            onClick={() => handlePushBatch('DRAFT')}
            disabled={isPushingBatch}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5"
            title="Push all items in the current view to Shopify as Drafts"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Push All Draft</span>
          </button>

          <button
            onClick={() => handlePushBatch('ACTIVE')}
            disabled={isPushingBatch}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 flex items-center gap-1.5"
            title="Publish all items in the current view LIVE across all sales channels"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Publish All Live</span>
          </button>

          <button 
            onClick={handleDownload} 
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Batch Push Progress Bar */}
      {batchProgress && (
        <div className="bg-slate-900 text-white px-8 py-3 flex items-center justify-between z-30 shadow-inner">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
            <span className="text-xs font-bold text-slate-200">{batchProgress.message}</span>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400">
            {batchProgress.current} / {batchProgress.total}
          </span>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-hidden flex bg-slate-50">
        <AnimatePresence mode="wait">
        {activeTab === 'stats' ? (
          <motion.div 
            key="stats"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 p-12 overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto bg-white p-12 rounded-[2rem] shadow-sm border border-slate-100 h-[500px]">
              <h3 className="text-sm font-black mb-10 text-slate-900 uppercase tracking-[0.2em]">Asset Readiness Audit</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="value" barSize={60} radius={[10, 10, 10, 10]}>
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#3b82f6'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex overflow-hidden"
          >
            {/* Catalog Grid Table */}
            <div className="flex-1 overflow-auto bg-white">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">ASSET</th>
                    <th className="px-6 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">PRODUCT IDENTITY</th>
                    <th className="px-6 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">SKU</th>
                    <th className="px-6 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">MSRP (CAD)</th>
                    <th className="px-6 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">SHOPIFY STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredData.map((row, idx) => {
                    const firstImage = row['Image Src'] ? String(row['Image Src']).split(/[|,\n;]/)[0].trim() : '';
                    const handle = row['Handle'] || '';
                    const result = pushResults[handle];

                    return (
                      <tr 
                        key={idx} 
                        className={`group hover:bg-slate-50/70 cursor-pointer transition-all ${selectedRowIndex === idx ? 'bg-emerald-50/30' : ''}`} 
                        onClick={() => setSelectedRowIndex(idx)}
                      >
                        <td className="px-6 py-3.5">
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 p-1 flex items-center justify-center overflow-hidden shadow-sm">
                            {firstImage ? (
                              <img 
                                src={getProxiedUrl(firstImage)} 
                                className="max-w-full max-h-full object-contain" 
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://placehold.co/400x400/f8fafc/94a3b8?text=Image+Unavailable';
                                }}
                              />
                            ) : (
                              <div className="text-[7px] font-black text-slate-300 uppercase text-center leading-none">Missing Asset</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="text-xs font-black text-slate-900 leading-tight">{row['Title'] || 'Untitled Product'}</div>
                          <div className="flex items-center space-x-2 mt-1">
                            <div className="text-[9px] font-bold text-slate-400 uppercase">{row['Vendor']}</div>
                            <span className="text-slate-200">•</span>
                            <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">{row['Variant Country of Origin'] || 'INTL'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="text-[10px] font-black text-slate-700 font-mono">{row['Variant SKU']}</div>
                          {(() => {
                            const existing = skuShopifyStatus[row['Variant SKU']];
                            if (existing) {
                              return (
                                <a
                                  href={existing.adminUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="inline-flex items-center space-x-1 mt-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[8px] font-bold transition-all shadow-xs"
                                  title={`Existing in Shopify: ${existing.title}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>In Store ({existing.status})</span>
                                  <ExternalLink className="w-2 h-2 ml-0.5 opacity-60" />
                                </a>
                              );
                            }
                            return (
                              <span className="inline-block mt-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                New SKU
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-3.5 text-xs font-black text-emerald-700 font-mono">${row['Variant Price'] || '--'}</td>
                        <td className="px-6 py-3.5">
                          {result?.status === 'pushing' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[9px] font-bold">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Pushing...</span>
                            </span>
                          )}
                          {result?.status === 'draft' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[9px] font-bold font-mono">
                              <CheckCircle2 className="w-3 h-3 text-amber-500" />
                              <span>Draft #{result.numericId?.slice(-4)}</span>
                            </span>
                          )}
                          {result?.status === 'published' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[9px] font-bold font-mono">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>Live #{result.numericId?.slice(-4)}</span>
                            </span>
                          )}
                          {result?.status === 'error' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[9px] font-bold" title={result.error}>
                              <AlertCircle className="w-3 h-3 text-rose-500" />
                              <span>Error</span>
                            </span>
                          )}
                          {!result && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold uppercase tracking-wider">
                              Local Draft
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* DETAIL & SHOPIFY ACTION PANEL */}
            <div className="w-[520px] bg-white border-l border-slate-200 overflow-y-auto p-8 flex flex-col space-y-6 shadow-2xl z-10">
              
              {/* SHOPIFY DIRECT ACTION CARD */}
              {selectedProduct && (
                <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl text-white shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Store className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Shopify Publish Action</span>
                    </div>
                    {currentPushResult?.status === 'draft' && (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[9px] font-bold">
                        Draft in Shopify
                      </span>
                    )}
                    {currentPushResult?.status === 'published' && (
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[9px] font-bold">
                        Published (All Channels)
                      </span>
                    )}
                  </div>

                  {/* Existing Shopify In-Store Notice */}
                  {(() => {
                    const existingInStore = skuShopifyStatus[selectedProduct['Variant SKU']];
                    if (existingInStore) {
                      return (
                        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px] font-black uppercase tracking-wider">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Live in Wise Line Store ({existingInStore.status})</span>
                            </div>
                            <div className="text-[11px] text-slate-300 font-medium mt-0.5 line-clamp-1">
                              {existingInStore.title}
                            </div>
                          </div>
                          <a
                            href={existingInStore.adminUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/50 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 flex-shrink-0 ml-2"
                          >
                            <span>Open Admin</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handlePushSingle('DRAFT')}
                      disabled={isPushingCurrent || isPushingBatch}
                      className="py-3 px-4 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>{isPushingCurrent ? 'Pushing...' : 'Push as Draft'}</span>
                    </button>

                    <button
                      onClick={() => handlePushSingle('ACTIVE')}
                      disabled={isPushingCurrent || isPushingBatch}
                      className="py-3 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isPushingCurrent ? 'Publishing...' : 'Publish Live'}</span>
                    </button>
                  </div>

                  {currentPushResult?.adminUrl && (
                    <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">Product ID: {currentPushResult.numericId}</span>
                      <a
                        href={currentPushResult.adminUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <span>Open in Shopify Admin</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  {currentPushResult?.status === 'error' && (
                    <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-200 text-xs flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      <span className="text-[11px] leading-tight font-mono">{currentPushResult.error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* SMART STORE COLLECTIONS MODULE */}
              {selectedProduct && (
                <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FolderPlus className="w-4 h-4 text-emerald-600" />
                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-wider">
                        Smart Store Collections
                      </label>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      {(selectedCollectionsByHandle[selectedHandle] || []).length} Assigned
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Auto-matched to your Wise Line Tools store categories. Click to toggle collections before publishing.
                  </p>

                  {/* Matched Collections Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {storeCollections.map(col => {
                      const currentSelected = selectedCollectionsByHandle[selectedHandle] || [];
                      const isAssigned = currentSelected.includes(col.id);

                      // Only show auto-matched or assigned chips directly for clean layout
                      const isAutoMatched = matchSmartCollections(selectedProduct, [col]).length > 0;
                      if (!isAssigned && !isAutoMatched && storeCollections.length > 8) return null;

                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => toggleCollection(selectedHandle, col.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                            isAssigned
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm shadow-slate-900/20'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          {isAssigned ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Plus className="w-3 h-3 text-slate-400" />
                          )}
                          <span>{col.title}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Full Store Collection Dropdown Picker */}
                  {storeCollections.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 flex items-center space-x-2">
                      <select
                        className="flex-1 text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500"
                        onChange={(e) => {
                          if (e.target.value) {
                            toggleCollection(selectedHandle, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>+ Add Another Store Collection...</option>
                        {storeCollections.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.productsCount || 0} items)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {selectedProduct ? (
                <motion.div 
                  key={selectedProduct['Variant SKU'] as string}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Visual Assets & Fallback Links */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Clean Gallery Assets ({uniqueProductAssets.length})</label>
                      <button
                        onClick={() => setShowAddImage(!showAddImage)}
                        className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add URL</span>
                      </button>
                    </div>

                    {showAddImage && (
                      <div className="flex items-center space-x-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                        <input
                          type="text"
                          placeholder="Paste image URL (https://...)"
                          value={newImageUrl}
                          onChange={e => setNewImageUrl(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddImage(); }}
                          className="flex-1 text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          onClick={handleAddImage}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setShowAddImage(false); setNewImageUrl(''); }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-2">
                      {uniqueProductAssets.map((asset, i) => (
                        <div key={i} className="aspect-square bg-slate-50 rounded-xl border border-slate-100 p-1.5 flex items-center justify-center relative group overflow-hidden shadow-sm">
                          <img 
                            src={getProxiedUrl(asset)} 
                            className="max-w-full max-h-full object-contain"
                            referrerPolicy="no-referrer"
                            onError={() => {
                              handleRemoveImage(asset);
                            }} 
                          />
                          <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1.5">
                            <button 
                              onClick={() => window.open(asset, '_blank', 'noreferrer')} 
                              title="Open Full Image"
                              className="p-1.5 bg-white/90 hover:bg-white rounded-md text-slate-900 transition-transform active:scale-95 shadow"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleRemoveImage(asset)} 
                              title="Remove Image"
                              className="p-1.5 bg-rose-500/90 hover:bg-rose-600 rounded-md text-white transition-transform active:scale-95 shadow"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* PROMO IMAGE GENERATOR */}
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <ImageIcon className="w-3 h-3 text-slate-400" />
                          AI Promo Generator
                        </label>
                        <button 
                          onClick={handleGeneratePromo}
                          disabled={isGeneratingPromo}
                          className="text-[8px] font-bold text-white uppercase tracking-widest flex items-center bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
                        >
                          {isGeneratingPromo ? 'Generating...' : 'Generate Promo'}
                        </button>
                      </div>
                      {promoImages[selectedProduct['Variant SKU'] as string] && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-2 rounded-xl overflow-hidden border border-slate-200"
                        >
                          <img src={promoImages[selectedProduct['Variant SKU'] as string]} alt="Promo" className="w-full h-auto" />
                        </motion.div>
                      )}
                    </div>

                    {/* MANUAL SOURCE LINKS */}
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-slate-400" />
                          Manual Verification
                        </label>
                        <a 
                          href={`https://www.google.com/search?q=${encodeURIComponent(selectedProduct['Vendor'] + ' ' + selectedProduct['Variant SKU'])}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[8px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
                        >
                          Google Search
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      
                      {officialLink ? (
                        <a href={officialLink} target="_blank" rel="noreferrer" className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg hover:border-emerald-500 hover:shadow-md transition-all group">
                          <span className="text-[10px] font-bold text-slate-700 group-hover:text-emerald-700 truncate max-w-[200px]">Official Page Match</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500" />
                        </a>
                      ) : (
                        <div className="text-[9px] text-slate-400 italic px-2">Official source not identified.</div>
                      )}

                      {competitorLinks.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[8px] font-bold text-slate-400 uppercase block mt-2">Competitor Matches</span>
                          {competitorLinks.map((link, i) => (
                            <a key={i} href={link} target="_blank" rel="noreferrer" className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg hover:border-blue-400 transition-all group">
                              <span className="text-[9px] font-medium text-slate-600 truncate max-w-[200px]">{new URL(link).hostname.replace('www.', '')}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-slate-300 group-hover:text-blue-500" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Logistics & Industrial Matrix */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-5 rounded-3xl border border-slate-100 border-t-4 border-t-slate-900 shadow-sm">
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">UPC / Barcode</label>
                      <div className="text-[11px] font-black text-slate-900 mt-1 font-mono">{selectedProduct['Variant Barcode'] || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Weight (Grams)</label>
                      <div className="text-[11px] font-black text-slate-900 mt-1 font-mono">{selectedProduct['Variant Grams'] ? `${selectedProduct['Variant Grams']} g` : 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">HS Tariff Code</label>
                      <div className="text-[11px] font-black text-slate-900 mt-1 font-mono">{selectedProduct['Variant HS Code'] || 'PENDING'}</div>
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Origin Country</label>
                      <div className="text-[11px] font-black text-slate-900 mt-1">{selectedProduct['Variant Country of Origin'] || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Included in Box */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">In The Box Components</label>
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                      <div className="text-[10px] font-bold text-emerald-900 leading-relaxed italic">
                        {selectedProduct['Included In Box'] || 'Standard Retail Packaging'}
                      </div>
                    </div>
                  </div>

                  {/* SEO Strategy */}
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Marketplace Strategy</label>
                    <div className="space-y-2.5">
                      <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <div className="text-[8px] font-black text-emerald-600 uppercase mb-1">Google Optimized Title</div>
                        <div className="text-[11px] font-black text-slate-900 mt-0.5 leading-tight">{selectedProduct['SEO Title'] || selectedProduct['Title']}</div>
                      </div>
                      <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <div className="text-[8px] font-black text-emerald-600 uppercase mb-1">SEO Description Snippet</div>
                        <div className="text-[10px] font-medium text-slate-600 mt-0.5 leading-relaxed">{selectedProduct['SEO Description'] || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Description Viewer */}
                  <div className="space-y-3 pb-8">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Synthesized Product Copy</label>
                    <div className="bg-white border-2 border-slate-100 p-6 rounded-[2rem] shadow-xl min-h-[300px] overflow-auto">
                      <div 
                        className="description-viewer prose prose-slate prose-sm max-w-none text-[12px] leading-relaxed text-slate-800" 
                        dangerouslySetInnerHTML={{ __html: selectedProduct['Body (HTML)'] || 'Research phase incomplete.' }} 
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-30">
                  <FileText className="w-16 h-16 text-slate-400" />
                  <div className="text-[10px] font-black uppercase tracking-widest text-center">Select SKU For <br/> Premium Industrial Audit</div>
                </div>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Shopify Settings Modal */}
      <ShopifySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigSaved={(conf) => {
          setShopifyConfig(conf);
          testShopifyConnection(conf).then(res => {
            setConnectionStatus({ isConnected: res.success, shopName: res.shopName });
          });
        }}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
        
        .description-viewer h3 { font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.15em; font-size: 0.8rem; margin-top: 2rem; border-bottom: 3px solid #10b981; padding-bottom: 6px; margin-bottom: 12px; display: inline-block; }
        .description-viewer p { margin-bottom: 14px; font-weight: 500; }
        .description-viewer ul { list-style: none; padding-left: 0; margin-bottom: 1.5rem; }
        .description-viewer li { margin-bottom: 6px; padding-left: 20px; position: relative; font-weight: 600; }
        .description-viewer li:before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: 900; }
        .description-viewer table { width: 100%; font-size: 10px; border-collapse: collapse; margin: 1.5rem 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f8fafc; }
        .description-viewer th { text-align: left; padding: 10px 12px; background: #e2e8f0; text-transform: uppercase; font-size: 8px; font-weight: 900; color: #475569; }
        .description-viewer td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #334155; }
        .description-viewer tr:last-child td { border-bottom: none; }
        .cursor-copy:active { color: #fff; }
      `}</style>
    </motion.div>
  );
};
