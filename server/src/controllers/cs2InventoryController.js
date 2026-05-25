const cs2InventoryService = require('../services/cs2InventoryService');
const { processInventoryWithRetry } = require('../services/FriendProcessingService');
const responseFormatter = require('../services/ResponseFormatterService');
const logger = require('../utils/logger');

/**
 * POST /api/profile/:profileId/cs2-inventory/fetch
 */
async function fetchInventory(req, res) {
  const { profileId } = req.params;
  try {
    const result = await processInventoryWithRetry(profileId);
    return res.status(200).json(responseFormatter.success(result));
  } catch (err) {
    logger.error('CS2Inv', err.message);
    return res.status(500).json(responseFormatter.error('Failed to process inventory', err));
  }
}

/**
 * GET /api/profile/:profileId/cs2-inventory
 * Returns the last processed CS2 inventory record for a profile.
 */
async function getInventory(req, res) {
  const { profileId } = req.params;
  try {
    const { CS2Inventory } = require('../models');
    const record = await CS2Inventory.findByPk(profileId);
    if (!record) {
      return res.status(404).json(responseFormatter.error('CS2 inventory not found'));
    }
    return res.status(200).json(responseFormatter.success(record));
  } catch (err) {
    logger.error('CS2Inv', err.message);
    return res.status(500).json(responseFormatter.error('Failed to retrieve inventory', err));
  }
}

/**
 * GET /api/cs2-inventory/stats
 * Returns statistics about inventory checks
 */
function getInventoryStats(req, res) {
  try {
    const stats = cs2InventoryService.getInventoryStats();
    // Add some additional stats for the client
    const enrichedStats = {
      ...stats,
      timestamp: Date.now(),
      // Calculate some useful derived stats
      totalProcessed: stats.totalInventoryChecks - stats.activeInventoryChecks,
      priceSuccessRate: stats.totalPriceChecks > 0 
        ? Math.round((stats.successfulPriceChecks / stats.totalPriceChecks) * 100) 
        : 0
    };
    return res.status(200).json(responseFormatter.success(enrichedStats));
  } catch (err) {
    logger.error('CS2Inv', err.message);
    return res.status(500).json(responseFormatter.error('Failed to retrieve inventory stats', err));
  }
}

module.exports = { fetchInventory, getInventory, getInventoryStats };
