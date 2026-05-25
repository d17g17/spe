/**
 * FilterConfigService
 * Centralizes filter configurations for consistent filtering across the application
 */

// Standard profile filters
export const profileFilters = [
  { 
    id: 'hasAvatar', 
    label: 'Has Custom Avatar', 
    type: 'boolean',
    description: 'Show only profiles with a custom avatar'
  },
  { 
    id: 'isPrivate', 
    label: 'Private Profile', 
    type: 'boolean',
    description: 'Show only private profiles'
  },
  { 
    id: 'hasCyrillic', 
    label: 'Has Cyrillic', 
    type: 'boolean',
    description: 'Show only profiles with Cyrillic characters'
  },
  { 
    id: 'hasBans', 
    label: 'Has Any Ban', 
    type: 'boolean',
    description: 'Show only profiles with any type of ban'
  },
  { 
    id: 'hasVacBan', 
    label: 'Has VAC Ban', 
    type: 'boolean',
    description: 'Show only profiles with VAC bans'
  },
  { 
    id: 'hasGameBan', 
    label: 'Has Game Ban', 
    type: 'boolean',
    description: 'Show only profiles with game bans'
  },
  { 
    id: 'hasTradeBan', 
    label: 'Has Trade Ban', 
    type: 'boolean',
    description: 'Show only profiles with trade bans'
  },
  { 
    id: 'hasInventory', 
    label: 'Has CS2 Inventory', 
    type: 'boolean',
    description: 'Show only profiles with available CS2 inventory'
  },
  { 
    id: 'hasUsername', 
    label: 'Username Contains', 
    type: 'text',
    description: 'Filter profiles by username text'
  },
  { 
    id: 'hasGame', 
    label: 'Last Played Game', 
    type: 'text',
    description: 'Filter by last played game'
  },
  { 
    id: 'country', 
    label: 'Country', 
    type: 'select',
    options: [], // Will be dynamically populated from available countries
    description: 'Filter by country'
  },
  { 
    id: 'minFriends', 
    label: 'Min Friends', 
    type: 'number',
    description: 'Minimum number of friends'
  },
  { 
    id: 'minPlaytime', 
    label: 'Min Recent Playtime', 
    type: 'number',
    description: 'Minimum playtime in last 2 weeks (hours)'
  },
  { 
    id: 'minInventoryValue', 
    label: 'Min Inventory Value', 
    type: 'number',
    description: 'Minimum CS2 inventory value (USD)'
  }
];

// Profile sort options
export const profileSortOptions = [
  {
    id: 'updatedAt_desc',
    label: 'Recently Updated',
    field: 'updatedAt',
    direction: 'desc',
    description: 'Most recently updated first'
  },
  {
    id: 'updatedAt_asc',
    label: 'Oldest Updated',
    field: 'updatedAt',
    direction: 'asc',
    description: 'Oldest updates first'
  },
  {
    id: 'name_asc',
    label: 'Username (A-Z)',
    field: 'name',
    direction: 'asc',
    description: 'Alphabetical by username'
  },
  {
    id: 'name_desc',
    label: 'Username (Z-A)',
    field: 'name',
    direction: 'desc',
    description: 'Reverse alphabetical by username'
  },
  {
    id: 'friendsCount_desc',
    label: 'Most Friends',
    field: 'friendsCount',
    direction: 'desc',
    description: 'Most friends first'
  },
  {
    id: 'friendsCount_asc',
    label: 'Least Friends',
    field: 'friendsCount',
    direction: 'asc',
    description: 'Least friends first'
  },
  {
    id: 'lastLogoff_desc',
    label: 'Recently Online',
    field: 'lastLogoff',
    direction: 'desc',
    description: 'Most recently online first'
  },
  {
    id: 'lastLogoff_asc',
    label: 'Longest Offline',
    field: 'lastLogoff',
    direction: 'asc',
    description: 'Longest offline first'
  },
  {
    id: 'lastBadgeDate_desc',
    label: 'Recent Badge Activity',
    field: 'lastBadgeDate',
    direction: 'desc',
    description: 'Most recent badge activity first'
  },
  {
    id: 'playtime2Weeks_desc',
    label: 'Most Active',
    field: 'playtime2Weeks',
    direction: 'desc',
    description: 'Most playtime in last 2 weeks'
  },
  {
    id: 'country_asc',
    label: 'Country (A-Z)',
    field: 'country',
    direction: 'asc',
    description: 'Alphabetical by country'
  },
  {
    id: 'inventoryValue_desc',
    label: 'Highest Inventory Value',
    field: 'inventoryValue',
    direction: 'desc',
    description: 'Most valuable CS2 inventories first'
  }
];

// Friend list filters
export const friendFilters = [
  { 
    id: 'isOnline', 
    label: 'Online', 
    type: 'boolean',
    description: 'Show only friends who are currently online'
  },
  { 
    id: 'hasAvatar', 
    label: 'Has Avatar', 
    type: 'boolean',
    description: 'Show only friends with a custom avatar'
  },
  { 
    id: 'isPrivate', 
    label: 'Private Profile', 
    type: 'boolean',
    description: 'Show only friends with private profiles'
  },
  { 
    id: 'hasVacBan', 
    label: 'Has VAC Ban', 
    type: 'boolean',
    description: 'Show only friends with VAC bans'
  },
  { 
    id: 'nameContains', 
    label: 'Name Contains', 
    type: 'text',
    description: 'Filter friends by name'
  },
  { 
    id: 'countryCode', 
    label: 'Country', 
    type: 'select',
    options: [], // Will be populated dynamically
    description: 'Filter friends by country'
  }
];

// Friend sort options
export const friendSortOptions = [
  {
    id: 'name_asc',
    label: 'Name (A-Z)',
    field: 'name',
    direction: 'asc'
  },
  {
    id: 'name_desc',
    label: 'Name (Z-A)',
    field: 'name',
    direction: 'desc'
  },
  {
    id: 'personaState_desc',
    label: 'Online Status',
    field: 'personaState',
    direction: 'desc'
  },
  {
    id: 'lastLogoff_desc',
    label: 'Last Online',
    field: 'lastLogoff',
    direction: 'desc'
  },
  {
    id: 'friendsCount_desc',
    label: 'Most Friends',
    field: 'friendsCount',
    direction: 'desc'
  },
  {
    id: 'country_asc',
    label: 'Country (A-Z)',
    field: 'country',
    direction: 'asc'
  }
];

/**
 * Apply filters to an array of items
 * @param {Array} items - Array of items to filter
 * @param {Object} filters - Filter criteria
 * @param {Function} customFilterFn - Optional custom filter function for special cases
 * @returns {Array} - Filtered items
 */
export const applyFilters = (items = [], filters = {}, customFilterFn = null) => {
  if (!items || !items.length) return [];
  if (!filters || Object.keys(filters).length === 0) return items;
  
  // Allow custom filter function to handle special cases
  if (customFilterFn) {
    return customFilterFn(items, filters);
  }
  
  // Default filtering logic
  return items.filter(item => {
    for (const [key, value] of Object.entries(filters)) {
      // Skip empty values
      if (value === undefined || value === null || value === '') {
        continue;
      }
      
      // Handle different filter types
      if (typeof value === 'boolean') {
        // Boolean filters check for existence/truth of a property
        if (!item[key] && value === true) {
          return false;
        }
      } else if (typeof value === 'string') {
        // String filters check for substring matches
        if (!item[key] || !item[key].toLowerCase().includes(value.toLowerCase())) {
          return false;
        }
      } else if (typeof value === 'number') {
        // Number filters check for minimum values
        if (!item[key] || item[key] < value) {
          return false;
        }
      }
    }
    
    return true;
  });
};

/**
 * Apply sorting to an array of items
 * @param {Array} items - Array of items to sort
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort order ('asc' or 'desc')
 * @param {Function} customSortFn - Optional custom sort function
 * @returns {Array} - Sorted items
 */
export const applySorting = (items = [], sortBy = '', sortOrder = 'asc', customSortFn = null) => {
  if (!items || !items.length) return [];
  if (!sortBy) return items;
  
  // Allow custom sort function to handle special cases
  if (customSortFn) {
    return customSortFn(items, sortBy, sortOrder);
  }
  
  // Default sorting logic
  return [...items].sort((a, b) => {
    let valueA = a[sortBy];
    let valueB = b[sortBy];
    
    // Handle dates
    if (sortBy.includes('Date') || sortBy === 'lastLogoff' || sortBy === 'updatedAt' || sortBy === 'createdAt') {
      valueA = valueA ? new Date(valueA).getTime() : 0;
      valueB = valueB ? new Date(valueB).getTime() : 0;
    }
    
    // Handle strings
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return sortOrder === 'asc' 
        ? valueA.localeCompare(valueB) 
        : valueB.localeCompare(valueA);
    }
    
    // Handle numbers and other values
    if (sortOrder === 'asc') {
      return valueA > valueB ? 1 : -1;
    } else {
      return valueA < valueB ? 1 : -1;
    }
  });
};

// Export a default object with all filters and sort options
export default {
  profileFilters,
  profileSortOptions,
  friendFilters,
  friendSortOptions,
  applyFilters,
  applySorting
};
