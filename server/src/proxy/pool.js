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

const isWebApi = (url) => /^https?:\/\/api\.steampowered\.com/i.test(url);

const isInventory = (url) => /steamcommunity\.com\/inventory\//i.test(url);

const isMarket = (url) => /steamcommunity\.com\/market\//i.test(url);

const pickStrategy = (url, override) => {
  const wantSuborbit = override === 'suborbit' || (!override && (isInventory(url) || isMarket(url)));
  if (wantSuborbit) return suborbit.enabled ? 'suborbit' : 'webshare';
  if (override) return override;
  if (isWebApi(url)) return 'webshare';
  return 'webshare';
};

const requestDirect = (opts) =>
  axios({ ...opts, timeout: opts.timeout || DEFAULT_TIMEOUT, proxy: false });

const requestViaWebshare = async (opts) => {
  if (!webshare.isGloballyEnabled()) return requestDirect(opts);
  const proxy = webshare.pick();
  if (!proxy) return requestDirect(opts);
  try {
    return await axios({
      ...opts,
      timeout: opts.timeout || DEFAULT_TIMEOUT,
      httpAgent: webshare.agent(proxy),
      httpsAgent: webshare.agent(proxy),
      proxy: false,
    });
  } catch (err) {
    const s = err.response?.status;
    if (s === 429) webshare.markRateLimited(proxy.id);
    else if (s === 402 || s === 407 || s === 502 || s === 503) webshare.markDead(proxy.id);
    else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
      webshare.markDead(proxy.id);
    }
    throw err;
  }
};

const requestViaSuborbit = async (opts) => {
  if (!webshare.isGloballyEnabled()) return requestDirect(opts);
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

const annotate = (err, strategy) => {
  const status = err.response?.status;
  if (status === 402) {
    err.proxyError = true;
    err.userMessage = 'Proxy provider rejected the request (402 - bandwidth/subscription cap). Top up Webshare or check the proxy file.';
  } else if (status === 407) {
    err.proxyError = true;
    err.userMessage = 'Proxy auth failed (407). Verify proxy credentials.';
  } else if (strategy === 'suborbit' && (status === 401 || status === 403)) {
    err.proxyError = true;
    err.userMessage = 'Suborbit proxy auth failed. Check SUBORBIT_* env vars.';
  }
  return err;
};

const request = async (opts) => {
  const strategy = pickStrategy(opts.url, opts.strategy);
  const maxAttempts = opts.noRetry ? 1 : MAX_RETRIES;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = strategy === 'suborbit'
        ? await requestViaSuborbit(opts)
        : await requestViaWebshare(opts);
      return res;
    } catch (err) {
      lastErr = annotate(err, strategy);
      const status = err.response?.status;
      if (status === 401 || status === 403 || status === 404) throw lastErr;
      if (attempt === maxAttempts - 1) break;
      if (status === 400 || status === 422) throw lastErr;
      const retryAfter = Number(err.response?.headers?.['retry-after']);
      const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : BASE_BACKOFF_MS * Math.pow(2, attempt);
      logger.debug(`proxy retry ${attempt + 1}/${maxAttempts} via ${strategy}: ${err.message} (sleep ${delay}ms)`);
      await sleep(delay);
    }
  }
  throw lastErr;
};

module.exports = { request };
