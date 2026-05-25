import React, { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { profileFilters } from '../../services/FilterConfigService';

const FilterPanel = memo(({ filters = {}, onFilterChange, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleFilterChange = useCallback((filterId, value) => {
    if (onFilterChange) {
      onFilterChange(filterId, value);
    }
  }, [onFilterChange]);

  const clearAllFilters = useCallback(() => {
    if (onFilterChange) {
      // Send null to clear all filters
      onFilterChange(null);
    }
  }, [onFilterChange]);

  const handleToggleOpen = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  // Count active filters
  const activeFilterCount = Object.keys(filters).length;

  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <motion.button
          type="button"
          className="flex items-center text-white font-medium hover:text-blue-400 transition-all duration-200"
          onClick={handleToggleOpen}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <svg 
            className={`w-5 h-5 mr-2 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Advanced Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 px-2 py-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs rounded-full shadow-lg">
              {activeFilterCount}
            </span>
          )}
        </motion.button>
        
        {activeFilterCount > 0 && (
          <motion.button
            type="button"
            className="text-sm text-blue-400 hover:text-blue-300 transition-all duration-200 px-3 py-1 rounded-lg hover:bg-slate-900/50"
            onClick={clearAllFilters}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Clear All
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ 
              duration: 0.2, 
              ease: "easeOut",
              type: "tween"
            }}
            className="overflow-hidden"
          >
            <div className="bg-slate-950/30 border border-slate-700 rounded-lg p-6 mt-2 shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profileFilters.map((filter) => (
                  <motion.div 
                    key={filter.id} 
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                  >
                    <label className="block text-slate-300 text-sm font-medium">
                      {filter.label}
                      {filter.description && (
                        <span className="ml-1 text-slate-500 text-xs">
                          ({filter.description})
                        </span>
                      )}
                    </label>
                    
                    {filter.type === 'boolean' && (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`filter-${filter.id}`}
                          checked={!!filters[filter.id]}
                          onChange={(e) => handleFilterChange(filter.id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-slate-950/30 border-slate-700 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
                        />
                        <label htmlFor={`filter-${filter.id}`} className="ml-3 text-sm text-slate-300 select-none">
                          Enable
                        </label>
                      </div>
                    )}
                    
                    {filter.type === 'text' && (
                      <input
                        type="text"
                        value={filters[filter.id] || ''}
                        onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                        placeholder={`Filter by ${filter.label.toLowerCase()}`}
                        className="w-full px-3 py-2 bg-slate-950/30 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-slate-600"
                      />
                    )}
                    
                    {filter.type === 'number' && (
                      <input
                        type="number"
                        value={filters[filter.id] || ''}
                        onChange={(e) => handleFilterChange(filter.id, e.target.value ? parseInt(e.target.value, 10) : '')}
                        placeholder={`Minimum value`}
                        className="w-full px-3 py-2 bg-slate-950/30 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-slate-600"
                        min="0"
                      />
                    )}
                    
                    {filter.type === 'select' && filter.options && (
                      <select
                        value={filters[filter.id] || ''}
                        onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950/30 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-slate-600"
                      >
                        <option value="">All</option>
                        {filter.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default FilterPanel;
