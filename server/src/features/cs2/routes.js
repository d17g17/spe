'use strict';

const express = require('express');
const c = require('./controller');

const router = express.Router();

router.get('/stats', c.stats);
router.get('/:id', c.get);
router.post('/:id/fetch', c.fetch);

module.exports = router;
