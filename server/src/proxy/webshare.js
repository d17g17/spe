'use strict';

const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const config = require('../config');
const logger = require('../utils/logger');

const HEALTH_RATE_LIMITED_MS = 30_000;
const HEALTH_DEAD_MS = 5 * 60_000;

let proxies = [];
let cursor = 0;
const health = new Map();

const parse = (line) => {
  const parts = line.trim().split(':');
  if (parts.length !== 4) return null;
  const [ip, port, user, pass] = parts;
  return { id: `${ip}:${port}`, url: `http://${user}:${pass}@${ip}:${port}` };
};

const load = () => {
  try {
    const text = fs.readFileSync(config.webshareProxyFile, 'utf8');
    proxies = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parse)
      .filter(Boolean);
    logger.info(`webshare proxies loaded: ${proxies.length}`);
  } catch (err) {
    proxies = [];
    logger.warn(`webshare proxy file not loaded: ${err.message}`);
  }
};

load();

const isHealthy = (id) => {
  const h = health.get(id);
  if (!h) return true;
  if (h.until && h.until > Date.now()) return false;
  return true;
};

const markDead = (id) => health.set(id, { until: Date.now() + HEALTH_DEAD_MS });
const markRateLimited = (id) => health.set(id, { until: Date.now() + HEALTH_RATE_LIMITED_MS });

const pick = () => {
  if (proxies.length === 0) return null;
  for (let i = 0; i < proxies.length; i++) {
    const p = proxies[(cursor + i) % proxies.length];
    cursor = (cursor + 1) % proxies.length;
    if (isHealthy(p.id)) return p;
  }
  return proxies[cursor++ % proxies.length];
};

const agent = (proxy) => new HttpsProxyAgent(proxy.url);

module.exports = { pick, agent, markDead, markRateLimited, count: () => proxies.length, reload: load };
