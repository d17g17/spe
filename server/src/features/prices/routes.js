'use strict';

const express = require('express');
const c = require('./controller');

const router = express.Router();

router.get('/export', c.exportAll);
router.post('/import', c.importMany);
router.delete('/clear', c.clear);
router.get('/stats', c.stats);

module.exports = router;
