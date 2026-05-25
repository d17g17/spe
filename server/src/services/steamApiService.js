/**
 * SteamApiService
 * Orchestrates access to Steam API with separate layers for API calls and data transformation
 */
const SteamApiClient = require('./SteamApiClient');
const SteamDataTransformer = require('./SteamDataTransformer');
const BatchOperationService = require('./BatchOperationService');
const logger = require('../utils/logger');

// Re-export this class for backward compatibility with existing code
class SteamApiService {
  /**
   * Check if a string is a valid SteamID64
   * @param {string} steamId - Steam ID to check
   * @returns {boolean} - Whether it's a valid SteamID64
   */
  isValidSteamId64(steamId) {
    return SteamApiClient.isValidSteamId64(steamId);
  }

  /**
   * Extract SteamID64 from different formats (profile URL, vanity URL, etc.)
   * @param {string} identifier - Input identifier (URL, SteamID, etc)
   * @returns {Promise<string>} - Resolved SteamID64
   */
  async resolveSteamId(identifier) {
    return await SteamDataTransformer.resolveSteamId(identifier, SteamApiClient);
  }

  /**
   * Get player summaries (basic profile information)
   * @param {string} steamId - Steam ID to fetch
   * @returns {Promise<Object>} - Player summary data
   */
  async getPlayerSummaries(steamId) {
    return await SteamApiClient.getPlayerSummary(steamId);
  }

  /**
   * Get player summaries in batch (basic profile information for multiple users)
   * @param {string[]} steamIds - Array of Steam IDs
   * @returns {Promise<Object>} - Object with steamId keys mapping to player summaries
   */
  async getPlayerSummariesBatch(steamIds) {
    return await SteamApiClient.getPlayerSummariesBatch(steamIds);
  }

  /**
   * Get player's friend list
   * @param {string} steamId - Steam ID to fetch friends for
   * @returns {Promise<Array>} - Array of friend objects
   */
  async getFriendList(steamId) {
    return await SteamApiClient.getFriendList(steamId);
  }

  /**
   * Get player's owned games
   * @param {string} steamId - Steam ID to fetch games for
   * @returns {Promise<Array>} - Array of game objects
   */
  async getOwnedGames(steamId) {
    return await SteamApiClient.getOwnedGames(steamId);
  }

  /**
   * Get player's recently played games
   * @param {string} steamId - Steam ID to fetch recent games for
   * @returns {Promise<Object>} - Recent games data
   */
  async getRecentlyPlayedGames(steamId) {
    return await SteamApiClient.getRecentlyPlayedGames(steamId);
  }

  /**
   * Get player ban information
   * @param {string} steamId - Steam ID to fetch ban info for
   * @returns {Promise<Object>} - Ban information
   */
  async getPlayerBans(steamId) {
    return await SteamApiClient.getPlayerBans(steamId);
  }

  /**
   * Get player ban information in batch for multiple users
   * @param {string[]} steamIds - Array of Steam IDs
   * @returns {Promise<Object>} - Object with steamId keys mapping to ban information
   */
  async getPlayerBansBatch(steamIds) {
    return await SteamApiClient.getPlayerBansBatch(steamIds);
  }

  /**
   * Get player's badges
   * @param {string} steamId - Steam ID to fetch badges for
   * @returns {Promise<Array>} - Array of badge objects
   */
  async getPlayerBadges(steamId) {
    return await SteamApiClient.getPlayerBadges(steamId);
  }

  /**
   * Helper method to extract games array from different response formats
   * @param {Object|Array} gamesData - The response from Steam API
   * @returns {Array} - Extracted games array
   */
  extractGamesArray(gamesData) {
    return SteamDataTransformer.extractGamesArray(gamesData);
  }



  /**
   * Fetch complete profile data for a user
   * @param {string} identifier - SteamID64, profile URL, or vanity URL
   * @returns {Promise<Object>} - Complete profile data
   */
  async getFullProfileData(identifier) {
    try {
      logger.info('Steam', `Fetching full profile data for: ${identifier}`);
      
      // First resolve the identifier to a SteamID64
      const steamId = await this.resolveSteamId(identifier);
      
      // Use the data transformer to build the full profile
      return await SteamDataTransformer.buildFullProfileData(steamId, SteamApiClient);
    } catch (error) {
      logger.error('Steam', `Failed to build complete profile: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SteamApiService();
