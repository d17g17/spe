'use strict';

const express = require('express');
const c = require('./controller');

const router = express.Router();

router.get('/', c.list);
router.delete('/', c.deleteAll);
router.post('/inventory-errors', c.inventoryErrors);
router.post('/fetch-all', c.fetchAllStart);
router.get('/fetch-all/status', c.fetchAllStatus);
router.post('/fetch-all/cancel', c.fetchAllCancel);

router.get('/:id/fetch', c.fetchOne);
router.put('/:id/ignored', c.setIgnored);
router.put('/:id/star', c.setStar);
router.get('/:id', c.getOne);
router.delete('/:id', c.deleteOne);

module.exports = router;
