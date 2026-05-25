/**
 * Profile Service
 * Handles profile-related business logic
 */
const profileRepository = require('../repositories/profileRepository');
const friendshipRepository = require('../repositories/friendshipRepository');
const steamApiService = require('./steamApiService');
const pLimit = require('p-limit').default;
const logger = require('../utils/logger');
const { transformApiProfileToDbModel } = require('./SteamDataTransformer');
const friendProcessingService = require('./FriendProcessingService');
const config = require('../config');
const { isValidSteamId64 } = require('../utils/steam');

/**
 * Get profile data with caching logic
 * @param {string} identifier - SteamID64, profile URL, or vanity URL
 * @param {boolean} forceRefresh - Whether to bypass cache and fetch from API
 * @returns {Promise<Object>} - Profile data with cache status
 */
const getProfile = async (identifier, forceRefresh = false) => {
  // First, resolve the identifier to a Steam ID if needed
  let steamId = null;
  
  // Check if it's already a valid SteamID64 using shared util
  if (isValidSteamId64(identifier)) {
    steamId = identifier;
  } else {
    // Resolve vanity URL or profile URL to SteamID64
    steamId = await steamApiService.resolveSteamId(identifier);
  }
  
  if (!steamId) {
    throw new Error(`Could not resolve identifier: ${identifier}`);
  }
  
  // Check local cache if not forced refresh
  if (!forceRefresh) {
    const cachedProfile = await profileRepository.findBySteamId(steamId);
    
    if (cachedProfile) {
      // Always use cached profile regardless of age to avoid unnecessary Steam API calls
      return {
        ...cachedProfile.dataValues,
        isCached: true,
        fetchStatus: 'OK_Cached'
      };
    }
  }
  
  // Fetch from Steam API if not cached or forced refresh
  const apiProfileData = await steamApiService.getFullProfileData(steamId);
  
  // Transform API data to our DB model format
  const profileData = transformApiProfileToDbModel(apiProfileData);
  
  // Evaluate inventory logic immediate
  const { evaluateProfileForInventory, processInventory } = require('./cs2InventoryService');
  const evalResult = evaluateProfileForInventory(profileData);
  if (evalResult.shouldCheck) {
    processInventory(steamId).catch(()=>{});
  } else {
    processInventory(steamId, evalResult.skipReason).catch(()=>{});
  }
  
  // Save to database
  const { profile } = await profileRepository.createOrUpdate(profileData);
  
  return {
    ...profile.dataValues,
    isCached: false,
    fetchStatus: 'OK_FetchedFromAPI'
  };
};

/**
 * Get all profiles with pagination and sorting
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Profiles with pagination info
 */
const getAllProfiles = async (options = {}) => {
  return await profileRepository.findAll(options);
};

/**
 * Delete a profile by Steam ID
 * @param {string} steamId - The Steam ID to delete
 * @returns {Promise<boolean>} - Whether deletion was successful
 */
const deleteProfile = async (steamId) => {
  return await profileRepository.deleteProfile(steamId);
};

/**
 * Delete all profiles
 * @returns {Promise<number>} - Number of deleted profiles
 */
const deleteAllProfiles = async () => {
  return await profileRepository.deleteAll();
};

/**
 * Get friends of a profile with pagination and sorting
 * @param {string} steamId - The Steam ID to get friends for
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Friends with pagination info
 */
const getProfileFriends = async (steamId, options = {}) => {
  return await friendshipRepository.getFriendsOfProfile(steamId, options);
};

module.exports = {
  getProfile,
  getAllProfiles,
  deleteProfile,
  deleteAllProfiles,
  // Delegate to FriendProcessingService to avoid duplicated logic
  fetchAndProcessFriends: friendProcessingService.fetchAndProcessFriends,
  getProfileFriends
};
