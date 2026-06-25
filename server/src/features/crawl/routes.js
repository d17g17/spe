'use strict';

const express = require('express');
const c = require('./controller');

const router = express.Router();

router.get('/active', c.activeAll);
router.post('/start', c.startCrawl);
router.get('/:steamId/status', c.getStatus);
router.post('/:steamId/cancel', c.cancelCrawl);

module.exports = router;
