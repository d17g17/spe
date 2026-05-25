const steamApiService = require('./steamApiService');
const profileProxyManager = require('./profileProxyManager');
const proxyManager = require('./proxyManager');
const { ItemPrice, CS2Inventory, Profile } = require('../models');
const logger = require('../utils/logger');
const requestLimiter = require('../utils/requestLimiter');
const webSocketService = require('./WebSocketService');
const config = require('../config');
const cacheCleanupService = require('./cacheCleanupService');

// Initialize inventory cache with cleanup
const inventoryCache = new Map();
cacheCleanupService.initializeCacheCleanup('inventoryCache', inventoryCache, {
  maxSize: 1000,
  ttl: 60 * 60 * 1000, // 60 minutes for better performance
  cleanupInterval: 5 * 60 * 1000 // 5 minutes
});

const STEAM_INVENTORY_URL =
  'https://steamcommunity.com/inventory/{steamId}/730/2?l=english&norender=1&count=1500'; // CS2 appId 730, contextId 2

// Stats tracking for inventory checks
const stats = {
  totalInventoryChecks: 0,         // Total inventory checks since server start
  activeInventoryChecks: 0,        // Currently active inventory checks
  totalPriceChecks: 0,             // Total price checks since server start
  activePriceChecks: 0,            // Currently active price checks
  successfulPriceChecks: 0,        // Successful price checks (price > 0)
  failedPriceChecks: 0,            // Failed price checks (price = 0)
  skippedInventories: 0,           // Inventories skipped due to various reasons
  lastStatusReportTime: Date.now(), // Time of last status report
  statusReportInterval: 300000,    // Report stats every 5 minutes
};

// Function to log stats periodically
function logStats(force = false) {
  const now = Date.now();
  // Only log if forced or if it's been more than the interval since the last report
  if (force || (now - stats.lastStatusReportTime) > stats.statusReportInterval) {
    logger.inventory.info(logger.helpers.stats({
      operation: 'CS2 Inventory Stats',
      activeChecks: stats.activeInventoryChecks,
      totalChecks: stats.totalInventoryChecks,
      skippedInventories: stats.skippedInventories,
      activePriceChecks: stats.activePriceChecks,
      successfulPriceChecks: stats.successfulPriceChecks,
      failedPriceChecks: stats.failedPriceChecks,
      totalPriceChecks: stats.totalPriceChecks,
      priceSuccessRate: stats.totalPriceChecks ? `${((stats.successfulPriceChecks / stats.totalPriceChecks) * 100).toFixed(1)}%` : '0%'
    }));
    
    stats.lastStatusReportTime = now;
  }
}

/**
 * Fetch Steam inventory JSON for a user.
 */
async function fetchInventory(steamId) {
  const url = STEAM_INVENTORY_URL.replace('{steamId}', steamId);
  // Log the exact endpoint being requested
  logger.inventory.debug(logger.helpers.operation(
    'CS2 Inventory Fetch',
    'STARTING',
    null,
    { steamId, endpoint: url }
  ));
  try {
    const cached = inventoryCache.get(steamId);
    const cachedData = cached ? cacheCleanupService.getCacheData(cached) : null;
    const response = await requestLimiter(() => proxyManager.makeRequest(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
        ...(cachedData?.etag ? { 'If-None-Match': cachedData.etag } : {})
      },
      timeout: 20000,
      maxRetries: 3 // Use Suborbit.al proxy for inventory with more retries
    }));

    // If nothing changed use cached copy (HTTP 304)
    if (response.status === 304 && cachedData) {
      logger.inventory.debug(logger.helpers.operation(
        'CS2 Inventory Fetch',
        'CACHE_HIT',
        null,
        { steamId, cacheType: 'ETag match' }
      ));
      return cachedData.data;
    }

    // Otherwise store fresh data + ETag (if provided) with cache cleanup
    const newEtag = response.headers?.etag;
    if (newEtag) {
      const cacheEntry = cacheCleanupService.createCacheEntry({ etag: newEtag, data: response.data });
      inventoryCache.set(steamId, cacheEntry);
    }
    return response.data;
  } catch (err) {
    // We'll log this error at a higher level to avoid duplicate logs
    throw err;
  }
}

/**
 * Determine if item is tradable (tradable === 1 in inventory JSON).
 */
function isTradable(invAsset) {
  return invAsset.tradable === 1;
}

/**
 * Determine if an item is a case based on its market hash name.
 * Cases typically have "Case" in their name.
 */
function isCaseItem(marketHashName) {
  const caseName = marketHashName.toLowerCase();
  return caseName.includes('case') && 
         !caseName.includes('sticker') && 
         !caseName.includes('key') &&
         !caseName.includes('capsule');
}

/**
 * Get price for a market hash name. Uses DB cache first, else Steam market.
 * Cases expire after 24 hours, other items have permanent cache.
 * Enhanced with better cache management and statistics.
 */
async function getItemPrice(marketHashName) {
  // Update stats
  stats.totalPriceChecks++;
  stats.activePriceChecks++;
  // Reduced stats logging frequency for cleaner output
  
  try {
    // Check cache first
    const cached = await ItemPrice.findByPk(marketHashName);
    if (cached) {
      // Use the stored isCase flag for better performance
      const isCase = cached.isCase || isCaseItem(marketHashName);
      
      if (isCase) {
        const cacheAgeHours = (Date.now() - new Date(cached.lastUpdated).getTime()) / (1000 * 60 * 60);
        if (cacheAgeHours > config.pricing.casePriceExpiryHours) {
          logger.pricing.debug(logger.helpers.operation(
          'Price Check',
          'CACHE_EXPIRED',
          null,
          { item: marketHashName, ageHours: cacheAgeHours.toFixed(1), itemType: 'case' }
        ));
          // Cache expired for case, continue to fetch new price
        } else {
          // logger.price('CS2PRICE', `💾 CASE CACHE HIT │ Item: ${marketHashName} │ Price: $${cached.priceUsd.toFixed(2)} │ Age: ${cacheAgeHours.toFixed(1)}h`); // Commented out for less verbosity
          stats.activePriceChecks--; // Decrement since we're returning cached result
          return parseFloat(cached.priceUsd);
        }
      } else {
        // Non-case items have permanent cache
        // logger.price('CS2PRICE', `💾 CACHE HIT │ Item: ${marketHashName} │ Price: $${cached.priceUsd.toFixed(2)}`); // Commented out for less verbosity
        stats.activePriceChecks--; // Decrement since we're returning cached result
        return parseFloat(cached.priceUsd);
      }
    } else {
      logger.pricing.debug(logger.helpers.operation(
        'Price Check',
        'CACHE_MISS',
        null,
        { item: marketHashName, source: 'Steam Market API' }
      ));
    }

    // Fetch from market (steam community market priceoverview)
    const url =
      'https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=' +
      encodeURIComponent(marketHashName);
    
    const response = await profileProxyManager.makeRequest(url, { 
      method: 'GET', 
      timeout: 10000,
      maxRetries: 2 // Limit retries for price checks
    });
    const data = response.data;
    let price = 0;
    if (data && data.success) {
      // price comes as lowest_price like '$1.23'
      const priceStr = data.median_price || data.lowest_price || '';
      price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
      if (price === 0) {
        logger.pricing.warn(logger.helpers.operation(
          'Price Check',
          'PARSE_ERROR',
          null,
          { item: marketHashName, response: priceStr }
        ));
      }
    }
    
    if (price > 0) {
      const isCase = isCaseItem(marketHashName);
      const currentFetchCount = cached ? cached.fetchCount + 1 : 1;
      
      await ItemPrice.upsert({
        itemIdentifier: marketHashName,
        priceUsd: price,
        lastUpdated: new Date(),
        isCase: isCase,
        fetchCount: currentFetchCount,
      });
      
      logger.pricing.debug(logger.helpers.operation(
        'Price Check',
        'SUCCESS',
        null,
        { item: marketHashName, price: `$${price.toFixed(2)}`, source: 'Steam Market', fetchCount: currentFetchCount }
      ));
      stats.successfulPriceChecks++;
    } else {
      logger.pricing.debug(logger.helpers.operation(
        'Price Check',
        'NO_PRICE',
        null,
        { item: marketHashName, source: 'Steam Market' }
      ));
      stats.failedPriceChecks++;
    }
    
    stats.activePriceChecks--;
    return price;
  } catch (err) {
    logger.pricing.error(logger.helpers.operation(
      'Price Check',
      'API_ERROR',
      err,
      { item: marketHashName }
    ));
    stats.failedPriceChecks++;
    stats.activePriceChecks--;
    return 0;
  }
}

/**
 * Main process: fetch, price, store.
 */
async function processInventory(steamId, skipReason = null, isRetry = false) {
  const processingStartTime = Date.now();
  
  // Update inventory check stats
  stats.totalInventoryChecks++;
  stats.activeInventoryChecks++;
  logStats(); // Only logs if it's time to report stats
  
  // If we already determined to skip, persist row and exit early
  if (skipReason) {
    stats.skippedInventories++;
    stats.activeInventoryChecks--;
    
    await CS2Inventory.upsert({
      profileId: steamId,
      status: 'skipped',
      skipReason,
      lastChecked: new Date(),
    });
    return { status: 'skipped', skipReason };
  }

  let status = 'error';
  let totalValue = null;
  let tradableCount = null;
  let top5 = null;
  let has2025ServiceMedalInInventory = false;
  let hasPremierSeasonOneMedalInInventory = false;
  let hasPremierSeasonTwoMedalInInventory = false;
  let invJson = null; // Declare invJson outside try block to avoid 'not defined' error
  let itemsNotOnMarket = []; // Track items not found on Steam market

  try {
    invJson = await fetchInventory(steamId);

    // Handle various error scenarios returned by Steam
    if (!invJson || invJson.success === false) {
      // Steam returns objects such as { success:false, Error:"This profile is private." }
      const errMsg = invJson?.Error || 'Inventory unavailable';
      const lowerMsg = errMsg.toLowerCase();
      if (lowerMsg.includes('private')) {
        status = 'private';
      } else if (lowerMsg.includes('retrieve items') || lowerMsg.includes('no inventory') || lowerMsg.includes('not available')) {
        status = 'empty';
      } else {
        status = 'error';
      }
      throw new Error(errMsg);
    }

    // If the assets array is missing, treat inventory as private
    if (!Array.isArray(invJson.assets)) {
      status = 'private';
      throw new Error('Inventory private');
    }

    // If inventory exists but has zero items, treat as empty
    if (invJson.total_inventory_count === 0) {
      status = 'empty';
      throw new Error('No items in inventory');
    }

    // Build description map first to access item details
    const descMap = new Map();
    for (const d of invJson.descriptions) {
      descMap.set(`${d.classid}_${d.instanceid}`, d);
    }

    // Check for special medals in ALL inventory items (including non-tradable)
    invJson.assets.forEach((a) => {
      const desc = descMap.get(`${a.classid}_${a.instanceid}`);
      if (!desc) return;
      const name = desc.market_hash_name || desc.name || '';
      
      // Check if this item is a 2025 Service Medal
      if (name && /2025 Service Medal/i.test(name)) {
        has2025ServiceMedalInInventory = true;
        logger.inventory.info(`2025 Service Medal found for ${steamId}`);
      }
      
      // Check if this item is a Premier Season One Medal
      if (name && /Premier Season One Medal/i.test(name)) {
        hasPremierSeasonOneMedalInInventory = true;
        logger.inventory.info(`Premier Season One Medal found for ${steamId}`);
      }
      
      // Check if this item is a Premier Season Two Medal
      if (name && /Premier Season Two Medal/i.test(name)) {
        hasPremierSeasonTwoMedalInInventory = true;
        logger.inventory.info(`Premier Season Two Medal found for ${steamId}`);
      }
    });

    // Filter tradable assets for value calculation
    const tradableAssets = invJson.assets.filter((a) => {
      const desc = descMap.get(`${a.classid}_${a.instanceid}`);
      if (!desc) return false;
      return desc.tradable === 1; // Consider tradable flag from description
    });

    if (tradableAssets.length === 0) {
      status = 'empty';
      throw new Error('No tradable items');
    }

    // Count by market_hash_name for pricing (only tradable items)
    const itemMap = {};
    tradableAssets.forEach((a) => {
      const desc = descMap.get(`${a.classid}_${a.instanceid}`);
      if (!desc) return;
      const name = desc.market_hash_name;
      
      if (!itemMap[name]) itemMap[name] = { count: 0, desc };
      itemMap[name].count += 1;
    });

    // Fetch prices concurrently (limited)
    const entries = Object.entries(itemMap);
    const CONCURRENCY_LIMIT = 10;
    const priced = [];

    let index = 0;
    async function worker() {
      while (index < entries.length) {
        const [name, { count, desc }] = entries[index++];
        try {
          const price = await getItemPrice(name);
          priced.push({ name, count, price, image: `https://steamcommunity-a.akamaihd.net/economy/image/${desc.icon_url}/96fx96f` });
          
          // Track items not found on Steam market (price = 0)
          if (price === 0) {
            itemsNotOnMarket.push(name);
          }
          
          // Removed verbose per-item logging for cleaner output
          // Individual item valuations are now only logged in summary
        } catch (err) {
          logger.inventory.error(logger.helpers.operation(
            'Item Valuation',
            'ERROR',
            err,
            { item: name }
          ));
        }
      }
    }

    // Start workers
    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, entries.length) }, () => worker());
    await Promise.all(workers);

    totalValue = priced.reduce((sum, p) => sum + p.price * p.count, 0);
    tradableCount = tradableAssets.length;
    top5 = priced
      .sort((a, b) => b.price * b.count - a.price * a.count)
      .slice(0, 5);
    
    // Log inventory summary
    const pricedItems = priced.filter(p => p.price > 0).length;
    const skippedItems = priced.filter(p => p.price === 0).length;
    
    const summaryStats = {
      steamId,
      totalValue: totalValue.toFixed(2),
      itemsPriced: pricedItems,
      itemsSkipped: skippedItems,
      top5Items: top5.map(item => ({
        name: item.name,
        count: item.count,
        totalValue: (item.price * item.count).toFixed(2)
      }))
    };
    
    logger.inventory.success(`Inventory processed for ${steamId}: $${totalValue.toFixed(2)} (${pricedItems} items priced, ${skippedItems} skipped)`);

    status = 'checked';
  } catch (err) {
    // Handle HTTP status codes and error messages to determine proper status
    const errorMessage = err.message || '';
    const statusCode = err.response?.status;
    
    // Check for private inventory indicators
    if (statusCode === 401 || statusCode === 403 || 
        errorMessage.includes('401') || errorMessage.includes('403') ||
        errorMessage.toLowerCase().includes('private') ||
        errorMessage.toLowerCase().includes('unauthorized')) {
      status = 'private';
    }
    // Check for empty inventory indicators  
    else if (errorMessage.toLowerCase().includes('retrieve items') ||
             errorMessage.toLowerCase().includes('no inventory') ||
             errorMessage.toLowerCase().includes('not available') ||
             errorMessage.toLowerCase().includes('empty')) {
      status = 'empty';
    }
    // Otherwise keep as error
    
    const errorType = status === 'private' ? 'PRIVATE_INVENTORY' : 
                     status === 'empty' ? 'EMPTY_INVENTORY' :
                     errorMessage.includes('timeout') ? 'TIMEOUT' : 'REQUEST_FAILED';
    
    // Reduce verbosity for private inventories (401/403 errors)
    if (status === 'private') {
      logger.inventory.debug(`Inventory private for ${steamId} (HTTP ${statusCode || 'Unknown'})`);
    } else {
      // Show more useful error information for actual errors
      const conciseError = err.code || (err.message ? err.message.split('\n')[0] : 'Unknown error');
      const statusInfo = statusCode ? ` (HTTP ${statusCode})` : '';
      logger.inventory.error(`Inventory check failed for ${steamId}: ${conciseError}${statusInfo} (${errorType})`);
    }
  }

  const processingEndTime = Date.now();
  const processingTimeMs = processingEndTime - processingStartTime;
  
  const inventoryRecord = await CS2Inventory.upsert({
    profileId: steamId,
    totalValueUsd: totalValue,
    tradableItemsCount: tradableCount,
    totalItemsCount: invJson?.assets?.length || 0,
    top5TradableItems: top5,
    has2025ServiceMedal: has2025ServiceMedalInInventory,
    hasPremierSeasonOneMedal: hasPremierSeasonOneMedalInInventory,
    hasPremierSeasonTwoMedal: hasPremierSeasonTwoMedalInInventory,
    status,
    skipReason,
    processingTimeMs,
    lastChecked: new Date(),
  }, { returning: true });

  // Update profile notes if items were not found on Steam market
  if (status === 'checked' && itemsNotOnMarket && itemsNotOnMarket.length > 0) {
    try {
      const profile = await Profile.findByPk(steamId);
      if (profile) {
        const currentNotes = profile.notes || '';
        const marketNote = `Missing prices: ${itemsNotOnMarket.join(', ')}`;
        
        // Check if this note already exists to avoid duplicates
        if (!currentNotes.includes('Missing prices:')) {
          const updatedNotes = currentNotes ? `${currentNotes}\n${marketNote}` : marketNote;
          await profile.update({ notes: updatedNotes });
          
          logger.inventory.info(logger.helpers.operation(
            'Profile Notes Update',
            'SUCCESS',
            null,
            { steamId, itemsNotOnMarket: itemsNotOnMarket.length }
          ));
        } else {
          // Update existing note with new items
          const noteRegex = /Missing prices: ([^\n]*)/;
          const match = currentNotes.match(noteRegex);
          if (match) {
            const existingItems = match[1].split(', ');
            const newItems = itemsNotOnMarket.filter(item => !existingItems.includes(item));
            if (newItems.length > 0) {
              const allItems = [...existingItems, ...newItems];
              const updatedNotes = currentNotes.replace(noteRegex, `Missing prices: ${allItems.join(', ')}`);
              await profile.update({ notes: updatedNotes });
              
              logger.inventory.info(logger.helpers.operation(
                'Profile Notes Update',
                'UPDATED',
                null,
                { steamId, newItemsAdded: newItems.length }
              ));
            }
          }
        }
      }
    } catch (error) {
      logger.inventory.error(logger.helpers.operation(
        'Profile Notes Update',
        'ERROR',
        error,
        { steamId }
      ));
    }
  }

  // Update stats before returning
  stats.activeInventoryChecks--;
  // Removed forced stats logging for cleaner output
  
  // Emit WebSocket event for inventory check completion
  // This allows clients to update their UI when an inventory value changes
  if (webSocketService.io) {
    const inventoryData = {
      steamId: steamId,
      status: status,
      totalValueUsd: totalValue,
      tradableItemsCount: tradableCount,
      has2025ServiceMedal: has2025ServiceMedalInInventory,
      hasPremierSeasonOneMedal: hasPremierSeasonOneMedalInInventory,
      hasPremierSeasonTwoMedal: hasPremierSeasonTwoMedalInInventory,
      skipReason: skipReason,
      timestamp: Date.now(),
      isRetry: isRetry // Add flag to track if this is a retry
    };
    
    // Emit to all clients and specific steamId room
    webSocketService.io.emit('inventoryCheck:complete', inventoryData);
    webSocketService.io.to(`profile:${steamId}`).emit('inventoryCheck:complete', inventoryData);
    
    // Removed verbose WebSocket debug logging for cleaner output
  }
  
  return { status, totalValueUsd: totalValue };
}

/**
 * Evaluate whether a profile meets criteria for inventory check.
 * Returns { shouldCheck:boolean, skipReason:string|null }
 */
function evaluateProfileForInventory(profile) {
  if (!profile) return { shouldCheck: false, skipReason: 'no_profile' };
  
  // REMOVED: Skip logic for 2025 Service Medal badges
  // The previous logic incorrectly skipped inventory checks for users with 2025 Service Medal badges,
  // preventing proper detection of the actual medal item in their inventory.
  // Users with badges should still have their inventories checked to confirm they have the medal item.
  
  // Condition failures cascade
  if (profile.vacBanned || profile.gameBanned || profile.tradeBanned) {
    return { shouldCheck: false, skipReason: 'has_bans' };
  }
  if ((parseInt(profile.playtime2Weeks) || 0) > 0) {
    return { shouldCheck: false, skipReason: 'recent_playtime' };
  }
  const cutoff = new Date('2025-01-01');
  if (profile.lastBadgeDate && new Date(profile.lastBadgeDate) >= cutoff) {
    return { shouldCheck: false, skipReason: 'recent_badge' };
  }
  if (profile.personaState !== undefined && profile.personaState !== 0) {
    return { shouldCheck: false, skipReason: 'online' };
  }
  if (profile.communityVisibilityState !== 3) {
    return { shouldCheck: false, skipReason: 'private_profile' };
  }
  return { shouldCheck: true, skipReason: null };
}

// Cleanup function for graceful shutdown
function cleanup() {
  try {
    cacheCleanupService.cleanup(inventoryCache);
    logger.inventory.info(logger.helpers.operation(
      'Cache Cleanup',
      'COMPLETED',
      null,
      { cacheType: 'inventory' }
    ));
  } catch (error) {
    logger.inventory.error(logger.helpers.operation(
      'Cache Cleanup',
      'ERROR',
      error,
      { cacheType: 'inventory' }
    ));
  }
}

// Export the stats object as well for external monitoring
module.exports = {
  processInventory,
  evaluateProfileForInventory,
  getInventoryStats: () => ({ ...stats }), // Return a copy of stats
  cleanup // Export cleanup function for graceful shutdown
};
