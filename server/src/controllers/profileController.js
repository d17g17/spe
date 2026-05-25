/**
 * Profile Controller
 * Handles HTTP requests for profile-related operations
 */
const profileService = require('../services/profileService');
const webSocketService = require('../services/WebSocketService');
const responseFormatter = require('../services/ResponseFormatterService');
const logger = require('../utils/logger');
const { isValidSteamId64 } = require('../utils/steam');
const profileRepository = require('../repositories/profileRepository');

/**
 * Fetches profile: Checks local DB cache first, then Steam API if stale/missing or forced.
 * Stores/updates local DB on Steam API fetch.
 */
const getProfileBySteamId = async (req, res) => {
  const { identifier } = req.params;
  const forceRefresh = req.query.force === 'true';
  
  logger.info('PROFILE_API', `Fetch request for ${identifier} from ${req.ip}`);

  if (!identifier) {
    logger.warn('PROFILE_API', `Invalid Steam ID: ${identifier} from ${req.ip}`);
    return res.status(400).json({ success: false, message: 'Identifier cannot be empty.' });
  }

  try {
    const profileData = await profileService.getProfile(identifier, forceRefresh);
    logger.success('PROFILE_API', `Profile fetched for ${profileData.steamId}${profileData.fromCache ? ' (cached)' : ''}`);
    
    // Use ResponseFormatterService for consistent formatting
    const formattedProfile = responseFormatter.formatProfile(profileData);
    return res.status(200).json(responseFormatter.success(formattedProfile));
  } catch (error) {
    logger.error('PROFILE_API', `Fetch error for ${identifier}: ${error.message}`);
    return res.status(500).json(responseFormatter.error('Failed to fetch profile data', error));
  }
};

/**
 * Deletes a profile from the local database.
 */
const deleteProfileFromDb = async (req, res) => {
  const { steamId } = req.params;
  
  
  
  if (!steamId) {
    return res.status(400).json({ success: false, message: 'SteamID is required' });
  }
  
  try {
    const deleted = await profileService.deleteProfile(steamId);
    
    if (deleted) {
      logger.info('Controller', `Profile ${steamId} deleted successfully`);
      return res.status(200).json(responseFormatter.success(null, `Profile ${steamId} deleted successfully`));
    } else {
      logger.warn('Controller', `Profile ${steamId} not found`);
      return res.status(404).json(responseFormatter.error(`Profile ${steamId} not found`));
    }
  } catch (error) {
    logger.error('Controller', `Error deleting profile ${steamId}:`, error);
    return res.status(500).json(responseFormatter.error('Failed to delete profile', error));
  }
};

/**
 * Retrieves all profiles from the local database with filtering and sorting.
 */
const getAllProfilesFromDb = async (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  logger.info('Controller', `Retrieving filtered profiles from database`);
  
  // Extract query parameters for sorting, pagination, filtering and search
  let {
    sortBy = 'updatedAt',
    sortOrder = 'DESC',
    limit = 100,
    offset = 0,
    filters = '{}',
    q = ''
  } = req.query;
  
  // Handle composite sort params (e.g., inventoryValue_desc)
  if (sortBy.includes('_')) {
    const parts = sortBy.split('_');
    sortBy = parts[0];
    sortOrder = parts[1].toUpperCase();
    logger.debug('Controller', `Split composite sort parameter: ${sortBy}, ${sortOrder}`);
  }
  
  // Parse the filters JSON
  let parsedFilters = {};
  try {
    if (filters && filters !== '{}') {
      parsedFilters = JSON.parse(filters);
      logger.debug('Controller', `Applied filters: ${Object.keys(parsedFilters).join(', ')}`);
    }
  } catch (err) {
    logger.warn('Controller', `Invalid filters JSON: ${filters}`);
    return res.status(400).json(responseFormatter.error('Invalid filters format'));
  }
  
  try {
    const { profiles, pagination } = await profileService.getAllProfiles({
      sortBy,
      sortOrder,
      limit,
      offset,
      filters: parsedFilters,
      searchQuery: q
    });
    
    logger.info('Controller', `Retrieved ${profiles.length} profiles from total of ${pagination.total}`);
    
    // Use the ResponseFormatterService to format profiles and pagination
    const formattedProfiles = responseFormatter.formatProfiles(profiles);
    const formattedPagination = responseFormatter.formatPagination(pagination);
    
    return res.status(200).json(responseFormatter.success(
      formattedProfiles, 
      `Retrieved ${profiles.length} profiles`, 
      { 
        pagination: formattedPagination,
        appliedFilters: Object.keys(parsedFilters),
        appliedSearch: q ? true : false
      }
    ));
  } catch (error) {
    logger.error('Controller', `Error retrieving filtered profiles:`, error);
    return res.status(500).json(responseFormatter.error('Failed to retrieve profiles', error));
  }
};

/**
 * Deletes all profiles from the local database.
 */
const deleteAllProfilesFromDb = async (req, res) => {
  
  
  try {
    const deletedCount = await profileService.deleteAllProfiles();
    
    logger.info('Controller', `Deleted ${deletedCount} profiles`);
    return res.status(200).json(responseFormatter.success(
      { deletedCount }, 
      `Successfully deleted ${deletedCount} profiles.`
    ));
  } catch (error) {
    logger.error('Controller', `Error deleting all profiles:`, error);
    return res.status(500).json(responseFormatter.error('Failed to delete all profiles', error));
  }
};

/**
 * Fetches friend list, processes them, and triggers storage in the local DB.
 */
const fetchAndStoreFriends = async (req, res) => {
  const { steamId } = req.params;
  const globalStartTime = Date.now();
  
  logger.info('Controller', `Starting friend fetch process for SteamID: ${steamId}`);

  if (!steamId || !isValidSteamId64(steamId)) {
    return res.status(400).json(responseFormatter.error('Invalid base SteamID format'));
  }

  try {
    // Get Socket.io instance from express app and pass to WebSocketService if not already initialized
    const io = req.app.get('io');
    if (!webSocketService.io) {
      webSocketService.initialize(io);
    }

    // First return success response to client
    const responseTime = Date.now() - globalStartTime;
    res.status(200).json(responseFormatter.success(
      null,
      `Fetching complete information for all friends in background`,
      {
        hasPendingFetches: true,
        responseTimeMs: responseTime
      }
    ));
    
    // Then process friends in background
    setTimeout(async () => {
      try {
        // Initialize progress tracking via WebSocket service
        webSocketService.startFriendFetch(steamId);
        
        // Process friends
        const result = await profileService.fetchAndProcessFriends(steamId);
        
        // Update friend count in the main profile BEFORE sending completion event
        // This ensures the database is updated when clients refetch data
        try {
          const friendCount = result.totalFriends || 0;
          await profileRepository.updateFriendCount(steamId, friendCount);
          logger.info('Controller', `Updated friend count to ${friendCount} for profile ${steamId}`);
        } catch (error) {
          logger.warn('Controller', `Error updating friend count: ${error.message}`);
        }
        
        // Create completion data
        const completionData = {
          steamId,
          success: result.success,
          message: result.message,
          totalFriends: result.totalFriends,
          processedFriends: result.processedFriends,
          successCount: result.successCount,
          enhancedDataCount: result.enhancedDataCount,
          metrics: {
            totalProcessingTimeMs: result.metrics?.totalProcessingTimeMs || 0,
            avgFriendProcessingTimeMs: result.metrics?.avgFriendProcessingTimeMs || 0,
            batchCount: result.metrics?.batchCount || 0,
            slowestBatchTimeMs: result.metrics?.slowestBatchTimeMs || 0,
            batchOverheadPercent: result.metrics?.batchOverheadPercent || 0,
            avgBatchProcessingTimeMs: result.metrics?.avgBatchProcessingTimeMs || 0
          }
        };
        
        // Complete the friend fetch process with the WebSocket service
        webSocketService.completeFriendFetch(steamId, completionData);
        
        logger.info('Controller', `Friend fetch process completed for ${steamId}`);
      } catch (error) {
        logger.error('Controller', `Background friend processing error for ${steamId}:`, error.message);
        
        // Handle error with WebSocket service
        webSocketService.errorFriendFetch(steamId, error);
      }
    }, 100); // Short delay to ensure response is sent first
  } catch (error) {
    logger.error('Controller', `Friend fetch process error for ${steamId}:`, error.message);
    return res.status(500).json(responseFormatter.error('Failed to start friend fetch process', error));
  }
};

/**
 * Retrieves a profile directly from the local database.
 */
const getLocalProfile = async (req, res) => {
  const { steamId } = req.params;
  
  if (!steamId) {
    return res.status(400).json(responseFormatter.error('SteamID is required'));
  }
  
  try {
    const profileData = await profileService.getProfile(steamId, false);
    
    if (!profileData) {
      return res.status(404).json(responseFormatter.error(`Profile ${steamId} not found.`));
    }
    
    // Format the profile data using ResponseFormatterService to include inventoryBadge
    const formattedProfile = responseFormatter.formatProfile(profileData);
    
    return res.status(200).json(responseFormatter.success(formattedProfile));
  } catch (error) {
    return res.status(500).json(responseFormatter.error('Failed to retrieve profile', error));
  }
};

/**
 * Retrieves the friends of a profile.
 */
const getProfileFriends = async (req, res) => {
  const { steamId } = req.params;
  const { 
    limit = 50, 
    offset = 0, 
    sortBy = 'name', 
    sortOrder = 'ASC',
    cachedOnly = 'false' // New parameter for cached-only mode
  } = req.query;
  
  // Set explicit CORS headers for friends endpoint
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (!steamId) {
    return res.status(400).json({ success: false, message: 'SteamID is required' });
  }
  
  try {
    // Convert cachedOnly from string to boolean
    const useCachedOnly = cachedOnly === 'true';
    

    
    const { friends, pagination } = await profileService.getProfileFriends(steamId, {
      limit, 
      offset, 
      sortBy, 
      sortOrder,
      useCachedOnly // Pass the parameter to the service
    });
    
    
    
    return res.status(200).json({
      success: true,
      data: friends,
      pagination
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch friends',
      error: error.message
    });
  }
};

/**
 * Retrieves SteamIDs from a provided list that have an inventory status of 'error'.
 * Expects a JSON body with a "steamIds" array.
 */
const getProfilesWithInventoryErrors = async (req, res) => {
  const { steamIds } = req.body;

  if (!steamIds || !Array.isArray(steamIds) || steamIds.length === 0) {
    return res.status(400).json(responseFormatter.error('Invalid request: steamIds array is required in the body.'));
  }

  logger.info('PROFILE_API', `Fetching inventory errors for ${steamIds.length} provided SteamIDs`);
  try {
    const erroredSteamIds = await profileRepository.findSteamIdsWithInventoryErrorInList(steamIds);
    logger.info('Controller', `Found ${erroredSteamIds.length} profiles with inventory errors from the provided list.`);
    return res.status(200).json(responseFormatter.success(erroredSteamIds));
  } catch (error) {
    logger.error('Controller', 'Error fetching profiles with inventory errors from list:', error);
    return res.status(500).json(responseFormatter.error('Failed to retrieve profiles with inventory errors from list', error));
  }
};

/**
 * Updates a profile's notes field
 */
const updateProfileNotes = async (req, res) => {
  const { steamId } = req.params;
  const { notes } = req.body;
  
  if (!steamId) {
    return res.status(400).json(responseFormatter.error('SteamID is required'));
  }
  
  try {
    // First check if profile exists
    const existingProfile = await profileRepository.findBySteamId(steamId);
    if (!existingProfile) {
      return res.status(404).json(responseFormatter.error(`Profile ${steamId} not found`));
    }
    
    // Update the notes field
    const { profile } = await profileRepository.createOrUpdate({
      steamId,
      notes: notes || null
    });
    
    logger.info('Controller', `Updated notes for profile ${steamId}`);
    
    // Format the profile data using ResponseFormatterService
    const formattedProfile = responseFormatter.formatProfile(profile);
    
    return res.status(200).json(responseFormatter.success(formattedProfile, 'Profile notes updated successfully'));
  } catch (error) {
    logger.error('Controller', `Error updating notes for profile ${steamId}:`, error);
    return res.status(500).json(responseFormatter.error('Failed to update profile notes', error));
  }
};

module.exports = {
  getProfileBySteamId,
  deleteProfileFromDb,
  getAllProfilesFromDb,
  deleteAllProfilesFromDb,
  fetchAndStoreFriends,
  getLocalProfile,
  getProfileFriends,
  getProfilesWithInventoryErrors,
  updateProfileNotes
};
