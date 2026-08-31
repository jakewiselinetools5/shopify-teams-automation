
import React, { useState, useEffect } from 'react';
import { Mapping, SHOPIFY_FIELDS, ProductRow } from '../types';
import { SUGGESTED_MAPPINGS } from '../constants';
import { Check, ChevronDown, FileText, ArrowRight, Database, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MappingStepProps {
  sourceHeaders: string[];
  sourceData: ProductRow[];
  onConfirm: (mapping: Mapping) => void;
  logs: string[];
  onBack: () => void;
}

export const MappingStep: React.FC<MappingStepProps> = ({ sourceHeaders, sourceData, onConfirm, logs, onBack }) => {
  const [mapping, setMapping] = useState<Mapping>({});

  // Smart Auto-map on mount
  useEffect(() => {
    const newMapping: Mapping = {};
    
    // Explicit exclusions to prevent bad matches (e.g., 'Brand Name' mapping to 'Title')
    const EXCLUSIONS: Record<string, string[]> = {
        'Title': ['brand name', 'vendor name', 'file name', 'image name', 'campaign name', 'project name', 'sheet name'],
        // Prevent 'MFG Part Number' mapping to Vendor - ADDED 'mfg part' explicitly
        'Vendor': ['part', 'sku', 'id', 'number', '#', 'code', 'qty', 'quantity', 'contact', 'mfg part', 'model', 'warranty'], 
        // Prevent 'UPC' mapping to SKU
        'Variant SKU': ['manufacturer', 'brand', 'vendor', 'upc', 'ean', 'gtin', 'barcode', 'price', 'cost'],
        'Image Src': ['brand logo', 'vendor logo']
    };

    const findBestMatch = (field: string, headers: string[]): string | undefined => {
        const suggestions = SUGGESTED_MAPPINGS[field] || [field.toLowerCase()];
        const exclusions = EXCLUSIONS[field] || [];

        let bestMatch: string | undefined = undefined;
        let bestScore = 0; // 3 = Exact, 2 = StartsWith, 1 = Includes

        headers.forEach(header => {
            const hLower = header.toLowerCase().trim();
            
            // Critical: Check exclusions
            if (exclusions.some(ex => hLower.includes(ex))) return;

            // Check against all suggestions
            for (const suggestion of suggestions) {
                const sLower = suggestion.toLowerCase();
                
                // Score 3: Exact Match
                if (hLower === sLower) {
                    if (bestScore < 3) { bestMatch = header; bestScore = 3; }
                }
                // Score 2: Starts With (high confidence)
                else if (hLower.startsWith(sLower)) {
                    if (bestScore < 2) { bestMatch = header; bestScore = 2; }
                }
                // Score 1: Contains (fallback)
                else if (hLower.includes(sLower)) {
                    // Penalize very short matches in long headers (e.g. "id" in "width")
                    if (sLower.length < 3 && hLower.length > 10) continue; 
                    if (bestScore < 1) { bestMatch = header; bestScore = 1; }
                }
            }
        });
        return bestMatch;
    };

    // 1. Header Name Matching
    SHOPIFY_FIELDS.forEach(field => {
      if (field === 'Image Src' && sourceHeaders.includes('All Images')) {
          newMapping[field] = 'All Images';
          return;
      }
      const match = findBestMatch(field, sourceHeaders);
      if (match) {
        newMapping[field] = match;
      }
    });

    // 2. Deep Content Analysis for Images (Smart URL Detection)
    // If 'Image Src' wasn't confidently mapped by name, look at the data.
    if (!newMapping['Image Src']) {
        let bestImageHeader = '';
        let bestImageScore = 0;

        for (const header of sourceHeaders) {
            // Check first 10 non-empty rows
            let urlScore = 0;
            let checks = 0;
            
            for(let i=0; i < Math.min(10, sourceData.length); i++) {
                const val = String(sourceData[i][header] || '').trim().toLowerCase();
                if (!val) continue;
                checks++;

                // Strong signal: starts with http/https and has image extension
                if ((val.startsWith('http') || val.startsWith('//')) && val.match(/\.(jpg|jpeg|png|webp|gif)/)) {
                    urlScore += 2;
                }
                // Medium signal: just has image extension (might be relative path or filename)
                else if (val.match(/\.(jpg|jpeg|png|webp|gif)$/)) {
                    urlScore += 1;
                }
                // Medium signal: contains typical CDN keywords or image-related terms
                else if (val.includes('cdn') || val.includes('images') || val.includes('img') || val.includes('scene7') || val.includes('widencdn') || val.includes('cloudinary')) {
                    urlScore += 0.5;
                }
                // Weak signal: starts with http but no extension (could be a dynamic image URL)
                else if (val.startsWith('http') && val.length > 20 && !val.includes(' ')) {
                    urlScore += 0.2;
                }
            }

            // If >30% of checked rows look like images, consider it.
            if (checks > 0) {
                const avgScore = urlScore / checks;
                if (avgScore > bestImageScore && avgScore >= 0.3) {
                    bestImageScore = avgScore;
                    bestImageHeader = header;
                }
            }
        }

        if (bestImageHeader) {
            newMapping['Image Src'] = bestImageHeader;
        }
    }
    
    // 3. Smart Barcode Detection (look for 12-13 digits)
    if (!newMapping['Variant Barcode']) {
         for (const header of sourceHeaders) {
            // Skip if already mapped
            if (Object.values(newMapping).includes(header)) continue;

            let barcodeScore = 0;
            let checks = 0;
             for(let i=0; i < Math.min(10, sourceData.length); i++) {
                const val = String(sourceData[i][header] || '').trim().replace(/[^0-9]/g, '');
                if (!val) continue;
                checks++;
                if (val.length >= 11 && val.length <= 14) {
                    barcodeScore++;
                }
             }
             if (checks > 0 && (barcodeScore / checks) > 0.8) {
                 newMapping['Variant Barcode'] = header;
                 break;
             }
         }
    }

    setMapping(newMapping);
  }, [sourceHeaders, sourceData]);

  const handleSelectChange = (field: string, header: string) => {
    setMapping(prev => ({
      ...prev,
      [field]: header
    }));
  };

  const getSampleValue = (header: string) => {
      if (!header) return null;
      // Try to find first non-empty value
      for(let i=0; i<Math.min(5, sourceData.length); i++) {
          const val = sourceData[i][header];
          if(val !== undefined && val !== null && String(val).trim() !== '') {
              return String(val).substring(0, 35) + (String(val).length > 35 ? '...' : '');
          }
      }
      return <span className="text-slate-400 italic">Empty</span>;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-white flex flex-col h-full overflow-hidden"
    >
      {/* HEADER ACTION BAR */}
      <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
        <div>
           <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
             <Database className="w-5 h-5 text-emerald-500" />
             Map Columns
           </h2>
           <p className="text-sm text-slate-500 mt-1">Match your Excel headers to standard Shopify fields.</p>
        </div>
        <div className="flex space-x-3">
            <button onClick={onBack} className="px-5 py-2.5 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors">
                Back
            </button>
            <button 
                onClick={() => onConfirm(mapping)}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-200 transition-all flex items-center gap-2"
            >
                <span>Generate Data</span>
                <ArrowRight className="w-4 h-4" />
            </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden flex">
          {/* Main Mapping Area */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {SHOPIFY_FIELDS.map((field, index) => {
                    const mappedHeader = mapping[field];
                    return (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          key={field} 
                          className="flex flex-col bg-white p-5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all duration-200 group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-emerald-600 transition-colors">
                                    {field}
                                </label>
                                {mappedHeader ? (
                                    <div className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                        <Check className="w-3 h-3 mr-1" />
                                        <span className="text-[10px] font-bold uppercase">Mapped</span>
                                    </div>
                                ) : (
                                    <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                                )}
                            </div>
                            
                            <div className="relative">
                                <select 
                                    className={`w-full p-3 text-sm border rounded-lg appearance-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors ${mappedHeader ? 'bg-white border-emerald-200 text-slate-900 font-medium' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                    value={mappedHeader || ''}
                                    onChange={(e) => handleSelectChange(field, e.target.value)}
                                >
                                    <option value="">Select Column...</option>
                                    {sourceHeaders.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                            
                            <div className="mt-3 min-h-[20px] text-xs">
                                {mappedHeader ? (
                                    <div className="flex items-start text-slate-500">
                                        <span className="font-semibold text-slate-400 mr-2 uppercase text-[10px] mt-0.5">Example:</span>
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-mono truncate w-full block border border-slate-200">
                                            {getSampleValue(mappedHeader)}
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-slate-300 italic pl-1">Not mapped</p>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
          </div>

          {/* Logs Sidebar */}
          <div className="w-80 bg-slate-900 text-slate-400 p-0 overflow-hidden flex flex-col border-l border-slate-800 hidden lg:flex">
            <div className="p-4 bg-slate-900 border-b border-slate-800">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-emerald-500" />
                    Processing Logs
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px] leading-relaxed">
                <AnimatePresence>
                  {logs.map((log, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={i} 
                        className="break-words border-l-2 border-emerald-500/30 pl-3 py-1 hover:bg-white/5 transition-colors rounded-r"
                      >
                          <span className="text-emerald-500 mr-2 opacity-50">[{i+1}]</span>
                          {log}
                      </motion.div>
                  ))}
                </AnimatePresence>
            </div>
          </div>
      </div>
    </motion.div>
  );
};
