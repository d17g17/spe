/**
 * ResponseFormatterService
 * Standardizes API responses across the application
 */

class ResponseFormatterService {
  /**
   * Format a profile for API response
   * @param {Object} profile - Profile data from the database or service
   * @returns {Object} - Standardized profile format
   */
  formatProfile(profile) {
    if (!profile) return null;

    const {
      steamId,
      name = '',
      avatarUrl = '',
      realName = '',
      profileUrl = '',
      country = '',
      locStateCode = '',
      locCityId = null,
      communityVisibilityState,
      profileState,
      personaState,
      lastLogoff,
      updatedAt,
      createdAt,
      friendsCount = 0,
      lastPlayedGame = '',
      playtime2Weeks = 0,
      lastBadgeDate,
      vacBanned = false,
      gameBanned = false,
      tradeBanned = false,
      hasCyrillic = false,
      notes = null,
      isCached,
      fetchStatus
    } = profile;

    // Inventory badge data if present (either from direct properties or from cs2Inventory relation)
    let inventoryBadge;
    if (profile.inventoryStatus || profile.inventoryValue !== undefined) {
      // Direct properties format
      const { inventoryStatus, inventoryValue, inventorySkipReason, inventoryLastChecked, inventoryHas2025ServiceMedal } = profile;
      inventoryBadge = {
        status: inventoryStatus,
        value: inventoryValue,
        skipReason: inventorySkipReason,
        lastChecked: inventoryLastChecked,
        has2025ServiceMedal: inventoryHas2025ServiceMedal
      };
    } else if (profile.cs2Inventory) {
      // Using cs2Inventory relation
      const { status, totalValueUsd, skipReason, lastChecked, has2025ServiceMedal } = profile.cs2Inventory;
      inventoryBadge = {
        status: status,
        value: totalValueUsd,
        skipReason: skipReason,
        lastChecked: lastChecked,
        has2025ServiceMedal: has2025ServiceMedal
      };
    }

    return {
      // Core identification
      steamId,
      name,
      avatarUrl,
      realName,
      profileUrl,

      // Location information
      country,
      locStateCode,
      locCityId,

      // Status and visibility
      communityVisibilityState,
      profileState,
      personaState,

      // Timing information
      lastLogoff: lastLogoff?.toISOString?.() || null,
      updatedAt: updatedAt?.toISOString?.() || null,
      createdAt: createdAt?.toISOString?.() || null,

      // Friend information
      friendsCount,

      // Gaming information
      lastPlayedGame,
      playtime2Weeks,
      lastBadgeDate: lastBadgeDate?.toISOString?.() || null,

      // Ban information
      vacBanned,
      gameBanned,
      tradeBanned,

      // Other information
      hasCyrillic,
      notes,

      // Optional flags
      ...(isCached !== undefined ? { isCached } : {}),
      ...(fetchStatus !== undefined ? { fetchStatus } : {}),
      ...(inventoryBadge ? { inventoryBadge } : {})
    };
  }

  /**
   * Format multiple profiles for API response
   * @param {Array<Object>} profiles - Array of profile data
   * @returns {Array<Object>} - Array of standardized profiles
   */
  formatProfiles(profiles) {
    if (!profiles || !Array.isArray(profiles)) return [];
    return profiles.map(profile => this.formatProfile(profile));
  }

  /**
   * Create a standardized success response
   * @param {Object|Array|string} data - Response data
   * @param {string} message - Success message
   * @param {Object} meta - Additional metadata
   * @returns {Object} - Standardized success response
   */
  success(data = null, message = 'Operation successful', meta = {}) {
    return {
      success: true,
      message,
      ...(data !== null ? { data } : {}),
      ...meta
    };
  }

  /**
   * Create a standardized error response
   * @param {string} message - Error message
   * @param {Error} error - Original error
   * @param {Object} meta - Additional metadata
   * @returns {Object} - Standardized error response
   */
  error(message = 'An error occurred', error = null, meta = {}) {
    return {
      success: false,
      message,
      ...(error ? { errorMessage: error.message } : {}),
      ...meta
    };
  }

  /**
   * Format pagination metadata for list responses
   * @param {Object} pagination - Pagination data
   * @returns {Object} - Formatted pagination info
   */
  formatPagination(pagination) {
    return {
      total: pagination.total || 0,
      limit: pagination.limit || 10,
      offset: pagination.offset || 0,
      hasMore: pagination.hasMore || false,
      page: pagination.page || 1,
      totalPages: pagination.totalPages || 1
    };
  }
}

module.exports = new ResponseFormatterService();
