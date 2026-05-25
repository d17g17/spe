/**
 * Enhanced Proxy Manager
 * Provides intelligent proxy selection, rotation, and performance tracking
 */
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const https = require('https');
const pLimit = require('p-limit').default;
const logger = require('../utils/logger');
const cacheCleanupService = require('./cacheCleanupService');

// Limit global socket pool to encourage keep-alive reuse
require('http').globalAgent.maxSockets = 100;
https.globalAgent.maxSockets = 100;



// Simple list of desktop User‑Agents to rotate (expand as needed)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
];

const randomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const DEFAULT_UA = 'SPA/1';

class ProxyManager {
  constructor(options = {}) {
    this.options = {
      concurrentLimit: Math.min(options.concurrentLimit || 100, 500),
      retryLimit: options.retryLimit || 5,
      requestTimeout: options.requestTimeout || 10000,
      ...options
    };

    // Suborbit.al credentials and endpoint details from environment variables
    this.suborbitUsername = process.env.SUBORBIT_USERNAME;
    this.suborbitPassword = process.env.SUBORBIT_PASSWORD;
    this.suborbitHost = process.env.SUBORBIT_HOST;
    this.suborbitPort = process.env.SUBORBIT_PORT;

    if (!this.suborbitUsername || !this.suborbitPassword || !this.suborbitHost || !this.suborbitPort) {
      logger.error('ProxyManager', 'Suborbit.al credentials not found in environment variables. Proxying will be disabled.');
      this.enabled = false;
    } else {

      this.proxyUrl = `http://${this.suborbitUsername}:${this.suborbitPassword}@${this.suborbitHost}:${this.suborbitPort}`;
      logger.success('PROXY', `Manager initialized with Suborbit.al proxy: ${this.suborbitHost}:${this.suborbitPort}`);
      this.enabled = true;
    }


    this.limit = pLimit(this.options.concurrentLimit);
    this.responseCache = new Map();
    this.MAX_CACHE_SIZE = 5000;
    this.inflightRequests = new Map();
    
    // Initialize cache cleanup
    this.initializeCacheCleanup();

  }

  /**
   * Initialize cache cleanup to prevent memory leaks
   */
  initializeCacheCleanup() {
    // Setup cache cleanup for response cache
    cacheCleanupService.initializeCacheCleanup('responseCache', this.responseCache, {
      maxSize: this.MAX_CACHE_SIZE,
      ttl: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000 // 5 minutes
    });

    // Setup cache cleanup for inflight requests
    cacheCleanupService.initializeCacheCleanup('inflightRequests', this.inflightRequests, {
      maxSize: 1000,
      ttl: 10 * 60 * 1000, // 10 minutes
      cleanupInterval: 2 * 60 * 1000 // 2 minutes
    });
  }

  /**
   * Update proxy metrics after use
   */
  updateProxyMetrics(proxy, success, responseTime) {
    // No-op for single proxy service
  }

  /**
   * Make a request using the Suborbit.al proxy with retries
   */
  async makeRequest(url, options = {}) {
    if (!this.enabled) {
      logger.error('ProxyManager', 'Suborbit.al proxy is not configured/enabled. Cannot make request.');
      throw new Error('Suborbit.al proxy is not configured. Direct request fallback has been disabled.');
    }

    const maxRetries = options.maxRetries || this.options.retryLimit;
    let attempts = 0;
    let lastError = null;
    
    // Deduplicate concurrent identical requests (URL + method)
    const key = `${options.method || 'GET'}::${url}`;
    if (this.inflightRequests?.has(key)) {
      return this.inflightRequests.get(key);
    }

    if (!this.inflightRequests) this.inflightRequests = new Map();

    const reqPromise = (async () => {
      try {
        while (attempts < maxRetries) {
          try {
            logger.debug('PROXY', `Using Suborbit.al proxy (Attempt ${attempts + 1}/${maxRetries}) for ${url}`);
            
            const startTime = Date.now();
            const httpsAgent = new HttpsProxyAgent(this.proxyUrl);
            
            // Compose headers, injecting compression + conditional ETag
            const baseHeaders = {
              'User-Agent': DEFAULT_UA,
              'Accept-Encoding': 'gzip, deflate, br',
              ...(options.headers || {})
            };
            const cached = this.responseCache.get(url);
            const cachedData = cached ? cacheCleanupService.getCacheData(cached) : null;
            if (cachedData?.etag) baseHeaders['If-None-Match'] = cachedData.etag;

            const axiosResponse = await this.limit(async () => {
              return await axios({
                ...options,
                url,
                httpsAgent,
                headers: baseHeaders,
                timeout: options.timeout || this.options.requestTimeout,
                decompress: true,
              });
            });
            
            // Handle 304 Not Modified using cache
            if (axiosResponse.status === 304 && cached) {
              const cachedData = cacheCleanupService.getCacheData(cached);
              return { ...axiosResponse, data: cachedData.data };
            }

            // Update cache if ETag present and status 200 using cache service
            const newEtag = axiosResponse.headers?.etag;
            if (newEtag) {
              const cacheEntry = cacheCleanupService.createCacheEntry({
                etag: newEtag,
                data: axiosResponse.data
              });
              this.responseCache.set(url, cacheEntry);
            }

            const responseTime = Date.now() - startTime;
            
            // Update metrics on success
            this.updateProxyMetrics(null, true, responseTime);
            
            // Return successful response
            return axiosResponse;
          } catch (error) {
            // If receiving HTTP 429, open circuit and retry with a new proxy immediately
            if (error.response && error.response.status === 429) {
              const retryAfterHeader = error.response.headers['retry-after'];
              let coolDownMs;

              logger.warn('PROXY', `Received 429 Too Many Requests via Suborbit.al for ${url}`);
              
              if (retryAfterHeader) {
                const retryAfterSeconds = parseInt(retryAfterHeader, 10);
                if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
                  coolDownMs = retryAfterSeconds * 1000;
                  logger.info('PROXY', `Following Retry-After header: ${retryAfterSeconds}s for ${url}`);
                } else {
                  coolDownMs = 0; // Invalid Retry-After, try instantly
                  logger.warn('PROXY', `Invalid Retry-After header value: "${retryAfterHeader}". Retrying instantly for ${url}`);
                }
              } else {
                coolDownMs = 0; // No Retry-After header, try instantly
                logger.info('PROXY', `No Retry-After header. Retrying instantly (attempt ${attempts + 1}) for ${url}`);
              }

              const bodySnippet = JSON.stringify(error.response.data || error.message).slice(0, 200);
              logger.warn('PROXY', `Response body/error snippet for 429: ${bodySnippet}`);
              
              this.updateProxyMetrics(null, false, 0);
              attempts++;
              if (attempts < maxRetries) {
                logger.debug('PROXY', `Retrying instantly (attempt ${attempts})...`);
                await new Promise(resolve => setTimeout(resolve, coolDownMs)); // setTimeout with 0ms still yields to event loop
                continue;
              } else {
                logger.error('PROXY', `Max retries (${maxRetries}) reached for 429 on ${url}`);
                throw error; // Max retries reached for 429
              }
            }
            
            attempts++;
            lastError = error;
            
            // Don't retry 401/403 errors (private/forbidden profiles)
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
              logger.info('PROXY', `Received ${error.response.status} error for ${url} (private/forbidden data) - not retrying.`);
              this.updateProxyMetrics(null, true, 0); // Not a proxy fault.
              throw error;
            }
            
            // Detect timeout or ECONNREFUSED and reduce retry quickly
            const conciseMsg = error.code || (error.message ? error.message.split('\n')[0] : 'Unknown error');
            logger.warn('PROXY', `Suborbit.al request failed for ${url} → ${conciseMsg}`);
            // Update proxy metrics with failure
            this.updateProxyMetrics(null, false, 0);
            
            // Exponential backoff before retry
            if (attempts < maxRetries) {
              const backoffMs = 0; // Instant retry
              logger.debug('PROXY', `Retrying instantly (attempt ${attempts})...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs)); // setTimeout with 0ms still yields to event loop
            }
          }
        }
      } finally {
        this.inflightRequests.delete(key);
      }
    })();
    
    this.inflightRequests.set(key, reqPromise);
    return reqPromise;
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      proxyProvider: this.enabled ? 'Suborbit.al' : 'None',
      proxyEndpoint: this.enabled ? `${this.suborbitHost}:${this.suborbitPort}` : 'N/A',
      concurrentLimit: this.options.concurrentLimit,
      status: this.enabled ? 'Using Suborbit.al proxy service.' : 'Proxy service is not configured or disabled.'
    };
  }

  /**
   * Dynamically adjust global concurrency limit
   */
  setConcurrentLimit(newLimit) {
    if (typeof newLimit === 'number' && newLimit > 0 && newLimit !== this.options.concurrentLimit) {
      this.options.concurrentLimit = Math.min(newLimit, 500);
      this.limit = pLimit(newLimit);
      logger.info('PROXY', `Concurrency limit updated to ${newLimit}`);
    }
  }

  /**
   * Fisher-Yates shuffle in-place
   */
  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]; // This line should be fine
    }
  }

  /**
   * Estimate outbound data usage (bytes) based on avg response sizes and request count.
   * Placeholder: integrate real metrics collection outside this manager.
   */
  estimateDataUsage(avgResponseBytes, totalRequests) {
    return avgResponseBytes * totalRequests;
  }
}

// Create singleton instance
const proxyManager = new ProxyManager();

module.exports = proxyManager;
