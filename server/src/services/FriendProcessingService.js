/**
 * FriendProcessingService
 * Handles all operations related to friend fetching and processing
 */
const profileRepository = require('../repositories/profileRepository');
const friendshipRepository = require('../repositories/friendshipRepository');
const steamApiService = require('./steamApiService');
const { transformApiProfileToDbModel } = require('./SteamDataTransformer');
const logger = require('../utils/logger');
const profileProxyManager = require('./profileProxyManager');
const config = require('../config');
const pLimit = require('p-limit').default; // local limiter for friend processing
const requestLimiter = require('../utils/requestLimiter');
const { processInventory, evaluateProfileForInventory } = require('./cs2InventoryService');

// Centralised config
const MAX_CONCURRENCY = config.steam.maxConcurrency;
const DEFAULT_BATCH_SIZE = config.batch.defaultBatchSize;

/**
 * Process inventory with retry mechanism for failed attempts
 * @param {string} steamId - The Steam ID to process
 * @param {number} retryCount - Current retry attempt (0-based)
 * @param {number} maxRetries - Maximum number of retries (default: 2)
 * @returns {Promise} - Promise that resolves with inventory result
 */
async function processInventoryWithRetry(steamId, retryCount = 0, maxRetries = 2) {
  try {
    const result = await processInventory(steamId, null, retryCount > 0);
    const webSocketService = require('./WebSocketService');
    webSocketService.broadcastInventoryUpdate(steamId, result);
    
    // If the result is an error status and we haven't exceeded max retries, try again
    if (result.status === 'error' && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount + 1) * 1000;
      logger.inventory.warn(logger.helpers.operation(
        'Inventory Check', 
        'RETRY_SCHEDULED', 
        null, 
        { steamId, attempt: retryCount + 1, maxRetries, delayMs: delay }
      ));
      
      // Wait before retrying (exponential backoff: 2s, 4s, 8s)
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return processInventoryWithRetry(steamId, retryCount + 1, maxRetries);
    }
    
    // If this was a retry attempt that succeeded, log it
    if (retryCount > 0 && result.status !== 'error') {
      logger.inventory.success(logger.helpers.operation(
        'Inventory Check', 
        'RETRY_SUCCESS', 
        null, 
        { steamId, successfulAttempt: retryCount + 1 }
      ));
    }
    
    return result;
  } catch (error) {
    // If we haven't exceeded max retries, try again
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount + 1) * 1000;
      logger.inventory.warn(logger.helpers.operation(
        'Inventory Check', 
        'ERROR_RETRY', 
        null, 
        { steamId, attempt: retryCount + 1, maxRetries, error: error.message }
      ));
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return processInventoryWithRetry(steamId, retryCount + 1, maxRetries);
    }
    
    // If all retries failed, throw the error
    throw error;
  }
}

/**
 * Fetch and process friends of a profile
 * @param {string} steamId - Steam ID of the profile
 * @returns {Promise<Object>} - Processing results
 */
const fetchAndProcessFriends = async (steamId) => {
  return logger.timed(
    `process-friends-${steamId}`,
    async () => {
    try {
      // Get the raw friend list from Steam API
      let friends = [];
      try {
        friends = await steamApiService.getFriendList(steamId);
      } catch (err) {
        logger.friends.error(logger.helpers.operation(
          'Friend List Fetch', 
          'FAILED', 
          null, 
          { steamId, error: logger.helpers.error(err) }
        ));
        return {
          success: false,
          message: `Failed to fetch friend list: ${err.message}`,
          totalFriends: 0,
          processedFriends: 0,
          successCount: 0,
          enhancedDataCount: 0,
          metrics: {},
        };
      }

      if (friends.length === 0) {
        logger.friends.warn(logger.helpers.operation(
          'Friend List Analysis', 
          'EMPTY_OR_PRIVATE', 
          null, 
          { steamId, reason: 'No friends found or profile is private' }
        ));
        return {
          success: true,
          message: 'No friends found or profile private.',
          totalFriends: 0,
          newFriendsProcessed: 0,
        };
      }

      // Extract just the SteamIDs from the friend list
      const friendIds = friends.map(friend => friend.steamid);

      // Determine which friends are not yet stored for this profile
      const existingFriendIds = await friendshipRepository.findExistingFriendships(steamId, friendIds);
      const newFriendIds = friendIds.filter(id => !existingFriendIds.includes(id));

      if (newFriendIds.length === 0) {
        logger.friends.debug(logger.helpers.operation(
          'Friend Cache Check', 
          'ALL_CACHED', 
          null, 
          { steamId, totalFriends: friendIds.length, newFriends: 0 }
        ));
        return {
          success: true,
          message: 'All friends already cached – nothing to process.',
          totalFriends: friendIds.length,
          processedFriends: 0,
          successCount: 0,
          enhancedDataCount: 0,
          metrics: {},
        };
      }

      logger.friends.info(logger.helpers.operation(
        'Friend Processing', 
        'STARTED', 
        null, 
        { steamId, newFriends: newFriendIds.length, totalFriends: friendIds.length }
      ));

      // Create batches and process only missing friends
      let result;
      try {
        result = await processFriendBatches(steamId, newFriendIds);
      } catch (err) {
        logger.error('FriendProcessingService', `Error during batch processing for ${steamId}: ${err.message}`);
        return {
          success: false,
          message: `Failed to process friends: ${err.message}`,
          totalFriends: friends.length,
          processedFriends: 0,
          successCount: 0,
          enhancedDataCount: 0,
          metrics: {},
        };
      }

      // Log completion operation with detailed statistics
      logger.friends.info(
        logger.helpers.operation('Process Friends', 'COMPLETED'),
        { 
          steamId, 
          duration: `${(result.metrics.totalProcessingTimeMs / 1000).toFixed(1)}s`,
          friends: {
            total: friends.length,
            processed: result.totalProcessed,
            successful: result.successCount,
            enhanced: result.enhancedDataCount
          },
          inventories: result.inventoryStats.totalEligible > 0 ? {
            totalEligible: result.inventoryStats.totalEligible,
            successfullyValued: result.inventoryStats.successfullyValued,
            privateInventories: result.inventoryStats.privateInventories,
            skipped: result.inventoryStats.skipped,
            failed: result.inventoryStats.failed
          } : null
        }
      );

      return {
        success: true,
        message: `Successfully processed ${result.successCount} of ${result.totalProcessed} friend profiles.`,
        totalFriends: friends.length,
        processedFriends: result.totalProcessed,
        successCount: result.successCount,
        enhancedDataCount: result.enhancedDataCount,
        inventoryStats: result.inventoryStats,
        metrics: result.metrics,
      };
    } catch (unhandledErr) {
      logger.error('FriendProcessingService', `Unhandled error processing friends for ${steamId}: ${unhandledErr.message}`);
      return {
        success: false,
        message: `Unhandled error: ${unhandledErr.message}`,
        totalFriends: 0,
        processedFriends: 0,
        successCount: 0,
        enhancedDataCount: 0,
        metrics: {},
      };
    }
    },
    {
      context: logger.friends,
      operation: 'Process Friends',
      metadata: { steamId }
    }
  );
};

/**
 * Process friends in batches
 * @param {string} steamId - Steam ID of the profile
 * @param {Array<string>} friendIds - Array of friend Steam IDs
 * @returns {Promise<Object>} - Processing results
 */
const processFriendBatches = async (steamId, friendIds) => {
  // Get WebSocketService for progress updates
  const webSocketService = require('./WebSocketService');
  
  // Capture start time for metrics
  const overallStartTime = Date.now();
  
  // Determine adaptive concurrency based on available proxies and system load
  const proxyStatsCurrent = profileProxyManager.getStats();
  const baseLimit = Math.min(proxyStatsCurrent.total || 40, MAX_CONCURRENCY);
  
  // Reduce concurrency if we have many friends to process (prevents overwhelming the system)
  const adaptiveLimit = friendIds.length > 1000 ? Math.max(baseLimit * 0.7, 10) : baseLimit;
  webSocketService.updateFriendFetchProgress(steamId, { total: friendIds.length, processed: 0, status: 'processing_batches' });
  
  profileProxyManager.setConcurrentLimit(adaptiveLimit);
  logger.debug('FriendProcessingService', `Using adaptive concurrency limit: ${adaptiveLimit} for ${friendIds.length} friends`);

  // Dedicated limiter for friend-processing queue
  const limit = pLimit(adaptiveLimit);

  // Adaptive batch sizing based on friend count for optimal performance
  const adaptiveBatchSize = friendIds.length > 1000 ? 50 : 
                           friendIds.length > 500 ? 65 : 
                           DEFAULT_BATCH_SIZE;
  const batchSize = adaptiveBatchSize;
  
  // Create batches of friends to process
  const batches = [];
  for (let i = 0; i < friendIds.length; i += batchSize) {
    batches.push(friendIds.slice(i, i + batchSize));
  }
  
  // Initial progress update with total count
  webSocketService.updateFriendFetchProgress(steamId, {
    current: 0,
    total: friendIds.length,
    friendsTotal: friendIds.length,
    totalProcessed: 0,
    successCount: 0,
    percentComplete: 0,
    message: `Starting to process ${friendIds.length} friends`
  });
  
  // Log proxy stats before processing
  const proxyStats = profileProxyManager.getStats();
  logger.debug('FriendProcessingService', `Using proxy pool: ${proxyStats.total} total proxies`);
  
  // Status tracking - use object to ensure reference sharing across batches
  const sharedStats = {
    processedCount: 0,
    successCount: 0,
    enhancedDataCount: 0,
    batchTimes: [],
    friendProcessingTimes: [],
    totalFriends: friendIds.length
  };
  
  // Process all batches in parallel
  const batchPromises = batches.map(async (batch, batchIndex) => {
    return processBatch(steamId, batch, batchIndex, batches.length, limit, sharedStats);
  });
  
  // Wait for all batches to complete
  const batchResults = await Promise.all(batchPromises);
  
  // Use shared stats for accurate totals
  const totalProcessed = sharedStats.processedCount;
  const totalSuccess = sharedStats.successCount;
  const totalEnhanced = sharedStats.enhancedDataCount;
  
  // Calculate metrics
  const totalProcessingTimeMs = Date.now() - overallStartTime;
  const avgFriendProcessingTimeMs = sharedStats.friendProcessingTimes.length > 0 
    ? sharedStats.friendProcessingTimes.reduce((sum, time) => sum + time, 0) / sharedStats.friendProcessingTimes.length 
    : 0;
  
  const slowestBatchTimeMs = Math.max(...sharedStats.batchTimes.map(b => b.timeMs));
  const avgBatchProcessingTimeMs = sharedStats.batchTimes.reduce((sum, b) => sum + b.timeMs, 0) / sharedStats.batchTimes.length;
  
  // Calculate the theoretical processing time without batching overhead
  const theoreticalProcessingTime = totalSuccess * avgFriendProcessingTimeMs;
  const batchOverheadPercent = theoreticalProcessingTime > 0 
    ? ((totalProcessingTimeMs - theoreticalProcessingTime) / theoreticalProcessingTime) * 100 
    : 0;
  
  // Wait for all inventory processing to complete before final completion event
  let inventoryStats = {
    totalEligible: 0,
    privateInventories: 0,
    successfullyValued: 0,
    failed: 0,
    skipped: 0
  };
  
  if (sharedStats.inventoryPromises && sharedStats.inventoryPromises.length > 0) {
    logger.debug('FriendProcessingService', `Waiting for ${sharedStats.inventoryPromises.length} inventory checks to complete before final completion...`);
    
    // Wait for all inventory processing to finish
    try {
      const inventoryResults = await Promise.all(sharedStats.inventoryPromises);
      
      // Collect inventory statistics - only count those that were actually eligible for checking
      inventoryResults.forEach(result => {
        if (result.status === 'checked') {
          inventoryStats.totalEligible++;
          inventoryStats.successfullyValued++;
        } else if (result.status === 'skipped') {
          // Check if it was skipped due to private inventory vs other reasons
          if (result.skipReason && result.skipReason.includes('private')) {
            inventoryStats.totalEligible++;
            inventoryStats.privateInventories++;
          } else {
            inventoryStats.skipped++;
          }
        } else if (result.status === 'error') {
          inventoryStats.totalEligible++;
          inventoryStats.failed++;
          // Check if error was due to private inventory (401/403)
          if (result.error && (result.error.includes('401') || result.error.includes('403') || result.error.includes('private'))) {
            inventoryStats.privateInventories++;
          }
        }
      });
      
      logger.debug('FriendProcessingService', 'All inventory processing completed, emitting final completion event');
    } catch (err) {
      logger.warn('FriendProcessingService', `Some inventory checks failed, but proceeding with completion: ${err.message}`);
    }
    
    // Add a small delay to ensure all WebSocket events are processed
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Send completion notification via WebSocket
  webSocketService.completeFriendFetch(steamId, {
    totalProcessed,
    successCount: totalSuccess,
    enhancedDataCount: totalEnhanced,
    processingTimeMs: totalProcessingTimeMs,
    message: `Completed processing ${totalSuccess}/${totalProcessed} friends in ${(totalProcessingTimeMs / 1000).toFixed(1)}s`
  });
  
  // Log completion to terminal without inventory statistics (moved to operation log)
  logger.success('FriendProcessingService', `✅ Friend fetching completed for ${steamId}: ${totalSuccess}/${totalProcessed} friends processed successfully in ${(totalProcessingTimeMs / 1000).toFixed(1)}s`);
  
  return {
    totalProcessed,
    successCount: totalSuccess,
    enhancedDataCount: totalEnhanced,
    inventoryStats,
    metrics: {
      totalProcessingTimeMs,
      avgFriendProcessingTimeMs,
      batchCount: batches.length,
      slowestBatchTimeMs,
      batchOverheadPercent,
      avgBatchProcessingTimeMs
    }
  };
};

/**
 * Process a single batch of friends
 * @param {string} steamId - Steam ID of the profile
 * @param {Array<string>} batch - Batch of friend Steam IDs
 * @param {number} batchIndex - Index of the batch
 * @param {number} totalBatches - Total number of batches
 * @param {Object} limit - pLimit instance controlling friend-processing concurrency
 * @param {Object} stats - Stats object for tracking
 * @returns {Promise<Object>} - Batch processing results
 */
const processBatch = async (steamId, batch, batchIndex, totalBatches, limit, stats) => {
  // Get WebSocketService for progress updates
  const webSocketService = require('./WebSocketService');
  
  // Start timer for this batch
  const batchStartTime = Date.now();
  
  // Initialize inventory processing queue for parallel processing
  const inventoryQueue = [];
  
  try {
    logger.debug('FriendProcessingService', `Batch ${batchIndex+1}/${totalBatches}: ${batch.length} profiles`);
    
    // Get profile and ban information for each friend in batch
    const [profilesByIdObj, bansByIdObj] = await Promise.all([
      steamApiService.getPlayerSummariesBatch(batch),
      steamApiService.getPlayerBansBatch(batch)
    ]);
    
    // Get the successful profile IDs
    const successfulIds = Object.keys(profilesByIdObj);
    
    // For each successful profile
    // We'll collect all profile data first, then do a batch update
    const profileDataList = [];
    const profilePromises = successfulIds.map(id => 
      limit(async () => {
        // Start timer for this friend's processing
        const friendStartTime = Date.now();
        try {
          const profile = profilesByIdObj[id];
          const bans = bansByIdObj[id];
          
          if (!profile) return null;
          
          // Use central transformer for core mapping
          let profileData = transformApiProfileToDbModel(profile);

          // Merge/override with ban data & initial defaults
          profileData = {
            ...profileData,
            vacBanned: bans?.VACBanned === true,
            gameBanned: (parseInt(bans?.NumberOfGameBans) || 0) > 0,
            tradeBanned: bans?.EconomyBan && bans.EconomyBan !== 'none',
            friendsCount: 0,               // will be filled by enhancer
            playtime2Weeks: 0,             // will be filled by enhancer
            lastBadgeDate: null            // will be filled by enhancer
          };
          
          // Enhance profile data with additional API calls
          const isPublicProfile = profile.communityvisibilitystate === 3;
          if (isPublicProfile) {
            try {
              profileData = await enhanceProfileData(id, profileData);
              stats.enhancedDataCount++;
            } catch (enhancedError) {
              logger.warn('FriendProcessingService', `Error fetching enhanced data for friend ${id}:`, enhancedError);
            }
          }
          
          // Determine inventory evaluation
          const evalResult = evaluateProfileForInventory(profileData);
          if (evalResult.shouldCheck) {
            // Add to inventory processing queue for parallel processing
            inventoryQueue.push({
              steamId: id,
              shouldProcess: true,
              skipReason: null
            });
          } else {
            // Add to inventory queue with skip reason
            inventoryQueue.push({
              steamId: id,
              shouldProcess: false,
              skipReason: evalResult.skipReason
            });
          }
          
          // Add to batch update list
          profileDataList.push(profileData);
          
          stats.processedCount++;
          stats.successCount++;
          
          // Record processing time for this friend
          const friendProcessingTime = Date.now() - friendStartTime;
          stats.friendProcessingTimes.push(friendProcessingTime);
          
          return id;
        } catch (error) {
          logger.error('FriendProcessingService', `Error processing friend ${id}`, error);
          stats.processedCount++;
          return null;
        }
      })
    );
    
    // Wait for all profiles in this batch to be processed
    const results = await Promise.all(profilePromises);
    const processedIds = results.filter(Boolean);
    
    // Perform batch database updates for all profiles in this batch
    if (profileDataList.length > 0) {
      logger.db('FriendProcessingService', `Batch updating ${profileDataList.length} profiles to database`);
      await profileRepository.bulkCreateOrUpdate(profileDataList);
    }
    
    // Store friendship relationships in bulk operation
    if (processedIds.length > 0) {
      await friendshipRepository.storeBidirectionalFriendships(steamId, processedIds);
    }
    
    // Process inventory checks in parallel (non-blocking)
    if (inventoryQueue.length > 0) {
      const inventoryLimit = pLimit(Math.min(20, inventoryQueue.length)); // Limit inventory concurrency
      const inventoryPromises = inventoryQueue.map(item => 
        inventoryLimit(async () => {
          try {
            if (item.shouldProcess) {
              const result = await processInventoryWithRetry(item.steamId, 0);
              logger.success('CS2_INVENTORY', `Inventory processed for ${item.steamId}: $${(result.totalValueUsd||0).toFixed(2)}`);
              return result;
            } else {
              await processInventory(item.steamId, item.skipReason);
              return { status: 'skipped', skipReason: item.skipReason };
            }
          } catch (err) {
            logger.warn('CS2_INVENTORY', `Inventory check failed for ${item.steamId}: ${err.message}`);
            return { status: 'error', error: err.message };
          }
        })
      );
      
      // Store inventory promises for coordination with friend processing completion
      if (!stats.inventoryPromises) {
        stats.inventoryPromises = [];
      }
      stats.inventoryPromises.push(...inventoryPromises);
      
      // Process inventories in background without blocking friend processing
      Promise.all(inventoryPromises).then(results => {
        const successful = results.filter(r => r.status === 'checked').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        const failed = results.filter(r => r.status === 'error').length;
        logger.debug('CS2_INVENTORY', `Batch ${batchIndex+1} inventory processing complete: ${successful} checked, ${skipped} skipped, ${failed} failed`);
      }).catch(err => {
        logger.error('CS2_INVENTORY', `Batch ${batchIndex+1} inventory processing error: ${err.message}`);
      });
    }
    
    // Log batch performance
    const successfulProfiles = processedIds.length;
    logger.debug('FriendProcessingService', `Batch ${batchIndex+1}/${totalBatches} complete: ${successfulProfiles}/${batch.length} profiles`);
    
    // Record batch processing time
    const batchProcessingTime = Date.now() - batchStartTime;
    stats.batchTimes.push({
      batchIndex,
      size: batch.length,
      successfulProfiles: processedIds.length,
      timeMs: batchProcessingTime
    });
    
    // Send progress update via WebSocketService
    const totalProcessed = stats.processedCount || 0;
    const totalFriends = stats.totalFriends; // Use actual friend count
    webSocketService.updateFriendFetchProgress(steamId, {
      current: totalProcessed,
      total: totalFriends,
      friendsTotal: totalFriends,
      totalProcessed: totalProcessed,
      successCount: stats.successCount || 0,
      percentComplete: Math.round((totalProcessed / totalFriends) * 100),
      batchIndex: batchIndex,
      totalBatches: totalBatches,
      message: `Processing batch ${batchIndex+1}/${totalBatches}`
    });
    
    return {
      batchIndex,
      size: batch.length,
      processed: batch.length,
      successful: processedIds.length,
      enhanced: stats.enhancedDataCount,
      timeMs: Date.now() - batchStartTime
    };
  } catch (error) {
    logger.error('FriendProcessingService', 'Error processing batch', error);
    return {
      batchIndex,
      size: batch.length,
      processed: batch.length,
      successful: 0,
      enhanced: 0,
      timeMs: Date.now() - batchStartTime,
      error: error
    };
  }
};

/**
 * Enhance profile data with additional API calls
 * @param {string} steamId - Steam ID of the profile
 * @param {Object} profileData - Basic profile data
 * @returns {Promise<Object>} - Enhanced profile data
 */
const enhanceProfileData = async (steamId, profileData) => {
  logger.debug('FriendProcessingService', `Fetching enhanced data for profile ${steamId}`);
  
  // Determine what needs to be fetched based on profile state
  const apiCalls = [];
  
  // Always get recently played games for public profiles - increased concurrency for enhancement calls
  const nestedLimit = config.steam.maxConcurrency < 8 ? requestLimiter : require('p-limit').default(8); // Increased from 5 to 8
  apiCalls.push(
    nestedLimit(() => steamApiService.getRecentlyPlayedGames(steamId))
      .catch(() => null)
      .then(data => ({ type: 'recentGames', data }))
  );
  
  // Always get badges (lightweight)
  apiCalls.push(
    nestedLimit(() => steamApiService.getPlayerBadges(steamId))
      .catch(() => [])
      .then(data => ({ type: 'badges', data }))
  );
  
  // Always get friend count for all public profiles
  apiCalls.push(
    nestedLimit(() => steamApiService.getFriendList(steamId))
      .catch(err => {
        // Don't retry or log 401 errors (expected for private profiles)
        if (err.response && err.response.status === 401) {
          return [];
        }
        if (!err.message.includes('401')) {
          logger.debug('FriendProcessingService', `Could not fetch friends for ${steamId}: ${err.message}`);
        }
        return [];
      })
      .then(data => ({ type: 'friends', data }))
  );
  
  // Execute API calls in parallel
  const results = await Promise.all(apiCalls);
  
  // Process the results and update profileData
  for (const result of results) {
    if (result.type === 'recentGames' && result.data) {
      const recentGames = steamApiService.extractGamesArray(result.data);
      if (recentGames && recentGames.length > 0) {
        // Sort games by last played time (most recent first)
        // Steam API provides 'rtime_last_played' field for this
        const sortedByLastPlayed = [...recentGames].sort((a, b) => 
          (parseInt(b.rtime_last_played) || 0) - (parseInt(a.rtime_last_played) || 0)
        );
        
        // Get the most recently played game (not most played by time)
        if (sortedByLastPlayed[0] && sortedByLastPlayed[0].name) {
          profileData.lastPlayedGame = sortedByLastPlayed[0].name;
        }
        
        // Calculate total playtime in the last 2 weeks
        profileData.playtime2Weeks = recentGames.reduce((sum, game) => {
          return sum + (parseInt(game.playtime_2weeks) || 0);
        }, 0);
      }
    } else if (result.type === 'badges' && result.data) {
      // Process badge data using SteamDataTransformer
      const { transformApiProfileToDbModel } = require('./SteamDataTransformer');
      const SteamDataTransformer = require('./SteamDataTransformer');
      const badgeProcessingResult = SteamDataTransformer.processBadgeData(result.data);
      if (badgeProcessingResult.lastBadgeDate) {
        profileData.lastBadgeDate = badgeProcessingResult.lastBadgeDate;
      }
    } else if (result.type === 'friends' && Array.isArray(result.data)) {
      profileData.friendsCount = result.data.length;
    }
  }
  
  return profileData;
};

module.exports = {
  fetchAndProcessFriends,
  processInventoryWithRetry
};
