import axios from 'axios';
import { apiCallCircuitBreaker } from './circuitBreaker';

// Determine backend URL. Default to localhost:3002 if not set.
// In a real app, you might use REACT_APP_API_URL from a .env file
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002/api';

// Create an Axios instance with standardized configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds - increased for heavy server load during friend processing
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Export the apiClient for use in other services
export { apiClient };

/**
 * Fetches a profile from the backend.
 * @param {string} identifier - The raw input identifier (SteamID64, vanity name, URL).
 * @param {boolean} [forceRefresh=false] - Whether to bypass cache and force fetch from Steam API.
 * @returns {Promise<object>} - The profile data object.
 * @throws {Error} - Throws error if the backend request fails.
 */
export const fetchProfile = async (identifier, forceRefresh = false) => {
  return await apiCallCircuitBreaker.execute(
    async () => {
      try {
        // Pass the raw identifier, encode it for safety in URL path
        const url = `/api/profiles/fetch/${encodeURIComponent(identifier)}${forceRefresh ? '?force=true' : ''}`;
        const response = await apiClient.get(url);
        
        if (response.data.success === false) {
          throw new Error(response.data.message || 'Backend request failed');
        }
        
        // Handle new response format from the refactored server
        // The actual profile data is now nested inside the 'data' property
        const profile = response.data.data || response.data;
        
        // Map the data to ensure consistency with our component field names
        return {
          // Standardize field names for UI components
          steamId: profile.steamId || profile.steamid,
          name: profile.name,
          avatarUrl: profile.avatarUrl || profile.avatar_url,
          country: profile.country,
          countryCode: profile.country, // Map country to countryCode for component compatibility
          stateCode: profile.locStateCode, // Map locStateCode to stateCode for component compatibility
          locStateCode: profile.locStateCode, // Keep original field name
          locCityId: profile.locCityId, // Keep original field name
          communityVisibilityState: profile.communityVisibilityState || profile.communityvisibilitystate,
          lastLogoff: profile.lastLogoff || profile.lastlogoff,
          friendsCount: profile.friendsCount || profile.friends_count,
          lastPlayedGame: profile.lastPlayedGame || profile.last_played_game,
          playtime2Weeks: profile.playtime2Weeks || profile.playtime_2weeks,
          lastBadgeDate: profile.lastBadgeDate || profile.last_badge_date,
          vacBanned: profile.vacBanned || profile.vac_banned,
          gameBanned: profile.gameBanned || profile.game_banned,
          tradeBanned: profile.tradeBanned || profile.trade_banned,
          notes: profile.notes,
          updatedAt: profile.updatedAt || profile.updated_at,
          // Pass through any other fields
          ...profile
        };
      } catch (error) {

        const errorData = error.response?.data || {};
        throw new Error(errorData.message || error.message || 'Failed to fetch profile from backend.');
      }
    },
    () => {
      // Profile fetch failed, circuit breaker open. Using cached data if available.
      return null; // Return null to indicate failure, React Query will use cached data
    }
  );
};

/**
 * Deletes a profile from the backend's local database cache.
 * @param {string} steamId - The 64-bit Steam ID.
 * @returns {Promise<object>} - The success/error message from the backend.
 * @throws {Error} - Throws error if the backend request fails.
 */
export const deleteLocalProfile = async (steamId) => {
    try {
        const response = await apiClient.delete(`/api/profiles/local/${steamId}`);
        
        // Handle both old and new response formats
        if (response.data.success === true && response.data.data) {
            // New format after refactoring: { success: true, data: { message: '...' } }
            return response.data.data;
        }
        
        // Old format: { success: true, message: '...' }
        return response.data;
    } catch (error) {
        // Add similar detailed error logging if needed
        const errorData = error.response?.data || {};
        throw new Error(errorData.message || 'Failed to delete local profile from backend.');
    }
};

/**
 * (Optional) Fetches a profile directly from the backend's local database cache.
 * @param {string} steamId - The 64-bit Steam ID.
 * @returns {Promise<object>} - The profile data object from the local DB.
 * @throws {Error} - Throws error if the backend request fails.
 */
export const getLocalProfile = async (steamId) => {
    try {
        const response = await apiClient.get(`/api/profiles/local/${steamId}`);
        return response.data;
    } catch (error) {
        const errorData = error.response?.data || {};
        throw new Error(errorData.message || 'Failed to fetch local profile from backend.');
    }
};

/**
 * Fetches all locally stored profiles from the backend.
 * @param {string} [sortBy='updatedAt'] - Field to sort by.
 * @param {string} [sortOrder='DESC'] - Sort order ('ASC' or 'DESC').
 * @returns {Promise<Array>} - An array of profile data objects.
 * @throws {Error} - Throws error if the backend request fails.
 */
export const fetchAllLocalProfiles = async (sortBy = 'updatedAt', sortOrder = 'DESC') => {
    try {
        const url = `/profiles/local/all?sortBy=${encodeURIComponent(sortBy)}&sortOrder=${encodeURIComponent(sortOrder)}`;
        const response = await apiClient.get(url);
        
        if (response.data?.success && Array.isArray(response.data.data)) {
            // Map the data to ensure consistency with our component field names
            return response.data.data.map(profile => ({
                // Standardize field names for UI components
                steamId: profile.steamId || profile.steamid,
                name: profile.name,
                avatarUrl: profile.avatarUrl || profile.avatar_url,
                country: profile.country,
                countryCode: profile.country, // Map country to countryCode for component compatibility
                stateCode: profile.locStateCode, // Map locStateCode to stateCode for component compatibility
                locStateCode: profile.locStateCode, // Keep original field name
                locCityId: profile.locCityId, // Keep original field name
                communityVisibilityState: profile.communityVisibilityState || profile.communityvisibilitystate,
                lastLogoff: profile.lastLogoff || profile.lastlogoff,
                friendsCount: profile.friendsCount || profile.friends_count,
                lastPlayedGame: profile.lastPlayedGame || profile.last_played_game,
                playtime2Weeks: profile.playtime2Weeks || profile.playtime_2weeks,
                lastBadgeDate: profile.lastBadgeDate || profile.last_badge_date,
                vacBanned: profile.vacBanned || profile.vac_banned,
                gameBanned: profile.gameBanned || profile.game_banned,
                tradeBanned: profile.tradeBanned || profile.trade_banned,
                notes: profile.notes,
                updatedAt: profile.updatedAt || profile.updated_at,
                // Pass through any other fields
                ...profile
            }));
        } else {
            throw new Error(response.data?.message || 'Invalid data format received for all profiles.');
        }
    } catch (error) {
        const errorData = error.response?.data || {};
        throw new Error(errorData.message || 'Failed to fetch all local profiles from backend.');
    }
};

/**
 * Fetches all locally stored profiles from the backend with advanced filtering and sorting.
 * @param {string} [sortBy='updatedAt'] - Field to sort by.
 * @param {string} [sortOrder='DESC'] - Sort order ('ASC' or 'DESC').
 * @param {number} [limit=100] - Maximum number of profiles to return.
 * @param {number} [offset=0] - Number of profiles to skip.
 * @param {Object} [filters={}] - Filter criteria to apply server-side.
 * @param {string} [searchQuery=''] - Text search query to apply server-side.
 * @returns {Promise<Object>} - Object containing profiles array and pagination info.
 * @throws {Error} - Throws error if the backend request fails.
 */
export const getAllProfiles = async (
    sortBy = 'updatedAt', 
    sortOrder = 'DESC', 
    limit = 100, 
    offset = 0,
    filters = {},
    searchQuery = ''
) => {
    try {
        // Start with basic sort params
        const params = {
            sortBy,
            sortOrder,
            limit: limit.toString(),
            offset: offset.toString()
        };
        
        // Add search query if provided
        if (searchQuery) {
            params.q = searchQuery;
        }
        
        // Add filters - convert object to JSON string to pass as a single parameter
        if (Object.keys(filters).length > 0) {
            params.filters = JSON.stringify(filters);
        }
        
        // Build query string with all parameters
        const queryParams = new URLSearchParams(params).toString();
        
        const response = await apiClient.get(`/api/profiles/local/all?${queryParams}`);
        
        if (response.data?.success) {
            return {
                profiles: response.data.data || [],
                pagination: response.data.pagination || {}
            };
        }
        
        return response.data; 
    } catch (error) {
        const errorData = error.response?.data || {};
        throw new Error(errorData.message || 'Failed to fetch profiles with filters from backend.');
    }
};

/**
 * Deletes ALL profiles from the backend's local database cache.
 * @returns {Promise<object>} - The success/error message from the backend.
 * @throws {Error} - Throws error if the backend request fails.
 */
export const deleteAllLocalProfilesApi = async () => {
    try {
        const response = await apiClient.delete('/api/profiles/local/all');
        return response.data; // Backend returns { success: true/false, message: ... }
    } catch (error) {
        const errorData = error.response?.data || {};
        throw new Error(errorData.message || 'Failed to delete all local profiles from backend.');
    }
};

/**
 * Triggers the backend process to fetch friend details for a given SteamID,
 * store them, and returns the processed list of friend profiles.
 * @param {string} steamId - The SteamID of the user whose friends to fetch.
 * @returns {Promise<Array>} - An array of friend profile data objects.
 * @throws {Error} - Throws error if the backend request fails.
 */
export const triggerFriendFetch = async (steamId) => {
    try {
        const url = `/api/profiles/friends/${steamId}`;
        const response = await apiClient.get(url);
        if (response.data?.success) {
            return response.data; // Return the success object { success: true, message: ... }
        } else {
            // Handle cases where backend indicates success=false or data is missing/wrong format
        
            throw new Error(response.data?.message || 'Backend indicated failure during friend fetch process.');
        }
    } catch (error) {
        const errorData = error.response?.data || {};
        // Try to return a more specific error message from the backend if available
        throw new Error(errorData.message || 'Failed to fetch friends data from backend.');
    }
};

/**
 * Fetch friends of a profile from the local database.
 * @param {string} steamId - The SteamID of the profile to get friends for
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of friends to return (0 or high value for all friends)
 * @param {number} options.offset - Pagination offset
 * @param {string} options.sortBy - Field to sort by
 * @param {string} options.sortOrder - Sort direction ('ASC' or 'DESC')
 * @returns {Promise<Array>} - An array of friend profile data objects
 */
export const getProfileFriends = async (steamId, options = {}) => {
    // Default limit is now higher to fetch all friends at once in most cases
    const { limit = 1000, offset = 0, sortBy = 'name', sortOrder = 'ASC', useCachedOnly = false } = options;
    
    try {
        const queryParams = new URLSearchParams({
            // If limit is 0, we request a very high number to get all friends
            limit: (limit === 0 ? '10000' : limit.toString()),
            offset: offset.toString(),
            sortBy,
            sortOrder,
            cachedOnly: useCachedOnly.toString() // Add parameter to only use cached data
        }).toString();
        
        const url = `/api/profiles/friends/list/${steamId}?${queryParams}`;
        const response = await apiClient.get(url);
        
        if (response.data?.success) {
            const friendsList = response.data.data || [];
            
            // Map the friends data to ensure consistency with component field names
            const mappedFriends = friendsList.map(friend => ({
                // Standardize field names for UI components
                steamId: friend.steamId || friend.steamid,
                name: friend.name,
                avatarUrl: friend.avatarUrl || friend.avatar_url,
                country: friend.country,
                countryCode: friend.country, // Map country to countryCode for component compatibility
                stateCode: friend.locStateCode, // Map locStateCode to stateCode for component compatibility
                locStateCode: friend.locStateCode, // Keep original field name
                locCityId: friend.locCityId, // Keep original field name
                communityVisibilityState: friend.communityVisibilityState || friend.communityvisibilitystate,
                lastLogoff: friend.lastLogoff || friend.lastlogoff,
                friendsCount: friend.friendsCount || friend.friends_count,
                lastPlayedGame: friend.lastPlayedGame || friend.last_played_game,
                playtime2Weeks: friend.playtime2Weeks || friend.playtime_2weeks,
                lastBadgeDate: friend.lastBadgeDate || friend.last_badge_date,
                vacBanned: friend.vacBanned || friend.vac_banned,
                gameBanned: friend.gameBanned || friend.game_banned,
                tradeBanned: friend.tradeBanned || friend.trade_banned,
                updatedAt: friend.updatedAt || friend.updated_at,
                // Pass through any other fields
                ...friend
            }));
            
            return {
                friends: mappedFriends,
                pagination: response.data.pagination || {
                    total: friendsList.length,
                    offset: parseInt(offset),
                    limit: parseInt(limit)
                }
            };
        } else {
        
            throw new Error(response.data?.message || 'Backend indicated failure retrieving friends.');
        }
    } catch (error) {
        const errorData = error.response?.data || {};
        throw new Error(errorData.message || 'Failed to get friends list from backend.');
    }
};

/**
 * Fetches a CS2 inventory for a given SteamID.
 * @param {string} steamId - The SteamID of the user whose CS2 inventory to fetch.
 * @returns {Promise<object>} - The CS2 inventory data object.
 * @throws {Error} - Throws error if the backend request fails.
 */
export async function fetchCS2Inventory(steamId) {
  // Trigger processing and return result
  const response = await apiClient.post(`/api/profiles/profile/${steamId}/cs2-inventory/fetch`);
  return response.data?.data || response.data;
}

/**
 * Fetches a CS2 inventory for a given SteamID.
 * @param {string} steamId - The SteamID of the user whose CS2 inventory to fetch.
 * @returns {Promise<object>} - The CS2 inventory data object.
 * @throws {Error} - Throws error if the backend request fails.
 */
export async function getCS2Inventory(steamId) {
  const response = await apiClient.get(`/api/profiles/profile/${steamId}/cs2-inventory`);
  return response.data?.data || response.data;
}

/**
 * Fetches the current CS2 inventory processing stats.
 * @returns {Promise<object>} - The stats object containing metrics like active and total checks.
 * @throws {Error} - Throws error if the backend request fails.
 */
export async function getCS2InventoryStats() {
  try {
    const response = await apiClient.get('/api/cs2-inventory/stats');
    return response.data?.data || response.data;
  } catch (error) {

    throw new Error('Failed to fetch inventory stats');
  }
}

/**
 * Fetches SteamIDs of profiles from a given list that have an inventory status of 'error'.
 * @param {Array<string>} steamIds - A list of SteamIDs to check.
 * @returns {Promise<Array<string>>} - A list of SteamIDs from the input that have errors.
 * @throws {Error} - Throws error if the backend request fails.
 */
export const getProfilesWithInventoryErrors = async (steamIds) => {
  if (!steamIds || steamIds.length === 0) {

    return []; // No need to make an API call if the list is empty
  }
  try {
    // Changed to POST and sending steamIds in the body
    const response = await apiClient.post('/api/profiles/with-inventory-errors', { steamIds });
    if (response.data?.success) {
      return response.data.data || []; // Expecting an array of SteamIDs
    }
    throw new Error(response.data?.message || 'Failed to fetch profiles with inventory errors.');
  } catch (error) {

    const errorData = error.response?.data || {};
    throw new Error(errorData.message || error.message || 'Failed to retrieve profiles with inventory errors.');
  }
};

/**
 * Export all item prices as JSON
 * @returns {Promise<object>} - The export data containing all item prices
 * @throws {Error} - Throws error if the backend request fails
 */
export const exportItemPrices = async () => {
  try {
    const response = await apiClient.get('/api/item-prices/export');
    return response.data;
  } catch (error) {
    const errorData = error.response?.data || {};
    throw new Error(errorData.message || 'Failed to export item prices.');
  }
};

/**
 * Import item prices from JSON data
 * @param {Array} itemPrices - Array of item price objects
 * @param {boolean} overwriteExisting - Whether to overwrite existing prices
 * @returns {Promise<object>} - Import results with counts
 * @throws {Error} - Throws error if the backend request fails
 */
export const importItemPrices = async (itemPrices, overwriteExisting = false) => {
  try {
    const response = await apiClient.post('/api/item-prices/import', {
      itemPrices,
      overwriteExisting
    });
    return response.data;
  } catch (error) {
    const errorData = error.response?.data || {};
    throw new Error(errorData.message || 'Failed to import item prices.');
  }
};

/**
 * Get item price statistics
 * @returns {Promise<object>} - Statistics about item prices in the database
 * @throws {Error} - Throws error if the backend request fails
 */
export const getItemPriceStats = async () => {
  try {
    const response = await apiClient.get('/api/item-prices/stats');
    return response.data;
  } catch (error) {
    const errorData = error.response?.data || {};
    throw new Error(errorData.message || 'Failed to get item price statistics.');
  }
};

/**
 * Clear all item prices from the database
 * @returns {Promise<object>} - Result of the clear operation
 * @throws {Error} - Throws error if the backend request fails
 */
export const clearItemPrices = async () => {
  try {
    const response = await apiClient.delete('/api/item-prices/clear');
    return response.data;
  } catch (error) {
    const errorData = error.response?.data || {};
    throw new Error(errorData.message || 'Failed to clear item prices.');
  }
};