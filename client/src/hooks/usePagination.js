import { useState, useCallback, useMemo } from 'react';

/**
 * Custom hook for handling pagination logic
 * 
 * @param {Array} items - The full array of items to paginate
 * @param {number} itemsPerPage - Number of items to display per page
 * @param {Object} options - Optional configuration
 * @param {number} options.initialPage - Initial page index (0-based)
 * @param {Function} options.filterFn - Function to filter items
 * @param {Function} options.sortFn - Function to sort items
 * @returns {Object} - Pagination state and controls
 */
const usePagination = (items = [], itemsPerPage = 10, options = {}) => {
  const { initialPage = 0, filterFn, sortFn } = options;
  
  // State
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc'
  });
  const [filters, setFilters] = useState({});
  
  // Reset to first page when items change significantly
  const resetPage = useCallback(() => {
    setCurrentPage(0);
  }, []);
  
  // Apply filters if provided
  const filteredItems = useMemo(() => {
    if (!items || !items.length) return [];
    if (!filterFn || Object.keys(filters).length === 0) return items;
    
    return items.filter(item => filterFn(item, filters));
  }, [items, filters, filterFn]);
  
  // Apply sorting if provided
  const sortedItems = useMemo(() => {
    if (!sortConfig.key || !sortFn) return filteredItems;
    
    return [...filteredItems].sort((a, b) => 
      sortFn(a, b, sortConfig.key, sortConfig.direction === 'asc')
    );
  }, [filteredItems, sortConfig, sortFn]);
  
  // Calculate pagination values
  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Ensure current page is valid
  const safeCurrentPage = Math.min(Math.max(0, currentPage), Math.max(0, totalPages - 1));
  
  // Get current page items
  const currentItems = useMemo(() => {
    const start = safeCurrentPage * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedItems.slice(start, end);
  }, [sortedItems, safeCurrentPage, itemsPerPage]);
  
  // Navigation functions
  const goToPage = useCallback((pageIndex) => {
    setCurrentPage(Math.min(Math.max(0, pageIndex), totalPages - 1));
  }, [totalPages]);
  
  const nextPage = useCallback(() => {
    if (safeCurrentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    }
  }, [safeCurrentPage, totalPages]);
  
  const prevPage = useCallback(() => {
    if (safeCurrentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  }, [safeCurrentPage]);
  
  const firstPage = useCallback(() => {
    setCurrentPage(0);
  }, []);
  
  const lastPage = useCallback(() => {
    setCurrentPage(Math.max(0, totalPages - 1));
  }, [totalPages]);
  
  // Sorting functions
  const setSortBy = useCallback((key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        // Toggle direction if same key
        return { 
          key, 
          direction: prev.direction === 'asc' ? 'desc' : 'asc' 
        };
      }
      // New key, default to ascending
      return { key, direction: 'asc' };
    });
  }, []);
  
  // Filtering functions
  const setFilter = useCallback((key, value) => {
    setFilters(prev => {
      // If value is empty or null, remove the filter
      if (value === '' || value === null || value === undefined) {
        const newFilters = { ...prev };
        delete newFilters[key];
        return newFilters;
      }
      
      return { ...prev, [key]: value };
    });
    
    // Reset to first page when filters change
    resetPage();
  }, [resetPage]);
  
  const clearFilters = useCallback(() => {
    setFilters({});
    resetPage();
  }, [resetPage]);
  
  return {
    // Current state
    currentPage: safeCurrentPage,
    currentItems,
    filters,
    sortConfig,
    
    // Pagination info
    totalItems,
    totalPages,
    itemsPerPage,
    
    // Pagination controls
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    
    // Sorting and filtering
    setSortBy,
    setFilter,
    clearFilters,
    resetPage
  };
};

export default usePagination;
