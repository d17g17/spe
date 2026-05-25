'use strict';

const pool = require('../proxy/pool');
const limiter = require('../utils/limiter');
const config = require('../config');

const USER_AGENT = 'SteamProfileExplorer/1.0';

const get = async (url, params = {}, opts = {}) => {
  const strategy = opts.strategy;
  const headers = { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(opts.headers || {}) };
  const run = () =>
    pool.request({
      url,
      method: 'GET',
      params,
      headers,
      strategy,
      timeout: opts.timeout,
      noRetry: opts.noRetry,
    });
  return strategy === 'suborbit' ? limiter.inventory(run) : limiter.steam(run);
};

const requireKey = () => {
  if (!config.steamApiKey) throw new Error('STEAM_API_KEY not configured');
  return config.steamApiKey;
};

module.exports = { get, requireKey };
