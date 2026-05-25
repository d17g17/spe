'use strict';

require('dotenv').config();
const path = require('path');

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const bool = (v, d) => {
  if (v == null) return d;
  return /^(1|true|yes|on)$/i.test(String(v));
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3002),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'database', 'steamprofiles.db'),

  steamApiKey: process.env.STEAM_API_KEY || '',

  webshareProxyFile:
    process.env.WEBSHARE_PROXY_FILE ||
    path.join(__dirname, '..', '..', 'Webshare 10 proxies.txt'),

  suborbit: {
    host: process.env.SUBORBIT_HOST || '',
    port: process.env.SUBORBIT_PORT || '',
    username: process.env.SUBORBIT_USERNAME || '',
    password: process.env.SUBORBIT_PASSWORD || '',
  },

  steamConcurrency: num(process.env.MAX_STEAM_API_CONCURRENCY, 120),
  inventoryConcurrency: num(process.env.MAX_INVENTORY_CONCURRENCY, 20),
  friendBatchSize: num(process.env.DEFAULT_BATCH_SIZE, 75),

  profileCacheMinutes: num(process.env.PROFILE_CACHE_EXPIRY_MINUTES, 60),
  casePriceHours: num(process.env.CASE_PRICE_EXPIRY_HOURS, 24),
  itemPriceDays: num(process.env.ITEM_PRICE_EXPIRY_DAYS, 7),

  logLevel: (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info')).toLowerCase(),
  logFile: bool(process.env.ENABLE_FILE_LOGGING, false),
  logDir: process.env.LOG_DIRECTORY || path.join(__dirname, '..', 'logs'),
};

module.exports = config;
