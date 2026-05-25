// Shared p-limit instance across the server to enforce max concurrency for external requests
const pLimit = require('p-limit').default;
const config = require('../config');

module.exports = pLimit(config.steam.maxConcurrency);
