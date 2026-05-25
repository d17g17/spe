const express = require('express');
const {
  exportItemPrices,
  importItemPrices,
  getItemPriceStats,
  clearItemPrices
} = require('../controllers/itemPriceController');

const router = express.Router();

// GET /api/item-prices/export - Export all item prices as JSON
router.get('/export', exportItemPrices);

// POST /api/item-prices/import - Import item prices from JSON
router.post('/import', importItemPrices);

// GET /api/item-prices/stats - Get item price statistics
router.get('/stats', getItemPriceStats);

// DELETE /api/item-prices/clear - Clear all item prices
router.delete('/clear', clearItemPrices);

module.exports = router;