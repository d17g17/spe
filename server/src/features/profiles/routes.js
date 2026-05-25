'use strict';

const express = require('express');
const c = require('./controller');

const router = express.Router();

router.get('/', c.list);
router.delete('/', c.deleteAll);
router.post('/inventory-errors', c.inventoryErrors);

router.get('/:id/fetch', c.fetchOne);
router.get('/:id', c.getOne);
router.delete('/:id', c.deleteOne);

module.exports = router;
