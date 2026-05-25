const { ItemPrice } = require('../models');
const { Op } = require('sequelize');
const responseFormatter = require('../services/ResponseFormatterService');
const logger = require('../utils/logger');

/**
 * GET /api/item-prices/export
 * Export all item prices as JSON
 */
async function exportItemPrices(req, res) {
  try {
    const itemPrices = await ItemPrice.findAll({
      order: [['itemIdentifier', 'ASC']]
    });
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalItems: itemPrices.length,
      itemPrices: itemPrices.map(item => ({
        itemIdentifier: item.itemIdentifier,
        priceUsd: item.priceUsd,
        lastUpdated: item.lastUpdated
      }))
    };
    
    logger.info('ItemPrice', `Exported ${itemPrices.length} item prices`);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="item-prices-${new Date().toISOString().split('T')[0]}.json"`);
    
    return res.status(200).json(exportData);
  } catch (err) {
    logger.error('ItemPrice', `Export failed: ${err.message}`);
    return res.status(500).json(responseFormatter.error('Failed to export item prices', err));
  }
}

/**
 * POST /api/item-prices/import
 * Import item prices from JSON data
 */
async function importItemPrices(req, res) {
  try {
    const { itemPrices, overwriteExisting = false } = req.body;
    
    if (!itemPrices || !Array.isArray(itemPrices)) {
      return res.status(400).json(responseFormatter.error('Invalid data format. Expected array of item prices.'));
    }
    
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    
    for (const item of itemPrices) {
      if (!item.itemIdentifier || typeof item.priceUsd !== 'number') {
        skipped++;
        continue;
      }
      
      const existingItem = await ItemPrice.findByPk(item.itemIdentifier);
      
      if (existingItem && !overwriteExisting) {
        skipped++;
        continue;
      }
      
      await ItemPrice.upsert({
        itemIdentifier: item.itemIdentifier,
        priceUsd: item.priceUsd,
        lastUpdated: item.lastUpdated ? new Date(item.lastUpdated) : new Date()
      });
      
      if (existingItem) {
        updated++;
      } else {
        imported++;
      }
    }
    
    const result = {
      imported,
      updated,
      skipped,
      total: itemPrices.length
    };
    
    logger.info('ItemPrice', `Import completed: ${imported} new, ${updated} updated, ${skipped} skipped`);
    
    return res.status(200).json(responseFormatter.success(result, 'Item prices imported successfully'));
  } catch (err) {
    logger.error('ItemPrice', `Import failed: ${err.message}`);
    return res.status(500).json(responseFormatter.error('Failed to import item prices', err));
  }
}

/**
 * GET /api/item-prices/stats
 * Get statistics about item prices in the database
 */
async function getItemPriceStats(req, res) {
  try {
    const totalItems = await ItemPrice.count();
    const avgPrice = await ItemPrice.findOne({
      attributes: [
        [ItemPrice.sequelize.fn('AVG', ItemPrice.sequelize.col('price_usd')), 'avgPrice'],
        [ItemPrice.sequelize.fn('MAX', ItemPrice.sequelize.col('price_usd')), 'maxPrice'],
        [ItemPrice.sequelize.fn('MIN', ItemPrice.sequelize.col('price_usd')), 'minPrice']
      ],
      raw: true
    });
    
    const recentlyUpdated = await ItemPrice.count({
      where: {
        lastUpdated: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });
    
    const stats = {
      totalItems,
      avgPrice: parseFloat(avgPrice?.avgPrice || 0).toFixed(2),
      maxPrice: parseFloat(avgPrice?.maxPrice || 0).toFixed(2),
      minPrice: parseFloat(avgPrice?.minPrice || 0).toFixed(2),
      recentlyUpdated
    };
    
    return res.status(200).json(responseFormatter.success(stats));
  } catch (err) {
    logger.error('ItemPrice', `Stats failed: ${err.message}`);
    return res.status(500).json(responseFormatter.error('Failed to get item price stats', err));
  }
}

/**
 * DELETE /api/item-prices/clear
 * Clear all item prices from the database
 */
async function clearItemPrices(req, res) {
  try {
    const deletedCount = await ItemPrice.destroy({
      where: {},
      truncate: true
    });
    
    logger.info('ItemPrice', `Cleared ${deletedCount} item prices from database`);
    
    return res.status(200).json(responseFormatter.success(
      { deletedCount }, 
      'All item prices cleared successfully'
    ));
  } catch (err) {
    logger.error('ItemPrice', `Clear failed: ${err.message}`);
    return res.status(500).json(responseFormatter.error('Failed to clear item prices', err));
  }
}

module.exports = {
  exportItemPrices,
  importItemPrices,
  getItemPriceStats,
  clearItemPrices
};