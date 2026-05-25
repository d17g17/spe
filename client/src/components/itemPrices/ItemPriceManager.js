import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as apiService from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

const ItemPriceManager = memo(({ isOpen, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const fileInputRef = useRef(null);
  const { showSuccess, showError } = useNotification();

  const loadStats = useCallback(async () => {
    try {
      const response = await apiService.getItemPriceStats();
      setStats(response.data || response);
    } catch (error) {
      showError(`Failed to load statistics: ${error.message}`);
    }
  }, [showError]);

  // Load stats when component opens
  useEffect(() => {
    if (isOpen && !stats) {
      loadStats();
    }
  }, [isOpen, stats, loadStats]);

  const handleExport = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiService.exportItemPrices();
      
      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `item-prices-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showSuccess(`Exported ${data.totalItems} item prices successfully`);
    } catch (error) {
      showError(`Export failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError]);

  const handleImport = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.itemPrices || !Array.isArray(data.itemPrices)) {
        throw new Error('Invalid file format. Expected itemPrices array.');
      }

      const result = await apiService.importItemPrices(data.itemPrices, false);
      
      showSuccess(
        `Import completed: ${result.data.imported} new, ${result.data.updated} updated, ${result.data.skipped} skipped`
      );
      
      // Refresh stats
      await loadStats();
    } catch (error) {
      showError(`Import failed: ${error.message}`);
    } finally {
      setIsLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [showSuccess, showError, loadStats]);

  const handleClear = useCallback(async () => {
    if (!window.confirm('Are you sure you want to clear ALL item prices? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiService.clearItemPrices();
      showSuccess(`Cleared ${result.data.deletedCount} item prices`);
      
      // Refresh stats
      await loadStats();
    } catch (error) {
      showError(`Clear failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [showSuccess, showError, loadStats]);

  const handleUpdateStats = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadStats();
      showSuccess('Database statistics updated successfully');
    } catch (error) {
      showError(`Failed to update statistics: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [loadStats, showSuccess, showError]);

  const handleToggleStats = useCallback(() => {
    setShowStats(!showStats);
    if (!showStats && !stats) {
      loadStats();
    }
  }, [showStats, stats, loadStats]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          
          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: "easeOut", type: "tween" }}
            className="fixed right-0 top-0 h-full w-96 bg-slate-950/90 shadow-lg z-50 overflow-y-auto border-l border-slate-700"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Item Price Manager</h2>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 hover:bg-slate-900/50 transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Statistics */}
              <div className="mb-6">
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={handleToggleStats}
                    className="flex-1 flex items-center justify-between p-4 bg-slate-900/30 rounded-lg hover:bg-slate-900/50 transition-all duration-200 border border-slate-700 hover:border-slate-600"
                  >
                    <span className="text-white font-medium">Database Statistics</span>
                    <svg 
                      className={`w-5 h-5 text-slate-400 transition-transform ${showStats ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleUpdateStats}
                    disabled={isLoading}
                    className="p-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition-all duration-200 border border-blue-500 hover:border-blue-400 disabled:border-slate-600 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                    title="Update Statistics"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                
                <AnimatePresence>
                  {showStats && stats && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 p-4 bg-slate-900/20 rounded-lg space-y-3 border border-slate-700">
                        <div className="flex justify-between items-center py-2 px-3 bg-slate-950/50 rounded border border-slate-600">
                          <span className="text-slate-300 font-medium">Total Items:</span>
                          <span className="text-white font-semibold">{stats.totalItems?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-3 bg-slate-950/50 rounded border border-slate-600">
                          <span className="text-slate-300 font-medium">Average Price:</span>
                          <span className="text-green-400 font-semibold">${stats.avgPrice || '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-3 bg-slate-950/50 rounded border border-slate-600">
                          <span className="text-slate-300 font-medium">Max Price:</span>
                          <span className="text-yellow-400 font-semibold">${stats.maxPrice || '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-3 bg-slate-950/50 rounded border border-slate-600">
                          <span className="text-slate-300 font-medium">Recently Updated:</span>
                          <span className="text-blue-400 font-semibold">{stats.recentlyUpdated || '0'}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Actions */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-white mb-3">Export/Import</h3>
                  
                  <button
                    onClick={handleExport}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-lg transition-all duration-200 border border-blue-500 hover:border-blue-400 disabled:border-slate-600 shadow-lg hover:shadow-xl mb-3 transform hover:scale-[1.02] disabled:transform-none"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {isLoading ? 'Exporting...' : 'Export Item Prices'}
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center p-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-lg transition-all duration-200 border border-green-500 hover:border-green-400 disabled:border-slate-600 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    {isLoading ? 'Importing...' : 'Import Item Prices'}
                  </button>
                </div>
                
                <div className="pt-4 border-t border-slate-700">
                  <h3 className="text-lg font-medium text-white mb-3">Danger Zone</h3>
                  
                  <button
                    onClick={handleClear}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center p-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-lg transition-all duration-200 border border-red-500 hover:border-red-400 disabled:border-slate-600 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {isLoading ? 'Clearing...' : 'Clear All Prices'}
                  </button>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-slate-900/20 rounded-lg border border-slate-700">
                <h4 className="text-sm font-medium text-white mb-2">Usage Notes</h4>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Export creates a JSON file with all current prices</li>
                  <li>• Import only adds new items, doesn't overwrite existing</li>
                  <li>• Case prices expire after 24 hours automatically</li>
                  <li>• Clear removes ALL prices from the database</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

export default ItemPriceManager;