'use strict';

const axios = require('axios');
const webshare = require('./webshare');
const suborbit = require('./suborbit');
const logger = require('../utils/logger');

const DEFAULT_TIMEOUT = 20_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isRetryableStatus = (s) => s === 429 || (s >= 500 && s < 600);

const isWebApi = (url) =>
  /^https?:\/\/(api\.steampowered\.com|steamcommunity\.com\/market\/)/i.test(url);

const isInventory = (url) =>
  /steamcommunity\.com\/inventory\//i.test(url);

const pickStrategy = (url, override) => {
  if (override) return override;
  if (isInventory(url)) return 'suborbit';
  if (isWebApi(url)) return 'webshare';
  return 'webshare';
};

const requestViaWebshare = async (opts) => {
  const proxy = webshare.pick();
  if (!proxy) return axios({ ...opts, timeout: opts.timeout || DEFAULT_TIMEOUT });
  try {
    return await axios({
      ...opts,
      timeout: opts.timeout || DEFAULT_TIMEOUT,
      httpAgent: webshare.agent(proxy),
      httpsAgent: webshare.agent(proxy),
      proxy: false,
    });
  } catch (err) {
    if (err.response?.status === 429) webshare.markRateLimited(proxy.id);
    else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
      webshare.markDead(proxy.id);
    }
    throw err;
  }
};

const requestViaSuborbit = async (opts) => {
  if (!suborbit.enabled) {
    throw new Error('Suborbit proxy not configured (SUBORBIT_* env vars missing)');
  }
  return axios({
    ...opts,
    timeout: opts.timeout || DEFAULT_TIMEOUT,
    httpAgent: suborbit.agent,
    httpsAgent: suborbit.agent,
    proxy: false,
  });
};

const request = async (opts) => {
  const strategy = pickStrategy(opts.url, opts.strategy);
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = strategy === 'suborbit'
        ? await requestViaSuborbit(opts)
        : await requestViaWebshare(opts);
      return res;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status === 401 || status === 403 || status === 404) throw err;
      if (attempt === MAX_RETRIES - 1) break;
      if (status && !isRetryableStatus(status)) {
        if (status === 400 || status === 422) throw err;
      }
      const retryAfter = Number(err.response?.headers?.['retry-after']);
      const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : BASE_BACKOFF_MS * Math.pow(2, attempt);
      logger.debug(`proxy retry ${attempt + 1}/${MAX_RETRIES} via ${strategy}: ${err.message} (sleep ${delay}ms)`);
      await sleep(delay);
    }
  }
  throw lastErr;
};

module.exports = { request };
