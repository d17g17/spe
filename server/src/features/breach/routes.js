'use strict';

const express = require('express');
const c = require('./controller');

const router = express.Router();

router.post('/search', c.search);
router.get('/fields', c.fields);

router.get('/cache/:steamId', c.cacheList);
router.post('/cache', c.cacheSave);
router.delete('/cache/profile/:steamId', c.cacheClearProfile);
router.delete('/cache/:id', c.cacheDelete);

module.exports = router;
