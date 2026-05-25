/**
 * ProfileListManager
 * Handles filtering, sorting, and data transformation for profile lists
 */

/**
 * Filter profiles based on search query and advanced filters
 * @param {Array} profiles - Array of profile objects
 * @param {string} searchQuery - Basic search query to filter by
 * @param {Object} filters - Advanced filters configuration
 * @returns {Array} - Filtered profiles
 */
export function filterProfiles(profiles, searchQuery = '', filters = {}) {
  return profiles.filter(profile => {
    // Basic search query filter
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        profile.steamId?.toLowerCase().includes(query) ||
        profile.name?.toLowerCase().includes(query) ||
        profile.country?.toLowerCase().includes(query) ||
        profile.lastPlayedGame?.toLowerCase().includes(query) ||
        profile.realName?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }
    
    // Apply advanced filters
    for (const [filterId, value] of Object.entries(filters)) {
      // Skip if value is empty/undefined
      if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
        continue;
      }

      switch (filterId) {
        // Avatar filters
        case 'hasAvatar':
          if (value && (!profile.avatarUrl || profile.avatarUrl.includes('fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb'))) {
            return false; // No avatar or default Steam avatar
          }
          break;
        
        // Profile visibility filters  
        case 'isPrivate':
          if (value && profile.communityVisibilityState !== 1) {
            return false; // Not private
          }
          break;
        
        case 'isOnline':
          if (value && (!profile.personaState || profile.personaState === 0)) {
            return false; // Not online
          }
          break;
        
        // Ban-related filters
        case 'hasBans':
          if (value && !profile.vacBanned && !profile.gameBanned && !profile.tradeBanned) {
            return false; // No bans
          }
          break;
        
        case 'hasVacBan':
          if (value && !profile.vacBanned) {
            return false; // No VAC ban
          }
          break;
        
        case 'hasGameBan':
          if (value && !profile.gameBanned) {
            return false; // No game ban
          }
          break;
        
        case 'hasTradeBan':
          if (value && !profile.tradeBanned) {
            return false; // No trade ban
          }
          break;
        
        // Text filters
        case 'hasUsername':
          if (value && (!profile.name || !profile.name.toLowerCase().includes(value.toLowerCase()))) {
            return false; // Username doesn't contain the value
          }
          break;
        
        case 'hasGame':
          if (value && (!profile.lastPlayedGame || !profile.lastPlayedGame.toLowerCase().includes(value.toLowerCase()))) {
            return false; // Last played game doesn't contain the value
          }
          break;
        
        // Numeric filters
        case 'minFriends':
          if (value && (!profile.friendsCount || profile.friendsCount < parseInt(value, 10))) {
            return false; // Friends count is less than the minimum
          }
          break;
        
        case 'minPlaytime':
          // Convert minutes to hours for comparison
          const playtimeInHours = (profile.playtime2Weeks || 0) / 60;
          if (value && playtimeInHours < parseInt(value, 10)) {
            return false; // Playtime is less than the minimum
          }
          break;
        
        // Location filters
        case 'country':
          if (value && (!profile.country || profile.country !== value)) {
            return false; // Country doesn't match
          }
          break;
        
        // CS2 Inventory filters
        case 'hasInventory':
          const hasInventory = profile.cs2Inventory && 
                              profile.cs2Inventory.status === 'checked' && 
                              profile.cs2Inventory.totalValueUsd > 0;
          if (value && !hasInventory) {
            return false; // No available inventory
          }
          break;
        
        case 'minInventoryValue':
          const inventoryValue = profile.cs2Inventory?.totalValueUsd || 0;
          if (value && inventoryValue < parseFloat(value)) {
            return false; // Inventory value is less than the minimum
          }
          break;
        
        // Language/character set filters
        case 'hasCyrillic':
          if (value && !profile.hasCyrillic) {
            return false; // No Cyrillic characters
          }
          break;
        
        default:
          break;
      }
    }
    
    // If we got here, the profile passed all filters
    return true;
  });
}

/**
 * Sort profiles based on sort configuration
 * @param {Array} profiles - Array of profile objects
 * @param {string} advancedSortOption - Sorting option in format 'field_direction'
 * @returns {Array} - Sorted profiles
 */
export function sortProfiles(profiles, advancedSortOption) {
  // If no advanced sort option, return as-is (will be sorted by API)
  if (!advancedSortOption) {
    return [...profiles];
  }
  
  // Parse the advanced sort option
  const [field, direction] = advancedSortOption.split('_');
  
  // Create a copy to sort
  const sorted = [...profiles];
  
  return sorted.sort((a, b) => {
    let valueA, valueB;
    
    // Handle different field types
    switch (field) {
      case 'lastChecked':
        valueA = new Date(a.updatedAt || 0).getTime();
        valueB = new Date(b.updatedAt || 0).getTime();
        break;
      case 'personaname':
        valueA = a.name || '';
        valueB = b.name || '';
        break;
      case 'friends':
        valueA = a.friendsCount || 0;
        valueB = b.friendsCount || 0;
        break;
      case 'level':
        valueA = a.level || 0;
        valueB = b.level || 0;
        break;
      case 'lastLogoff':
        valueA = new Date(a.lastLogoff || 0).getTime();
        valueB = new Date(b.lastLogoff || 0).getTime();
        break;
      case 'lastBadgeDate':
        valueA = new Date(a.lastBadgeDate || 0).getTime();
        valueB = new Date(b.lastBadgeDate || 0).getTime();
        break;
      case 'inventoryValue':
        valueA = (a.inventoryValue !== undefined ? a.inventoryValue : a.inventoryBadge?.value) || 0;
        valueB = (b.inventoryValue !== undefined ? b.inventoryValue : b.inventoryBadge?.value) || 0;
        break;
      default:
        valueA = a[field] || '';
        valueB = b[field] || '';
    }
    
    // Sort based on direction
    if (direction === 'asc') {
      return valueA > valueB ? 1 : -1;
    } else {
      return valueA < valueB ? 1 : -1;
    }
  });
}

/**
 * Generate sort configuration from a column key
 * @param {string} columnKey - Key of the column to sort by
 * @param {Object} currentSortConfig - Current sort configuration
 * @returns {Object} - New sort configuration
 */
export function generateSortConfig(columnKey, currentSortConfig) {
  let direction = 'ASC';
  if (currentSortConfig.key === columnKey && currentSortConfig.direction === 'ASC') {
    direction = 'DESC';
  }
  return { key: columnKey, direction };
}

/**
 * Get formatted ban status for a profile
 * @param {Object} profile - Profile object
 * @returns {Object} - Formatted ban status with counts
 */
export function getFormattedBanStatus(profile) {
  const banCount = [
    profile.vacBanned && 'VAC',
    profile.gameBanned && 'Game',
    profile.tradeBanned && 'Trade'
  ].filter(Boolean).length;
  
  return {
    hasBans: banCount > 0,
    banCount,
    isBanned: profile.vacBanned || profile.gameBanned || profile.tradeBanned,
    types: {
      vac: profile.vacBanned || false,
      game: profile.gameBanned || false,
      trade: profile.tradeBanned || false,
    }
  };
}

// Table column definitions
export const profileColumns = [
  { key: 'avatar', label: 'Avatar', sortable: false },
  { key: 'steamId', label: 'SteamID', sortable: true, isLink: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'country', label: 'Country', sortable: true },
  { key: 'communityVisibilityState', label: 'Visibility', sortable: true },
  { key: 'lastLogoff', label: 'Last Logoff', sortable: true },
  { key: 'friendsCount', label: 'Friends', sortable: true },
  { key: 'lastPlayedGame', label: 'Last Played', sortable: true },
  { key: 'playtime2Weeks', label: '2wk Hours', sortable: true },
  { key: 'lastBadgeDate', label: 'Last Badge', sortable: true },
  { key: 'bans', label: 'Bans', sortable: false }, // Unified ban status
  { key: 'actions', label: 'Actions', sortable: false },
];
