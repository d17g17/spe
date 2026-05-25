'use strict';

const express = require('express');
const c = require('./controller');

const router = express.Router();

router.get('/stats', c.stats);
router.post('/backfill/medals', c.backfillMedals);
router.get('/bulk/active', c.bulkActive);
router.get('/bulk/:id/status', c.bulkStatus);
router.post('/bulk/:id', c.bulkStart);
router.get('/:id', c.get);
router.post('/:id/fetch', c.fetch);

module.exports = router;
