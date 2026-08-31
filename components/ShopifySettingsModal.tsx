import React, { useState, useEffect } from 'react';
import { ShopifyConfig } from '../types';
import { getStoredShopifyConfig, saveShopifyConfig, testShopifyConnection } from '../services/shopifyService';
import { Store, Key, CheckCircle2, AlertCircle, X, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ShopifySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: ShopifyConfig) => void;
}

export const ShopifySettingsModal: React.FC<ShopifySettingsModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const [storeDomain, setStoreDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [apiVersion, setApiVersion] = useState('2025-01');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; shopName?: string; domain?: string; currency?: string; error?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getStoredShopifyConfig();
      setStoreDomain(current.storeDomain || '');
      setAccessToken(current.accessToken || '');
      setApiVersion(current.apiVersion || '2025-01');
      setTestResult(null);
    }
  }, [isOpen]);

  const handleTest = async () => {
    if (!storeDomain.trim() || !accessToken.trim()) {
      setTestResult({ success: false, error: 'Please enter both Store Domain and Admin Access Token.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const config: ShopifyConfig = {
      storeDomain: storeDomain.trim(),
      accessToken: accessToken.trim(),
      apiVersion
    };

    const res = await testShopifyConnection(config);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSave = () => {
    const config: ShopifyConfig = {
      storeDomain: storeDomain.trim(),
      accessToken: accessToken.trim(),
      apiVersion
    };

    saveShopifyConfig(config);
    if (onConfigSaved) {
      onConfigSaved(config);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col"
        >
          {/* Modal Header */}
          <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-500/30">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight uppercase leading-none">Shopify Admin Settings</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Direct Catalog Push Configuration</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Store Domain */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-600" />
                Shopify Store Domain
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="your-store.myshopify.com"
                  value={storeDomain}
                  onChange={e => setStoreDomain(e.target.value)}
                  className="w-full p-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white font-mono font-medium outline-none transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">Enter your store's `.myshopify.com` domain or custom handle.</p>
            </div>

            {/* Admin Access Token */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-600" />
                Admin API Access Token
              </label>
              <input
                type="password"
                placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                className="w-full p-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white font-mono outline-none transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1.5">Created via Shopify Admin $\rightarrow$ Settings $\rightarrow$ Apps and sales channels $\rightarrow$ Develop apps.</p>
            </div>

            {/* API Version */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Admin GraphQL API Version
              </label>
              <select
                value={apiVersion}
                onChange={e => setApiVersion(e.target.value)}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="2025-01">2025-01 (Stable Default)</option>
                <option value="2025-04">2025-04</option>
                <option value="2026-01">2026-01</option>
                <option value="2026-04">2026-04 (Latest)</option>
              </select>
            </div>

            {/* Permissions Guidance */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-600 leading-relaxed">
                <span className="font-bold text-emerald-900 block mb-0.5">Required App Scopes</span>
                Ensure your Custom App has <code className="font-mono font-bold text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded text-[10px]">write_products</code>, <code className="font-mono font-bold text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded text-[10px]">read_products</code>, and <code className="font-mono font-bold text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded text-[10px]">write_publications</code> enabled.
              </div>
            </div>

            {/* Test Connection Status Banner */}
            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl border ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center space-x-2.5 font-bold text-xs">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Connected to {testResult.shopName} ({testResult.currency})</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>Connection Failed</span>
                    </>
                  )}
                </div>
                {testResult.success && testResult.domain && (
                  <p className="text-[10px] text-emerald-700 mt-1 font-mono">{testResult.domain}</p>
                )}
                {!testResult.success && testResult.error && (
                  <p className="text-[10px] text-rose-700 mt-1 font-mono leading-tight">{testResult.error}</p>
                )}
              </motion.div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !storeDomain.trim() || !accessToken.trim()}
              className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!storeDomain.trim() || !accessToken.trim()}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Config</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
