import React, { useState } from 'react';
import { Sparkles, Check, ArrowRight, HelpCircle } from 'lucide-react';

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
  'King Canada',
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

  // Parse SKUs from text (supports plain SKUs, Excel copy-paste, SKU - Title, SKU | Title, SKU: Title)
  const parseSkus = (raw: string): ManualEntryItem[] => {
    return raw
      .split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        // 1. Tab-delimited (copy-pasted from Excel / EBMS spreadsheet: SKU \t Title)
        if (line.includes('\t')) {
          const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
          return { sku: parts[0], hint: parts.slice(1).join(' ').trim() };
        }
        // 2. Pipe-delimited (SKU | Title)
        if (line.includes('|')) {
          const parts = line.split('|').map(p => p.trim()).filter(Boolean);
          return { sku: parts[0], hint: parts.slice(1).join(' ').trim() };
        }
        // 3. Colon-delimited (SKU: Title)
        if (line.includes(':') && !line.startsWith('http')) {
          const parts = line.split(':').map(p => p.trim()).filter(Boolean);
          return { sku: parts[0], hint: parts.slice(1).join(' ').trim() };
        }
        // 4. Dash/Hyphen delimited with space (e.g. "KC-10JC - 10-inch Portable Table Saw")
        const dashMatch = line.match(/^([A-Za-z0-9\-_./]+)\s+[-–—]\s+(.+)$/);
        if (dashMatch) {
          return { sku: dashMatch[1].trim(), hint: dashMatch[2].trim() };
        }
        // 5. Comma-separated with title (e.g. "KC-10JC, 10-inch Portable Table Saw")
        if (line.includes(',') && line.split(',').length === 2 && line.split(',')[1].trim().length > 3) {
          const parts = line.split(',').map(p => p.trim());
          return { sku: parts[0], hint: parts[1] };
        }
        // 6. Plain single SKU or comma-separated list of SKUs on one line
        if (line.includes(',')) {
          return line.split(',').map(s => ({ sku: s.trim() })).filter(item => item.sku.length > 0);
        }
        return { sku: line };
      })
      .flat()
      .filter(item => item.sku && item.sku.length > 0);
  };

  const skuList = parseSkus(skuText);
  const hintsCount = skuList.filter(item => item.hint && item.hint.length > 0).length;

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
            placeholder="e.g. Milwaukee, King Canada, Makita, DeWalt, KNIPEX, Olight..."
            value={brand}
            onChange={e => setBrand(e.target.value)}
            required
          />
        </div>

        {/* Unified SKU & EBMS Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-widest">
              Product SKU(s) &amp; Optional EBMS Descriptions
            </label>
            {skuList.length > 0 && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 animate-fade-in flex items-center space-x-1.5">
                <span>{skuList.length === 1 ? '1 SKU ready' : `${skuList.length} SKUs queued`}</span>
                {hintsCount > 0 && (
                  <span className="text-emerald-600 font-medium">({hintsCount} with EBMS titles)</span>
                )}
              </span>
            )}
          </div>

          <textarea
            rows={4}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all outline-none font-mono font-bold text-sm text-slate-900 placeholder-slate-400 resize-y leading-relaxed"
            placeholder="Enter SKUs (e.g. KC-10JC) or SKU + EBMS Title (e.g. KC-10JC - 10&quot; Portable Table Saw). You can also copy-paste table columns directly from Excel / EBMS!"
            value={skuText}
            onChange={e => setSkuText(e.target.value)}
            onKeyDown={handleKeyDown}
            required
          />
          <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start space-x-2 text-[11px] text-slate-500 leading-normal">
            <HelpCircle className="w-4 h-4 text-emerald-600 flex-none mt-0.5" />
            <div>
              <strong className="text-slate-700">How to add EBMS Title / Item Hints:</strong> You can paste just a part number (e.g. <code className="bg-white px-1 py-0.5 rounded border text-slate-700">KC-10JC</code>), or add your EBMS description after it using a dash or tab (e.g. <code className="bg-white px-1 py-0.5 rounded border text-slate-700">KC-10JC - 10" Portable Table Saw</code> or copy-pasting SKU and Title columns straight out of Excel / EBMS). Press <kbd className="px-1.5 py-0.5 bg-white rounded border text-slate-700 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-white rounded border text-slate-700 font-mono text-[10px]">Enter</kbd> to synthesize.
            </div>
          </div>
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
