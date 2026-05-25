import React, { useState, useCallback } from 'react';
import { useOptimizedQuery } from '../../hooks/useOptimizedQuery';
import { getCS2InventoryStats } from '../../services/api';
import { useMemoryLeakPrevention } from '../../services/memoryLeakPrevention';

/**
 * Component that displays real-time inventory check statistics
 */
const InventoryStatsIndicator = () => {
  const [expanded, setExpanded] = useState(false);
  const { registerCleanup } = useMemoryLeakPrevention('InventoryStatsIndicator');

  // Use optimized query with proper cleanup
  const { data: stats, isLoading: loading, error } = useOptimizedQuery({
    queryKey: ['inventoryStats'],
    queryFn: getCS2InventoryStats,
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    refetchIntervalInBackground: false, // Don't refetch when tab is hidden
    retry: 1,
    retryDelay: 5000,
    select: (data) => {
      // Optimize stats data structure and ensure defaults
      if (!data) {
        return {
          totalInventoryChecks: 0,
          activeInventoryChecks: 0,
          totalPriceChecks: 0,
          activePriceChecks: 0,
          successfulPriceChecks: 0,
          failedPriceChecks: 0,
          skippedInventories: 0,
          totalProcessed: 0,
          priceSuccessRate: 0,
          timestamp: Date.now()
        };
      }
      return {
        totalInventoryChecks: data.totalInventoryChecks || 0,
        activeInventoryChecks: data.activeInventoryChecks || 0,
        totalPriceChecks: data.totalPriceChecks || 0,
        activePriceChecks: data.activePriceChecks || 0,
        successfulPriceChecks: data.successfulPriceChecks || 0,
        failedPriceChecks: data.failedPriceChecks || 0,
        skippedInventories: data.skippedInventories || 0,
        totalProcessed: data.totalProcessed || 0,
        priceSuccessRate: data.priceSuccessRate || 0,
        timestamp: data.timestamp || Date.now()
      };
    },
    onError: (err) => {
      // Failed to fetch inventory stats
    }
  });

  // Toggle expanded view with memory leak prevention
  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  // Register cleanup for any potential memory leaks
  registerCleanup(() => {
    // Any additional cleanup if needed
  });

  if (loading) {
    return (
      <div className="bg-slate-900/50 px-3 py-1 rounded-lg text-sm flex items-center border border-slate-700">
        <span className="animate-pulse text-yellow-400">⌛ Loading inventory stats...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/50 px-3 py-1 rounded-lg text-sm flex items-center border border-slate-700">
        <span className="text-red-400">❌ Stats unavailable</span>
        <button 
          onClick={() => window.location.reload()} 
          className="ml-2 text-xs text-blue-400 hover:text-blue-300"
          title="Refresh page"
        >
          🔄
        </button>
      </div>
    );
  }

  // Ensure stats has default values
  const safeStats = stats || {
    totalInventoryChecks: 0,
    activeInventoryChecks: 0,
    totalPriceChecks: 0,
    activePriceChecks: 0,
    successfulPriceChecks: 0,
    failedPriceChecks: 0,
    skippedInventories: 0,
    totalProcessed: 0,
    priceSuccessRate: 0,
    timestamp: Date.now()
  };

  return (
    <div 
      className={`bg-slate-900/50 px-3 py-1 rounded-lg text-sm transition-all duration-200 border border-slate-700 ${expanded ? 'w-auto' : 'w-auto'}`}
    >
      <div 
        className="flex items-center cursor-pointer hover:text-yellow-300" 
        onClick={toggleExpanded}
      >
        <span className="text-yellow-400 mr-1">📦</span>
        <span className="text-yellow-400 font-medium">
          Inventory Checks: <span className="text-green-400">{safeStats.activeInventoryChecks} active</span> / <span className="text-blue-400">{safeStats.totalInventoryChecks} total</span>
        </span>
        <span className="ml-2 text-slate-400">
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      
      {expanded && (
        <div className="mt-2 space-y-1 animate-fadeIn text-xs">
          <div className="grid grid-cols-2 gap-x-4">
            <div className="flex justify-between">
              <span className="text-slate-400">Processing:</span>
              <span className="text-green-400">{safeStats.activeInventoryChecks}/{safeStats.totalInventoryChecks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Completed:</span>
              <span className="text-blue-400">{safeStats.totalProcessed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Skipped:</span>
              <span className="text-orange-400">{safeStats.skippedInventories}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Price Success:</span>
              <span className="text-green-400">{safeStats.priceSuccessRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Prices Found:</span>
              <span className="text-green-400">{safeStats.successfulPriceChecks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Prices Missing:</span>
              <span className="text-red-400">{safeStats.failedPriceChecks}</span>
            </div>
          </div>
          <div className="text-right text-slate-500 italic text-xs mt-1">
            Updated: {new Date(safeStats.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryStatsIndicator;
