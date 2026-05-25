import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { calculateFriendStatistics, formatCurrency, formatPercentage } from '../../utils/friendStatistics';

/**
 * FriendStatistics component that displays comprehensive friend statistics
 */
const FriendStatistics = memo(({ friends, filteredFriends, totalFriendsCount, isVisible = true }) => {
  if (!isVisible || !friends || friends.length === 0) {
    return null;
  }

  const stats = calculateFriendStatistics(friends, filteredFriends, totalFriendsCount);
  
  // Check if inventory data is still being processed
  const hasInventoryData = friends.some(friend => 
    friend.inventoryBadge?.value !== undefined || 
    friend.inventoryValue !== undefined
  );
  const inventoryProcessingComplete = hasInventoryData || friends.length === 0;

  const statisticItems = [
    {
      label: 'Total Friends',
      value: stats.total,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/20',
      borderColor: 'border-blue-700/50',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      label: 'Currently Showing',
      value: stats.showing,
      color: 'text-green-400',
      bgColor: 'bg-green-900/20',
      borderColor: 'border-green-700/50',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )
    },
    {
      label: 'Private Profiles',
      value: `${stats.private} (${formatPercentage(stats.private, stats.total)})`,
      color: 'text-red-400',
      bgColor: 'bg-red-900/20',
      borderColor: 'border-red-700/50',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },

    {
      label: 'Inventory Eligible',
      value: `${stats.eligible} (${formatPercentage(stats.eligible, stats.total)})`,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-900/20',
      borderColor: 'border-emerald-700/50',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      label: 'Over $700 Inventory',
      value: inventoryProcessingComplete ? `${stats.over700usd} (${formatPercentage(stats.over700usd, stats.total)})` : 'Processing...',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-900/20',
      borderColor: 'border-yellow-700/50',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      )
    },
    {
      label: 'With Inventory Data',
      value: inventoryProcessingComplete ? `${stats.withInventoryData} (${formatPercentage(stats.withInventoryData, stats.total)})` : 'Processing...',
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/20',
      borderColor: 'border-blue-700/50',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
        <div className="flex items-center mb-4">
          <svg className="w-6 h-6 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-semibold text-white">Friend Statistics</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statisticItems.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className={`${item.bgColor} ${item.borderColor} border rounded-lg p-3 text-center hover:scale-105 transition-transform duration-200`}
            >
              <div className={`flex items-center justify-center ${item.color} mb-2`}>
                {item.icon}
              </div>
              <div className={`text-lg font-bold ${item.color} mb-1`}>
                {item.value}
              </div>
              <div className="text-xs text-slate-400 leading-tight">
                {item.label}
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Additional summary information */}
        {(inventoryProcessingComplete && stats.withInventoryData > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="mt-4 pt-4 border-t border-slate-700/50"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Inventory Value:</span>
                <span className="text-green-400 font-semibold">
                  {formatCurrency(stats.totalInventoryValue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Average Inventory Value:</span>
                <span className="text-blue-400 font-semibold">
                  {formatCurrency(stats.averageInventoryValue)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Show processing indicator for inventory data */}
        {!inventoryProcessingComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="mt-4 pt-4 border-t border-slate-700/50"
          >
            <div className="flex items-center justify-center text-sm text-slate-400">
              <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Inventory data is being processed...
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
});

FriendStatistics.displayName = 'FriendStatistics';

export default FriendStatistics;