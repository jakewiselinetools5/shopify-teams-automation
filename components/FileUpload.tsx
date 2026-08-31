import React, { useState } from 'react';
import { Sparkles, Layers, Zap, Check, ArrowRight, Tag } from 'lucide-react';

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
  'KNIPEX',
  'Milwaukee',
  'DeWalt',
  'Bosch',
  'Makita',
  'Malco',
  'Festool',
  'Bessey',
  'Wiha',
  'Wera',
  'SOLA',
  'Dynamic Safety',
  'Edge Eyewear',
  'EGO',
  'CMT',
  'Watson Gloves',
  'Fiskars',
  'Stabila',
  'Fein'
];

const PRESET_SAMPLES = [
  { brand: 'Malco', sku: 'MAL-M2000S', hint: 'Malco Replacement Spring for M2000 Series Snips', label: 'Malco Replacement Spring' },
  { brand: 'Makita', sku: 'TW002GZ', hint: '40Vmax XGT Brushless 1/2" High Torque Impact Wrench (Bare Tool)', label: 'Makita 1/2" Impact Wrench' },
  { brand: 'KNIPEX', sku: '8751180SBA', hint: 'KNIPEX Cobra Extra Slim Water Pump Pliers 180mm', label: 'Knipex Cobra Pliers' },
  { brand: 'SOLA', sku: 'LSB72', hint: 'SOLA 72" Box Beam Spirit Level', label: 'SOLA 72" Level' },
  { brand: 'Bosch', sku: 'GCM18V-12GDCN14', hint: 'Bosch 18V PROFACTOR 12" Dual-Bevel Glide Miter Saw Kit', label: 'Bosch 12" Miter Saw' }
];

export const FileUpload: React.FC<FileUploadProps> = ({ onManualEntry, isProcessing, progressMessage }) => {
  const [brand, setBrand] = useState('Malco');
  const [inputMode, setInputMode] = useState<'single' | 'batch'>('single');
  
  // Single mode state
  const [singleSku, setSingleSku] = useState('');
  const [singleHint, setSingleHint] = useState('');

  // Batch mode state
  const [batchText, setBatchText] = useState('');

  // Parse batch items
  const parseBatchEntries = (raw: string): ManualEntryItem[] => {
    return raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        // Support: SKU | Title OR SKU [TAB] Title OR SKU , Title
        if (line.includes('\t')) {
          const parts = line.split('\t').map(p => p.trim());
          return { sku: parts[0], hint: parts.slice(1).join(' ') };
        }
        if (line.includes('|')) {
          const parts = line.split('|').map(p => p.trim());
          return { sku: parts[0], hint: parts.slice(1).join(' ') };
        }
        if (line.includes(',')) {
          const parts = line.split(',').map(p => p.trim());
          return { sku: parts[0], hint: parts.slice(1).join(', ') };
        }
        return { sku: line };
      })
      .filter(item => item.sku.length > 0);
  };

  const batchList = parseBatchEntries(batchText);

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!brand.trim()) return;

    if (inputMode === 'single') {
      if (singleSku.trim()) {
        onManualEntry(brand.trim(), [{ sku: singleSku.trim(), hint: singleHint.trim() }]);
      }
    } else {
      if (batchList.length > 0) {
        onManualEntry(brand.trim(), batchList);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleGenerate();
    }
  };

  const handleApplyPreset = (preset: typeof PRESET_SAMPLES[0]) => {
    setBrand(preset.brand);
    setInputMode('single');
    setSingleSku(preset.sku);
    setSingleHint(preset.hint);
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden flex flex-col p-8 sm:p-10">
      {/* Studio Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500 rounded-xl text-white shadow-md shadow-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">AI SKU Catalog Generator</h3>
              <p className="text-xs font-medium text-slate-400">Autonomous deep research, high-res photography, Canadian MSRP &amp; specs</p>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setInputMode('single')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                inputMode === 'single'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Single SKU + EBMS
            </button>
            <button
              type="button"
              onClick={() => setInputMode('batch')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                inputMode === 'batch'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Batch Mode ({batchList.length})
            </button>
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
            placeholder="e.g. Malco, Makita, KNIPEX, Milwaukee..."
            value={brand}
            onChange={e => setBrand(e.target.value)}
            required
          />
        </div>

        {/* Input Mode: Single SKU + EBMS Item Title */}
        {inputMode === 'single' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                Part # / SKU
              </label>
              <input
                type="text"
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all outline-none font-mono font-bold text-sm text-slate-900 placeholder-slate-400"
                placeholder="e.g. MAL-M2000S, TW002GZ, 8751180SBA"
                value={singleSku}
                onChange={e => setSingleSku(e.target.value)}
                onKeyDown={handleKeyDown}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  EBMS Item Title <span className="text-slate-400 normal-case font-medium">(Recommended for 100% Accuracy)</span>
                </label>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  AI Accuracy Anchor
                </span>
              </div>
              <input
                type="text"
                className="w-full p-3.5 bg-emerald-50/40 border border-emerald-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all outline-none font-semibold text-sm text-slate-900 placeholder-slate-400"
                placeholder="e.g. Malco Replacement Spring for M2000 Series Snips"
                value={singleHint}
                onChange={e => setSingleHint(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                💡 Entering your EBMS item title tells the AI exactly what the part is (e.g. replacement spring, blade, or bare tool) so it never pulls the wrong tool family.
              </p>
            </div>
          </div>
        ) : (
          /* Input Mode: Batch Multi-line Mode */
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-black text-slate-600 uppercase tracking-widest">
                Batch SKUs &amp; EBMS Item Titles <span className="text-slate-400 normal-case font-medium">(One per line)</span>
              </label>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                Excel / EBMS Copy-Paste Supported
              </span>
            </div>

            <textarea
              rows={5}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all outline-none font-mono text-xs text-slate-900 placeholder-slate-400 resize-none leading-relaxed"
              placeholder={`Paste single SKUs or SKU + EBMS Title (separated by tab or pipe):\nMAL-M2000S | Malco Replacement Spring for M2000 Series Snips\nTW002GZ | 40Vmax XGT 1/2" High Torque Impact Wrench\n8751180SBA`}
              value={batchText}
              onChange={e => setBatchText(e.target.value)}
              onKeyDown={handleKeyDown}
              required
            />
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
              <span>Tip: You can copy two columns from Excel/EBMS (SKU &amp; Title) and paste directly here.</span>
              {batchList.length > 0 && (
                <span className="font-bold text-slate-700">{batchList.length} items queued</span>
              )}
            </p>
          </div>
        )}

        {/* Quick Presets */}
        <div className="pt-2">
          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Quick Test Presets:</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_SAMPLES.map(sample => (
              <button
                key={sample.sku}
                type="button"
                onClick={() => handleApplyPreset(sample)}
                className="px-3 py-1.5 bg-white hover:bg-emerald-50/60 text-slate-600 hover:text-emerald-800 text-[11px] font-bold rounded-xl border border-slate-200 hover:border-emerald-300 transition-all flex items-center gap-1.5"
              >
                <Zap className="w-3 h-3 text-amber-500" />
                <span>{sample.label}</span>
                <span className="font-mono text-[10px] text-slate-400">({sample.sku})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={
              !brand.trim() ||
              (inputMode === 'single' ? !singleSku.trim() : batchList.length === 0) ||
              isProcessing
            }
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-emerald-600/25 disabled:opacity-50 disabled:shadow-none transform active:scale-[0.99] flex items-center justify-center space-x-2.5"
          >
            <Sparkles className="w-5 h-5" />
            <span>
              {inputMode === 'batch' && batchList.length > 1
                ? `Synthesize ${batchList.length} Products with AI`
                : 'Synthesize Product Catalog with AI'}
            </span>
            <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
          </button>
        </div>
      </form>
    </div>
  );
};
