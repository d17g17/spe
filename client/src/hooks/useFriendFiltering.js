import { useState, useMemo } from 'react';
import { filterProfiles, sortProfiles } from '../services/ProfileListManager';

/**
 * Custom hook to handle friend filtering, searching and sorting
 * 
 * @param {Array} friends - Array of friend objects
 * @param {string} initialSortOption - Initial sort option
 * @returns {Object} - Filtered friends and filter state/setters
 */
export const useFriendFiltering = (friends, initialSortOption = 'inventoryValue_desc') => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState(initialSortOption);
  const [filters, setFilters] = useState({});

  // Apply search, filters, and sorting to friends list
  const filteredFriends = useMemo(() => {
    if (!friends || friends.length === 0) return [];
    
    // First apply text search
    let result = searchQuery 
      ? friends.filter(friend => 
          friend.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          friend.steamId?.includes(searchQuery)
        )
      : [...friends];
    
    // Then apply filters
    result = filterProfiles(result, '', filters);
    
    // Finally apply sorting
    const [sortBy, sortDir] = sortOption.split('_');
    result = sortProfiles(result, `${sortBy}_${sortDir}`);
    
    return result;
  }, [friends, searchQuery, filters, sortOption]);

  // Handle filter change
  const handleFilterChange = (filterId, value) => {
    if (filterId === null) {
      // Clear all filters
      setFilters({});
    } else {
      setFilters(prev => {
        // If value is falsy/empty, remove the filter
        if (!value && value !== false) {
          const newFilters = { ...prev };
          delete newFilters[filterId];
          return newFilters;
        }
        // Otherwise add/update the filter
        return { ...prev, [filterId]: value };
      });
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    filters,
    filteredFriends,
    handleFilterChange
  };
};

export default useFriendFiltering;
