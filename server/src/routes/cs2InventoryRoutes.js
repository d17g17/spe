const express = require('express');
const { fetchInventory, getInventory, getInventoryStats } = require('../controllers/cs2InventoryController');

const router = express.Router();

// POST /api/profile/:profileId/cs2-inventory/fetch
router.post('/profile/:profileId/cs2-inventory/fetch', fetchInventory);

// GET /api/profile/:profileId/cs2-inventory (latest cached)
router.get('/profile/:profileId/cs2-inventory', getInventory);

// GET /api/cs2-inventory/stats - Get inventory check statistics
router.get('/cs2-inventory/stats', getInventoryStats);

module.exports = router;
