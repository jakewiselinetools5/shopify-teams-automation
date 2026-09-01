import React, { useState } from 'react';
import { Sparkles, Check, ArrowRight } from 'lucide-react';

export interface ManualEntryItem {
  sku: string;
  hint?: string;
}

interface FileUploadProps {
  onFileSelect?: (file: File) => void;
  onManualEntry: (brand: string, entries: ManualEntryItem[]) => void;
  isProcessing: boolean;
  progressMessage?: string;
}

const POPULAR_BRANDS = [
  'Milwaukee',
  'Makita',
  'DeWalt',
  'KNIPEX',
  'Olight',
  'Badger Tool Belts',
  'Occidental Leather',
  'Bosch',
  'Festool',
  'Malco',
  'Wiha',
  'Wera',
  'SOLA',
  'Stabila',
  'Bessey',
  'Stealth',
  'CMT',
  'Fein'
];

export const FileUpload: React.FC<FileUploadProps> = ({ onManualEntry, isProcessing, progressMessage }) => {
  const [brand, setBrand] = useState('Milwaukee');
  const [skuText, setSkuText] = useState('');

  // Parse SKUs from text (supports newlines, commas, pipes, tabs)
  const parseSkus = (raw: string): ManualEntryItem[] => {
    return raw
      .split(/[\r\n,]+/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        // If someone pastes "SKU | title" or "SKU \t title", extract the SKU part
        if (line.includes('\t')) {
          const parts = line.split('\t').map(p => p.trim());
          return { sku: parts[0] };
        }
        if (line.includes('|')) {
          const parts = line.split('|').map(p => p.trim());
          return { sku: parts[0] };
        }
        return { sku: line };
      })
      .filter(item => item.sku.length > 0);
  };

  const skuList = parseSkus(skuText);

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!brand.trim() || skuList.length === 0) return;
    onManualEntry(brand.trim(), skuList);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleGenerate();
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden flex flex-col p-8 sm:p-10">
      {/* Studio Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/25">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">AI Product Catalog Studio</h3>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              Autonomous deep research across official manufacturer portals, Canadian distributors &amp; competitor retail catalogs
            </p>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleGenerate} className="space-y-6">
        {/* Brand Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-widest">
              Brand / Manufacturer
            </label>
            <span className="text-[10px] font-bold text-slate-400">Click a brand or type below</span>
          </div>

          {/* Brand Quick-Pills */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {POPULAR_BRANDS.map(b => {
              const isSelected = brand.toLowerCase() === b.toLowerCase();
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBrand(b)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm shadow-slate-900/20 scale-[1.02]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 inline-block mr-1 text-emerald-400" />}
                  {b}
                </button>
              );
            })}
          </div>

          <input
            type="text"
            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all outline-none font-bold text-sm text-slate-900 placeholder-slate-400"
            placeholder="e.g. Milwaukee, Makita, DeWalt, KNIPEX, Olight..."
            value={brand}
            onChange={e => setBrand(e.target.value)}
            required
          />
        </div>

        {/* Unified SKU Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-widest">
              Product SKU(s) / Part Number(s)
            </label>
            {skuList.length > 0 && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 animate-fade-in">
                {skuList.length === 1 ? '1 SKU ready' : `${skuList.length} SKUs queued`}
              </span>
            )}
          </div>

          <textarea
            rows={4}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all outline-none font-mono font-bold text-sm text-slate-900 placeholder-slate-400 resize-y leading-relaxed"
            placeholder="Enter a single SKU (e.g. 0892-20) or paste multiple SKUs on new lines (e.g. 0892-20, TW002GZ, PERUN3MINI)..."
            value={skuText}
            onChange={e => setSkuText(e.target.value)}
            onKeyDown={handleKeyDown}
            required
          />
          <p className="text-[11px] text-slate-400 mt-2">
            💡 Enter a single part number or paste a list of SKUs. Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border text-slate-600 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border text-slate-600 font-mono text-[10px]">Enter</kbd> to synthesize immediately.
          </p>
        </div>

        {/* Submit Action */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!brand.trim() || skuList.length === 0 || isProcessing}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-emerald-600/25 disabled:opacity-50 disabled:shadow-none transform active:scale-[0.99] flex items-center justify-center space-x-2.5 cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            <span>
              {skuList.length > 1
                ? `Synthesize ${skuList.length} Products with Deep AI Research`
                : 'Synthesize Product Catalog with Deep AI Research'}
            </span>
            <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
          </button>
        </div>
      </form>
    </div>
  );
};
