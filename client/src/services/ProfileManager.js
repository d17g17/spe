/**
 * ProfileManager
 * Handles business logic related to profile operations (separate from API calls)
 */
import { queryClient } from './reactQueryHooks';

class ProfileManager {
  /**
   * Get cached profile data directly from React Query cache
   * @param {string} steamId - The Steam ID to get cached data for
   * @returns {Object|null} - Cached profile data or null if not in cache
   */
  getCachedProfile(steamId) {
    if (!steamId) return null;
    return queryClient.getQueryData(['profile', steamId]);
  }

  /**
   * Invalidate a specific profile in the cache to force a refresh
   * @param {string} steamId - The Steam ID to invalidate
   */
  invalidateProfile(steamId) {
    if (!steamId) return;
    queryClient.invalidateQueries({ queryKey: ['profile', steamId] });
  }

  /**
   * Invalidate all profiles in the cache
   */
  invalidateAllProfiles() {
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
  }

  /**
   * Validate Steam ID format
   * @param {string} input - Input to validate
   * @returns {boolean} - Whether the input is a valid Steam ID
   */
  isValidSteamId(input) {
    // Steam ID is a 17-digit number
    if (/^\d{17}$/.test(input)) {
      return true;
    }
    
    // Check if it's a profile URL
    if (input.includes('steamcommunity.com/profiles/')) {
      const match = input.match(/steamcommunity\.com\/profiles\/(\d+)/);
      return match && match[1] && /^\d{17}$/.test(match[1]);
    }
    
    // Check if it's a vanity URL
    if (input.includes('steamcommunity.com/id/')) {
      return true; // We can't fully validate this client-side, server will resolve
    }
    
    return false;
  }

  /**
   * Extract Steam ID from a profile URL
   * @param {string} input - Input URL or ID
   * @returns {string} - Extracted Steam ID or original input
   */
  extractSteamId(input) {
    // Check if it's a profile URL
    if (input.includes('steamcommunity.com/profiles/')) {
      const match = input.match(/steamcommunity\.com\/profiles\/(\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // For everything else, return the original input
    // The server will handle resolving vanity URLs
    return input;
  }
}

// Create and export a singleton instance
const profileManager = new ProfileManager();
export default profileManager;
