import React from 'react';
import { motion } from 'framer-motion';

/**
 * Pagination component for navigating through multiple pages of results
 * @param {Object} props Component properties
 * @param {number} props.currentPage Current active page (1-based)
 * @param {number} props.totalPages Total number of pages
 * @param {Function} props.onPageChange Callback when page is changed
 * @param {string} [props.className] Additional CSS classes
 */
const Pagination = ({ currentPage, totalPages, onPageChange, className = '' }) => {
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      // If total pages is less than max pages to show, display all pages
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show first page
      pageNumbers.push(1);
      
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if at start or end
      if (currentPage <= 2) {
        endPage = 4;
      } else if (currentPage >= totalPages - 1) {
        startPage = totalPages - 3;
      }
      
      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pageNumbers.push('...');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pageNumbers.push('...');
      }
      
      // Always show last page
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };
  
  if (totalPages <= 1) {
    return null; // Don't show pagination if there's only one page
  }
  
  return (
    <motion.div 
      className={`flex justify-center items-center my-6 space-x-2 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      {/* Previous button */}
      <button
        onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`px-3 py-1 rounded-md text-sm font-medium focus:outline-none
          ${currentPage === 1 
            ? 'bg-blue-900/30 text-slate-400 cursor-not-allowed border border-blue-800'
        : 'bg-blue-900/50 text-white hover:bg-blue-900/70 border border-blue-700 hover:border-blue-600'}`}
      >
        &lt;
      </button>
      
      {/* Page numbers */}
      {getPageNumbers().map((pageNum, index) => (
        <button
          key={`page-${index}`}
          onClick={() => typeof pageNum === 'number' && onPageChange(pageNum)}
          disabled={typeof pageNum !== 'number' || pageNum === currentPage}
          className={`px-3 py-1 rounded-md text-sm font-medium focus:outline-none
            ${typeof pageNum !== 'number' 
              ? 'bg-transparent text-slate-400 cursor-default' 
              : pageNum === currentPage
                ? 'bg-blue-600 text-white cursor-default'
                : 'bg-blue-900/50 text-white hover:bg-blue-900/70 border border-blue-700 hover:border-blue-600'}`}
        >
          {pageNum}
        </button>
      ))}
      
      {/* Next button */}
      <button
        onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`px-3 py-1 rounded-md text-sm font-medium focus:outline-none
          ${currentPage === totalPages
            ? 'bg-blue-900/30 text-slate-400 cursor-not-allowed border border-blue-800'
        : 'bg-blue-900/50 text-white hover:bg-blue-900/70 border border-blue-700 hover:border-blue-600'}`}
      >
        &gt;
      </button>
    </motion.div>
  );
};

export default Pagination;
