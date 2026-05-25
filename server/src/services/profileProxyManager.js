const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const pLimit = require('p-limit').default;
const logger = require('../utils/logger');

/**
 * ProfileProxyManager
 * Handles outbound requests that relate to Steam *profile information* using a
 * static list of datacenter proxies stored in `Webshare 10 proxies.txt`.
 *
 * The Suborbit.al back-connect proxy (see `proxyManager.js`) remains the
 * default for *inventory* and other heavier operations. This manager now includes
 * intelligent proxy rotation, health tracking, and rate limit avoidance.
 */
class ProfileProxyManager {
  constructor(options = {}) {
    // Location of the proxy list – three levels up from this file.
    const defaultProxyPath = path.resolve(__dirname, '../../../Webshare 10 proxies.txt');

    this.proxyFile = options.proxyFile || defaultProxyPath;
    this.concurrency = options.concurrentLimit || 20; // Reduced from 60 to prevent overwhelming proxies
    this.retryLimit = options.retryLimit || 3;
    this.timeout = options.requestTimeout || 6000; // Reduced from 10s to 6s for faster processing

    this.limit = pLimit(this.concurrency);

    // Proxy health tracking
    this.proxyHealth = new Map(); // proxyString -> { lastUsed: timestamp, rateLimitedUntil: timestamp, consecutiveFailures: number }
    this.currentProxyIndex = 0; // For round-robin selection
    this.rateLimitBackoffMs = 30000; // 30 seconds backoff for rate limited proxies

    this.proxies = this.loadProxies();
    if (this.proxies.length === 0) {
      logger.warn('ProfileProxyManager', `No proxies loaded from ${this.proxyFile}. Requests will be made without a proxy.`);
    } else {
      logger.info('ProfileProxyManager', `Loaded ${this.proxies.length} healthy proxies from ${path.basename(this.proxyFile)}`);
    }

    // Clean up stale health data every 5 minutes
    setInterval(() => this.cleanupHealthData(), 5 * 60 * 1000);
  }

  /**
   * Read proxies from file.
   * Expected line format per proxy: ip:port:user:pass
   * Blank lines are ignored.
   */
  loadProxies() {
    try {
      const raw = fs.readFileSync(this.proxyFile, 'utf8');
      return raw
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && /\d+\.\d+\.\d+\.\d+:\d+:.*:.*/.test(l));
    } catch (err) {
      logger.error('ProfileProxyManager', `Failed to load proxy list: ${err.message}`);
      return [];
    }
  }

  /**
   * Get next healthy proxy using round-robin selection, skipping rate-limited ones.
   */
  getNextHealthyProxy() {
    if (this.proxies.length === 0) return null;

    const now = Date.now();
    const startIndex = this.currentProxyIndex;
    let attempts = 0;

    while (attempts < this.proxies.length) {
      const proxy = this.proxies[this.currentProxyIndex];
      const health = this.proxyHealth.get(proxy) || { rateLimitedUntil: 0, deadUntil: 0, consecutiveFailures: 0 };

      // Skip if proxy is rate limited or dead
      if (health.rateLimitedUntil > now) {
        logger.debug('ProfileProxyManager', `Skipping rate-limited proxy: ${this.formatProxyUrl(proxy)} (backoff until ${new Date(health.rateLimitedUntil).toISOString()})`);
      } else if (health.deadUntil > now) {
        logger.debug('ProfileProxyManager', `Skipping dead proxy: ${this.formatProxyUrl(proxy)} (dead until ${new Date(health.deadUntil).toISOString()})`);
      } else {
        // Use this proxy
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
        this.updateProxyHealth(proxy, 'used');
        return proxy;
      }

      // Move to next proxy
      this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
      attempts++;
    }

    // If all proxies are rate limited or dead, use the one with shortest remaining time
    logger.warn('ProfileProxyManager', 'All proxies are rate limited or dead, using least restricted one');
    let bestProxy = null;
    let earliestAvailable = Infinity;

    for (const proxy of this.proxies) {
      const health = this.proxyHealth.get(proxy) || { rateLimitedUntil: 0, deadUntil: 0 };
      const effectiveRestriction = Math.max(health.rateLimitedUntil, health.deadUntil);
      if (effectiveRestriction < earliestAvailable) {
        earliestAvailable = effectiveRestriction;
        bestProxy = proxy;
      }
    }

    if (bestProxy) {
      this.updateProxyHealth(bestProxy, 'used');
      return bestProxy;
    }

    return null;
  }

  /**
   * Update proxy health based on usage outcome.
   */
  updateProxyHealth(proxyString, outcome, error = null) {
    const now = Date.now();
    const health = this.proxyHealth.get(proxyString) || {
      lastUsed: 0,
      rateLimitedUntil: 0,
      consecutiveFailures: 0,
      deadUntil: 0 // New field for connection failures
    };

    health.lastUsed = now;

    if (outcome === 'success') {
      health.consecutiveFailures = 0;
      health.deadUntil = 0; // Clear dead status
      // Clear rate limit if it was set
      if (health.rateLimitedUntil > 0) {
        logger.debug('ProfileProxyManager', `Proxy recovered: ${this.formatProxyUrl(proxyString)}`);
        health.rateLimitedUntil = 0;
      }
    } else if (outcome === 'rate_limited') {
      health.consecutiveFailures++;
      health.rateLimitedUntil = now + this.rateLimitBackoffMs;
      logger.debug('ProfileProxyManager', `Proxy rate limited: ${this.formatProxyUrl(proxyString)}, backoff until ${new Date(health.rateLimitedUntil).toISOString()}`);
    } else if (outcome === 'connection_failed') {
      health.consecutiveFailures++;
      // Mark as dead for 5 minutes on connection failures
      health.deadUntil = now + (5 * 60 * 1000);
      logger.debug('ProfileProxyManager', `Proxy connection failed: ${this.formatProxyUrl(proxyString)}, marked dead until ${new Date(health.deadUntil).toISOString()}`);
    } else if (outcome === 'error') {
      health.consecutiveFailures++;
      // For other errors, use shorter backoff
      if (health.consecutiveFailures >= 3) {
        health.rateLimitedUntil = now + (this.rateLimitBackoffMs / 2);
      }
    }

    this.proxyHealth.set(proxyString, health);
  }

  /**
   * Clean up stale health data for proxies no longer in use.
   */
  cleanupHealthData() {
    const now = Date.now();
    const staleThreshold = 60 * 60 * 1000; // 1 hour

    for (const [proxy, health] of this.proxyHealth.entries()) {
      if (now - health.lastUsed > staleThreshold) {
        this.proxyHealth.delete(proxy);
      }
    }

    logger.debug('ProfileProxyManager', `Cleaned up health data, ${this.proxyHealth.size} proxies tracked`);
  }

  /**
   * Convert raw "ip:port:user:pass" (or "ip:port") string into a valid URL
   * compatible with `HttpsProxyAgent` – i.e. "http://user:pass@ip:port".
   */
  formatProxyUrl(proxyString) {
    if (!proxyString) return null;
    const parts = proxyString.split(':');
    if (parts.length === 2) {
      // ip:port
      const [ip, port] = parts;
      return `http://${ip}:${port}`;
    }
    if (parts.length >= 4) {
      const [ip, port, user, pass] = parts;
      return `http://${user}:${pass}@${ip}:${port}`;
    }
    // fallback (invalid)
    return null;
  }

  /**
   * Low-level helper that performs the HTTP(S) request through a proxy.
   */
  async _doRequest(url, axiosOptions, proxyString) {
    const proxyUrl = this.formatProxyUrl(proxyString);
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

    return axios({
      url,
      httpAgent: agent,
      httpsAgent: agent,
      method: axiosOptions.method || 'GET',
      headers: axiosOptions.headers || {},
      timeout: axiosOptions.timeout || this.timeout,
      ...axiosOptions,
    });
  }

  /**
   * Public API – mirrors the signature used by the existing ProxyManager so we
   * can drop-in replace calls (url, options).
   */
  async makeRequest(url, options = {}) {
    return this.limit(async () => {
      const maxRetries = options.maxRetries != null ? options.maxRetries : this.retryLimit;
      let attempt = 0;
      let lastError;
      let lastUsedProxy = null;

      while (attempt <= maxRetries) {
        const proxy = this.getNextHealthyProxy();
        lastUsedProxy = proxy;

        try {
          const resp = await this._doRequest(url, options, proxy);

          // Success - update proxy health
          if (proxy) {
            this.updateProxyHealth(proxy, 'success');
          }

          return resp;
        } catch (err) {
          lastError = err;
          attempt += 1;

          const statusCode = err.response?.status;
          const isRateLimit = statusCode === 429;
          const isPrivateError = statusCode === 401 || statusCode === 403;
          const isConnectionError = err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND';
          const conciseMsg = err.code || (err.message ? err.message.split('\n')[0] : 'Unknown error');
          const statusInfo = statusCode ? ` (HTTP ${statusCode})` : '';

          // Update proxy health based on error type
          if (proxy) {
            if (isRateLimit) {
              this.updateProxyHealth(proxy, 'rate_limited', err);
            } else if (isConnectionError) {
              this.updateProxyHealth(proxy, 'connection_failed', err);
            } else {
              this.updateProxyHealth(proxy, 'error', err);
            }
          }

          // Reduce verbosity for 401/403 errors (private profiles)
          if (!isPrivateError) {
            const proxyInfo = proxy ? ` via ${this.formatProxyUrl(proxy)}` : ' DIRECT';
            logger.debug('ProfileProxyManager', `Attempt ${attempt}/${maxRetries}${proxyInfo} failed → ${conciseMsg}${statusInfo}`);
          }

          // On last attempt, throw
          if (attempt > maxRetries) {
            if (isPrivateError) {
              logger.debug('ProfileProxyManager', `Private profile access denied for ${url}${statusInfo}`);
            } else {
              logger.warn('ProfileProxyManager', `All ${maxRetries} attempts failed for ${url}${statusInfo}`);
            }
            throw err;
          }

          // Small delay before retry to be more respectful
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          }
        }
      }
      // in theory unreachable
      throw lastError;
    });
  }

  /**
   * Basic stats for monitoring.
   */
  getStats() {
    const now = Date.now();
    let healthy = 0;
    let rateLimited = 0;
    let dead = 0;

    for (const proxy of this.proxies) {
      const health = this.proxyHealth.get(proxy) || { rateLimitedUntil: 0, deadUntil: 0 };
      if (health.deadUntil > now) {
        dead++;
      } else if (health.rateLimitedUntil > now) {
        rateLimited++;
      } else {
        healthy++;
      }
    }

    return {
      total: this.proxies.length,
      healthy,
      rateLimited,
      dead,
      concurrentLimit: this.concurrency,
      healthTracked: this.proxyHealth.size,
    };
  }

  /**
   * Allow dynamic tuning of concurrency from callers.
   */
  setConcurrentLimit(newLimit) {
    if (typeof newLimit === 'number' && newLimit > 0 && newLimit !== this.concurrency) {
      this.concurrency = newLimit;
      this.limit = pLimit(newLimit);
    }
  }
}

module.exports = new ProfileProxyManager();
