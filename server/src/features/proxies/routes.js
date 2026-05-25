'use strict';

const express = require('express');
const c = require('./controller');

const router = express.Router();

router.get('/', c.list);
router.post('/reload', c.reload);
router.post('/clear-health', c.clearHealth);
router.post('/keep-working', c.keepWorking);
router.post('/remove-dead', c.removeDead);
router.post('/test', c.testAll);
router.post('/test/cancel', c.testCancel);
router.get('/test/status', c.testStatus);
router.post('/import', express.text({ type: '*/*', limit: '2mb' }), c.importProxies);
router.post('/:id/test', c.testOne);
router.put('/global', c.setGlobal);
router.put('/all', c.setAll);
router.put('/:id', c.setOne);

module.exports = router;
