
import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { MappingStep } from './components/MappingStep';
import { PreviewStep } from './components/PreviewStep';
import { ShopifySettingsModal } from './components/ShopifySettingsModal';
import { parseExcel, generateShopifyData, createProductFromSku } from './services/excelService';
import { AppState, Mapping, ProductRow } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Box, ArrowLeft, Activity, Settings2 } from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<AppState>(AppState.UPLOAD);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [sourceData, setSourceData] = useState<ProductRow[]>([]);
  const [processedData, setProcessedData] = useState<ProductRow[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setProgressMessage('Analyzing catalog architecture...');
    setTimeout(async () => {
        try {
            const { headers, data, logs: processingLogs } = await parseExcel(file);
            setSourceHeaders(headers);
            setSourceData(data);
            setLogs(processingLogs);
            setStep(AppState.MAPPING);
        } catch (error) {
            console.error(error);
            alert("Error parsing file.");
        } finally {
            setIsProcessing(false);
            setProgressMessage('');
        }
    }, 100);
  };

  const handleManualEntry = async (brand: string, entries: Array<{ sku: string; hint?: string }>) => {
      setIsProcessing(true);
      if (!entries || entries.length === 0) { setIsProcessing(false); return; }
      
      const allData: ProductRow[] = [];
      try {
          for (let i = 0; i < entries.length; i++) {
              const item = entries[i];
              const currentSku = item.sku;
              const currentHint = item.hint || '';
              
              setProgressMessage(`Researching Market (${i + 1}/${entries.length}): ${brand} ${currentSku}...`);
              
              // Ensure we wait for the AI result with ERP/EVMS hint
              try {
                  const rows = await createProductFromSku(brand, currentSku, currentHint, currentHint ? { 'Title': currentHint } : undefined);
                  if (rows && rows.length > 0) {
                      allData.push(...rows);
                  }
              } catch (err: any) {
                  console.error(`Research failed for SKU ${currentSku}:`, err);
                  if (err.message && err.message.includes('allowance has temporarily been reached')) {
                      alert(err.message);
                      setIsProcessing(false);
                      return;
                  }
                  allData.push({
                      'Handle': `${brand}-${currentSku}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                      'Title': currentHint || `${brand} ${currentSku}`,
                      'Vendor': brand,
                      'Variant SKU': currentSku,
                      'Status': 'draft'
                  });
              }

              // Breathing room for UI and API
              if (entries.length > 1 && i < entries.length - 1) {
                await new Promise(r => setTimeout(r, 600));
              }
          }
          
          if (allData.length === 0) {
            alert("Unable to generate product data. Please check your SKU and Brand.");
            return;
          }
          
          setProcessedData(allData);
          setStep(AppState.PREVIEW);
      } catch (error: any) { 
          alert(`Synthesis interrupted: ${error.message}`); 
      } finally { 
          setIsProcessing(false); 
          setProgressMessage('');
      }
  };

  const handleMappingConfirm = async (mapping: Mapping) => {
    const rawShopifyData = generateShopifyData(sourceData, mapping);
    
    setIsProcessing(true);
    setProgressMessage('Analyzing dataset for enrichment needs...');
        
        // Identify rows that are missing ANY key data point (Image, Description, Price, Weight, Barcode)
        // This ensures "fill in anything that's not available"
        const handlesToEnrich = Array.from(new Set(rawShopifyData.filter(r => 
            !r['Image Src'] || r['Image Src'].includes('placehold.co') || 
            !r['Body (HTML)'] || r['Body (HTML)'].length < 20 ||
            !r['Variant Grams'] || 
            !r['Variant Price'] ||
            !r['Variant Barcode']
        ).map(r => r['Handle'])));
        
        let workingData = [...rawShopifyData];
        
        if (handlesToEnrich.length > 0) {
            // Process in batches to avoid overwhelming the user (and the UI)
            const enrichmentBatch = handlesToEnrich.slice(0, 50); 
            
            for (let i = 0; i < enrichmentBatch.length; i++) {
                const handle = enrichmentBatch[i];
                const baseRow = workingData.find(r => r['Handle'] === handle && r['Title']);
                if (!baseRow) continue;

                setProgressMessage(`Enriching Data: ${baseRow['Title']} (${i + 1}/${enrichmentBatch.length})...`);
                
                try {
                    const brand = baseRow['Vendor'] || '';
                    const sku = baseRow['Variant SKU'] || '';
                    
                    // Pass the existing row as context so AI can "fill in gaps"
                    const rows = await createProductFromSku(brand, sku, '', baseRow);
                    
                    if (rows.length > 0) {
                        const originalRows = workingData.filter(r => r['Handle'] === handle);
                        const others = workingData.filter(r => r['Handle'] !== handle);
                        
                        // Merge the enriched data (rows[0]) into all original variant rows
                        const enrichedBase = rows[0];
                        const mergedRows = originalRows.map((origRow, i) => {
                            if (i === 0) return enrichedBase; // Primary row is fully replaced with enriched data
                            // Subsequent variants inherit product-level info from enrichedBase
                            return {
                                ...origRow,
                                'Title': enrichedBase['Title'] || origRow['Title'],
                                'Body (HTML)': enrichedBase['Body (HTML)'] || origRow['Body (HTML)'],
                                'Vendor': enrichedBase['Vendor'] || origRow['Vendor'],
                                'Product Category': enrichedBase['Product Category'] || origRow['Product Category'],
                                'Type': enrichedBase['Type'] || origRow['Type'],
                                'Tags': enrichedBase['Tags'] || origRow['Tags'],
                                'Image Src': origRow['Image Src'] || enrichedBase['Image Src'], 
                                // Variant-level info like SKU, Price, Barcode remains specific to the variant
                            };
                        });
                        
                        workingData = [...others, ...mergedRows];
                    }
                } catch (err: any) { 
                    console.error("Synthesis failed for " + handle, err); 
                    setProgressMessage(`Error on ${handle}: ${err.message}`);
                    await new Promise(r => setTimeout(r, 2000));
                }
                
                await new Promise(r => setTimeout(r, 1500)); 
            }
        }
        setProcessedData(workingData);
        setIsProcessing(false);
        setStep(AppState.PREVIEW);
  };

  const handleReset = () => {
      setStep(AppState.UPLOAD);
      setSourceData([]);
      setProcessedData([]);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <header className="bg-slate-900 text-white shadow-2xl z-50 sticky top-0 border-b border-slate-800 flex-none">
        <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg shadow-emerald-500/25">
                    W
                </div>
                <div>
                    <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase leading-none">Wise Line Tools Catalog Studio</h1>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">Industrial AI Catalog &amp; Shopify Publishing</span>
                </div>
            </div>
            
            <div className="flex items-center space-x-3">
                 <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 shadow-sm"
                    title="Configure Shopify Store Domain & Access Token"
                 >
                    <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Shopify API</span>
                 </button>

                 {step !== AppState.UPLOAD && (
                     <button onClick={handleReset} className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 shadow-sm">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>New Search</span>
                     </button>
                 )}
                <div className="hidden sm:flex items-center space-x-2 bg-slate-800/80 px-3.5 py-1.5 rounded-full border border-slate-700">
                   <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest font-mono">Gemini AI Active</span>
                </div>
            </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative flex flex-col min-h-0">
            <AnimatePresence>
                {isProcessing && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex flex-col items-center justify-center p-8"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-2xl text-center border border-slate-100"
                        >
                            <div className="w-20 h-20 bg-emerald-100 rounded-full mx-auto flex items-center justify-center mb-6 shadow-inner overflow-hidden relative">
                                 <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                 <Activity className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Marketplace Research</h3>
                            <p className="text-slate-500 mb-6 font-medium text-xs leading-relaxed">{progressMessage}</p>
                            <div className="flex items-center space-x-2 justify-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{animationDelay: '0ms'}}></div>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{animationDelay: '150ms'}}></div>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{animationDelay: '300ms'}}></div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {step === AppState.UPLOAD && (
                    <motion.div 
                        key="upload"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        className="flex-1 overflow-y-auto px-6 sm:px-8 py-8 sm:py-12"
                    >
                         <div className="max-w-4xl mx-auto flex flex-col items-center">
                            <div className="text-center mb-8 sm:mb-10">
                                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-4">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Wise Line Tools Catalog Engine
                                </div>
                                <h2 className="text-3xl sm:text-5xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
                                  Industrial SKU to <span className="text-emerald-600">Storefront.</span>
                                </h2>
                                <p className="text-slate-500 text-sm sm:text-base font-medium max-w-xl mx-auto leading-relaxed">
                                  Autonomous manufacturer research, authentic studio photography, Canadian CAD pricing, and instant Shopify direct publishing.
                                </p>
                            </div>
                            <div className="w-full shadow-2xl rounded-3xl bg-white border border-slate-100">
                                <FileUpload 
                                    onManualEntry={handleManualEntry}
                                    isProcessing={isProcessing} 
                                    progressMessage={progressMessage}
                                />
                            </div>
                         </div>
                    </motion.div>
                )}

                {step === AppState.MAPPING && (
                     <motion.div 
                        key="mapping"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex-1 p-8 overflow-hidden bg-slate-50"
                    >
                        <div className="h-full max-w-screen-2xl mx-auto shadow-2xl rounded-3xl overflow-hidden bg-white border border-slate-100">
                            <MappingStep 
                                sourceHeaders={sourceHeaders} 
                                sourceData={sourceData}
                                onConfirm={handleMappingConfirm}
                                logs={logs}
                                onBack={handleReset}
                            />
                        </div>
                    </motion.div>
                )}

                {step === AppState.PREVIEW && (
                    <motion.div 
                        key="preview"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex-1 p-8 overflow-hidden bg-slate-50"
                    >
                        <div className="h-full max-w-screen-2xl mx-auto shadow-2xl rounded-3xl overflow-hidden bg-white border border-slate-100">
                            <PreviewStep data={processedData} onDataUpdate={setProcessedData} onReset={handleReset} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
      </main>

      <ShopifySettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
};

export default App;
