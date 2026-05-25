'use strict';

const express = require('express');
const c = require('./controller');

const router = express.Router();

router.get('/active', c.activeAll);
router.get('/:id', c.list);
router.post('/:id/fetch', c.fetch);
router.get('/:id/status', c.status);

module.exports = router;
