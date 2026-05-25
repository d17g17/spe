'use strict';

const express = require('express');
const os = require('os');

const router = express.Router();

router.get('/', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    },
    loadavg: os.loadavg(),
    node: process.version,
  });
});

module.exports = router;
