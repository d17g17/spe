/**
 * Friend Statistics Utility
 * Calculates various statistics about friends list
 */

/**
 * Calculate comprehensive friend statistics
 * @param {Array} friends - Array of friend objects
 * @param {Array} filteredFriends - Array of filtered friend objects
 * @returns {Object} - Statistics object
 * 
 * Note: The 'eligible' count represents friends that meet the basic criteria for inventory checking
 * (public profile, no bans, old badge, no recent playtime, offline). This differs from the server's
 * 'totalEligible' in logs, which only counts friends whose inventories were actually processed.
 */
export const calculateFriendStatistics = (friends = [], filteredFriends = [], totalFriendsCount = null) => {
  if (!friends || friends.length === 0) {
    return {
      total: totalFriendsCount || 0,
      showing: 0,
      private: 0,
      eligible: 0,
      over700usd: 0,
      withInventoryData: 0,
      averageInventoryValue: 0,
      totalInventoryValue: 0
    };
  }

  const stats = {
    total: totalFriendsCount || friends.length,
    showing: filteredFriends.length,
    private: 0,
    eligible: 0,
    over700usd: 0,
    withInventoryData: 0,
    averageInventoryValue: 0,
    totalInventoryValue: 0
  };

  let totalInventoryValue = 0;
  let inventoryCount = 0;

  friends.forEach(friend => {
    // Check profile visibility state
    // 1 = Private, 2 = Friends Only, 3 = Public
    if (friend.communityVisibilityState !== 3) {
      stats.private++;
    }

    // Check if friend is eligible (matches server inventory check logic exactly)
    // This logic must match evaluateProfileForInventory() in cs2InventoryService.js
    
    // Check bans first (any ban disqualifies)
    if (friend.vacBanned || friend.gameBanned || friend.tradeBanned) {
      // Not eligible due to bans
    } else if ((parseInt(friend.playtime2Weeks) || 0) > 0) {
      // Not eligible due to recent playtime
    } else if (friend.lastBadgeDate && new Date(friend.lastBadgeDate) >= new Date('2025-01-01')) {
      // Not eligible due to recent badge
    } else if (friend.personaState !== undefined && friend.personaState !== 0) {
      // Not eligible due to being online
    } else if (friend.communityVisibilityState !== 3) {
      // Not eligible due to private profile
    } else {
       // All conditions passed - eligible for inventory check
       stats.eligible++;
     }

    // Check inventory value
    const inventoryValue = getInventoryValue(friend);
    if (inventoryValue !== null && inventoryValue > 0) {
      stats.withInventoryData++;
      totalInventoryValue += inventoryValue;
      inventoryCount++;

      // Check if over $700
      if (inventoryValue >= 700) {
        stats.over700usd++;
      }
    }
  });

  // Calculate averages
  stats.totalInventoryValue = totalInventoryValue;
  stats.averageInventoryValue = inventoryCount > 0 ? totalInventoryValue / inventoryCount : 0;

  return stats;
};

/**
 * Extract inventory value from friend object
 * @param {Object} friend - Friend object
 * @returns {number|null} - Inventory value or null if not available
 */
const getInventoryValue = (friend) => {
  // Check various possible locations for inventory value
  if (friend.inventoryBadge?.value !== undefined && friend.inventoryBadge.value !== null) {
    return parseFloat(friend.inventoryBadge.value) || 0;
  }
  
  if (friend.inventoryValue !== undefined && friend.inventoryValue !== null) {
    return parseFloat(friend.inventoryValue) || 0;
  }
  
  return null;
};

/**
 * Format currency value for display
 * @param {number} value - Numeric value
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * Format percentage for display
 * @param {number} value - Numeric value
 * @param {number} total - Total value for percentage calculation
 * @returns {string} - Formatted percentage string
 */
export const formatPercentage = (value, total) => {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(1)}%`;
};