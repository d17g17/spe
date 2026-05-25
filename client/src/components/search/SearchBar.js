import React, { useState, memo, useCallback } from 'react';
import { motion } from 'framer-motion';

const SearchBar = memo(({ 
  onSearch, 
  placeholder = "Search profiles...",
  initialValue = "",
  fullWidth = false 
}) => {
  const [searchTerm, setSearchTerm] = useState(initialValue);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchTerm);
    }
  }, [onSearch, searchTerm]);

  const handleInputChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    // Auto-search as user types
    if (onSearch) {
      onSearch(e.target.value);
    }
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setSearchTerm('');
    if (onSearch) {
      onSearch('');
    }
  }, [onSearch]);

  return (
    <motion.form 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.2, 
        ease: "easeOut",
        type: "tween"
      }}
      className={`relative ${fullWidth ? 'w-full' : 'max-w-md'}`}
      onSubmit={handleSubmit}
    >
      <div className="flex items-center">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="w-full pl-12 pr-12 py-3 bg-slate-950/30 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-slate-600"
            placeholder={placeholder}
            value={searchTerm}
            onChange={handleInputChange}
          />
          {searchTerm && (
            <motion.button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-white transition-all duration-200"
              onClick={handleClear}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>
          )}
        </div>
        {/* Only show search button if search doesn't trigger automatically */}
        {!fullWidth && (
          <motion.button
            type="submit"
            className="ml-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 hover:from-blue-700 hover:to-blue-600"
            whileTap={{ scale: 0.98 }}
          >
            Search
          </motion.button>
        )}
      </div>
    </motion.form>
  );
});

export default SearchBar;
