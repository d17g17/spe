/**
 * FriendsManager
 * Handles business logic related to profile friends operations
 */
import { queryClient } from './reactQueryHooks';
import { fetchProfile } from './api';

class FriendsManager {
  /**
   * Refresh a specific friend's profile data
   * @param {Object} options - Options for refreshing a friend
   * @param {string} options.steamId - The Steam ID of the friend to refresh
   * @param {Function} [options.onStart] - Optional callback when refresh starts
   * @param {Function} [options.onSuccess] - Optional callback when refresh succeeds
   * @param {Function} [options.onError] - Optional callback when refresh fails
   * @returns {Promise<Object>} - Result of the refresh operation
   */
  async refreshFriend({ steamId, onStart, onSuccess, onError }) {
    try {
      if (onStart) onStart();
      
      // Force refresh from Steam API
      const result = await fetchProfile(steamId, true);
      
      // Invalidate any queries related to this friend's data
      this.invalidateFriendQueries(steamId);
      
      if (onSuccess) onSuccess(result);
      return result;
    } catch (error) {
      if (onError) onError(error);
      throw error;
    }
  }
  
  /**
   * Invalidate queries related to a specific friend
   * @param {string} friendId - The Steam ID of the friend
   */
  invalidateFriendQueries(friendId) {

    
    // Invalidate specific friend data
    queryClient.invalidateQueries(['profile', friendId]);
    
    // Invalidate friend lists that might contain this friend
    queryClient.invalidateQueries(['friends']);
    queryClient.invalidateQueries(['profileFriends']);
    
    // Force refetch of this specific friend profile
    queryClient.refetchQueries(['profile', friendId]);
  }
  
  /**
   * Get processing status for a list of friends
   * @param {Array} friends - List of friend profiles
   * @returns {Object} - Status counts
   */
  getFriendsProcessingStatus(friends = []) {
    if (!friends || !friends.length) {
      return {
        total: 0,
        private: 0,
        public: 0,
        processed: 0,
        percentage: 0
      };
    }
    
    const total = friends.length;
    const private_count = friends.filter(f => f.communityVisibilityState === 1).length;
    const public_count = total - private_count;
    const processed = friends.filter(f => f.processed === true).length;
    

    
    return {
      total,
      private: private_count,
      public: public_count,
      processed,
      percentage: total > 0 ? Math.round((processed / total) * 100) : 0
    };
  }
  
  /**
   * Sort friends list by specified criteria
   * @param {Array} friends - List of friend profiles
   * @param {string} sortBy - Field to sort by
   * @param {string} sortOrder - Sort order ('asc' or 'desc')
   * @returns {Array} - Sorted friends list
   */
  sortFriends(friends = [], sortBy = 'inventoryValue', sortOrder = 'desc') {
    if (!friends || !friends.length) return [];
    
    const sortedFriends = [...friends];
    
    // Determine sort function based on field type
    return sortedFriends.sort((a, b) => {
      let valueA, valueB;
      
      // Handle different field types
      switch (sortBy) {
        case 'lastLogoff':
          valueA = new Date(a.lastLogoff || 0).getTime();
          valueB = new Date(b.lastLogoff || 0).getTime();
          break;
        case 'friendsCount':
          valueA = a.friendsCount || 0;
          valueB = b.friendsCount || 0;
          break;
        case 'inventoryValue':
          valueA = a.inventoryValue || 0;
          valueB = b.inventoryValue || 0;
          break;
        case 'name':
          valueA = a.name || '';
          valueB = b.name || '';
          break;
        case 'personaState':
          valueA = a.personaState || 0;
          valueB = b.personaState || 0;
          break;
        default:
          valueA = a[sortBy] || '';
          valueB = b[sortBy] || '';
      }
      
      // Determine sort direction
      const directionModifier = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
      
      // Compare values
      if (valueA < valueB) return -1 * directionModifier;
      if (valueA > valueB) return 1 * directionModifier;
      return 0;
    });
  }
  
  /**
   * Filter friends list by specified criteria
   * @param {Array} friends - List of friend profiles
   * @param {Object} filters - Filter criteria
   * @returns {Array} - Filtered friends list
   */
  filterFriends(friends = [], filters = {}) {
    if (!friends || !friends.length) return [];
    if (!filters || Object.keys(filters).length === 0) return friends;
    
    return friends.filter(friend => {
      // Check each filter criterion
      for (const [key, value] of Object.entries(filters)) {
        switch (key) {
          case 'isOnline':
            if (value && (!friend.personaState || friend.personaState === 0)) {
              return false;
            }
            break;
          case 'hasAvatar':
            if (value && (!friend.avatarUrl || friend.avatarUrl.includes('fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb'))) {
              return false;
            }
            break;
          case 'isPrivate':
            if (value && friend.communityVisibilityState !== 1) {
              return false;
            }
            break;
          case 'nameContains':
            if (value && (!friend.name || !friend.name.toLowerCase().includes(value.toLowerCase()))) {
              return false;
            }
            break;
          case 'countryCode':
            if (value && (!friend.country || friend.country !== value)) {
              return false;
            }
            break;
          default:
            // Handle numeric comparisons
            if (key.startsWith('min') && typeof value === 'number') {
              const fieldKey = key.substring(3,4).toLowerCase() + key.substring(4);
              if (friend[fieldKey] === undefined || friend[fieldKey] < value) {
                return false;
              }
            }
            break;
        }
      }
      
      // If all filters passed, include the friend
      return true;
    });
  }

  /**
   * Delete a friend's profile and update the cache
   * @param {Object} options - Options for deleting a friend
   * @param {string} options.steamId - The Steam ID of the friend to delete
   * @param {Function} options.deleteProfile - Delete profile mutation function
   * @param {Function} [options.onSuccess] - Optional callback when deletion succeeds
   * @param {Function} [options.onError] - Optional callback when deletion fails
   */
  deleteFriend({ steamId, deleteProfile, onSuccess, onError }) {
    if (!steamId) {
      return;
    }
    
    deleteProfile(steamId, {
      onSuccess: (data) => {
  
        // Invalidate related queries
        this.invalidateFriendQueries(steamId);
        
        // Invalidate the profile friends list to refresh UI
        queryClient.invalidateQueries(['profileFriends']);
        
        if (onSuccess) onSuccess(data);
      },
      onError: (error) => {
         if (onError) onError(error);
       }
    });
  }

  /**
   * Update filter state based on filter ID and value
   * @param {Object} prevState - Previous filter state
   * @param {string} filterId - Filter ID to update
   * @param {any} value - New filter value
   * @returns {Object} - Updated filter state
   */
  updateFilterState(prevState, filterId, value) {
    // If value is falsy, remove the filter
    if (!value) {
      const newState = {...prevState};
      delete newState[filterId];
      return newState;
    }
    // Otherwise, add/update the filter
    return {...prevState, [filterId]: value};
  }
}

// Create and export a singleton instance
const friendsManager = new FriendsManager();
export default friendsManager;
