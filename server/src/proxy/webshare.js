'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const config = require('../config');
const logger = require('../utils/logger');

const HEALTH_RATE_LIMITED_MS = 30_000;
const HEALTH_DEAD_MS = 5 * 60_000;
const TEST_URL = 'http://ip-api.com/json/?fields=status,query';
const TEST_TIMEOUT_MS = 5000;
const PROBE_HARD_TIMEOUT_MS = 7000;
const DEFAULT_TEST_CONCURRENCY = 50;
const STUCK_RUN_MS = 3 * 60_000;

const STATE_FILE = path.join(path.dirname(config.dbPath), 'proxy-state.json');

let proxies = [];
let cursor = 0;
const health = new Map();
const testResults = new Map();
const disabledIds = new Set();
let proxiesEnabled = true;

const normalizeProto = (p) => {
  const v = String(p || '').toLowerCase();
  if (v === 'http' || v === 'https') return 'http';
  if (v === 'socks' || v === 'socks4' || v === 'socks5') return 'socks5';
  return null;
};

const parseLine = (raw) => {
  const line = String(raw || '').trim();
  if (!line || line.startsWith('#')) return null;

  const urlMatch = line.match(/^(https?|socks[45]?):\/\/(?:([^:@\s]+):([^@\s]+)@)?([^:/\s]+):(\d+)/i);
  if (urlMatch) {
    return {
      ip: urlMatch[4],
      port: Number(urlMatch[5]),
      user: urlMatch[2] || null,
      pass: urlMatch[3] || null,
      protocol: normalizeProto(urlMatch[1]) || 'http',
    };
  }

  const parts = line.split(/[:@\s]+/).filter(Boolean);
  if (parts.length === 4) {
    const [ip, port, user, pass] = parts;
    return { ip, port: Number(port), user, pass, protocol: 'http' };
  }
  if (parts.length === 2) {
    const [ip, port] = parts;
    return { ip, port: Number(port), user: null, pass: null, protocol: 'http' };
  }
  return null;
};

const makeProxy = (p) => ({ id: `${p.ip}:${p.port}`, ...p });

const proxyUrl = (proxy, proto) => {
  const auth = proxy.user && proxy.pass ? `${encodeURIComponent(proxy.user)}:${encodeURIComponent(proxy.pass)}@` : '';
  return `${proto}://${auth}${proxy.ip}:${proxy.port}`;
};

const makeAgent = (proxy, proto) => {
  const url = proxyUrl(proxy, proto);
  return proto === 'socks5' ? new SocksProxyAgent(url) : new HttpsProxyAgent(url);
};

const loadState = () => {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.disabled)) {
      disabledIds.clear();
      for (const id of parsed.disabled) disabledIds.add(id);
    }
    if (typeof parsed.proxiesEnabled === 'boolean') proxiesEnabled = parsed.proxiesEnabled;
    if (parsed.testResults && typeof parsed.testResults === 'object') {
      for (const [id, r] of Object.entries(parsed.testResults)) {
        if (!r || typeof r !== 'object') continue;
        const proto = normalizeProto(r.protocol);
        testResults.set(id, {
          ok: Boolean(r.ok),
          protocol: proto || null,
          latencyMs: Number.isFinite(r.latencyMs) ? r.latencyMs : null,
          error: r.error || null,
          at: Number.isFinite(r.at) ? r.at : null,
          perProto: r.perProto || null,
        });
      }
    } else if (parsed.protocols && typeof parsed.protocols === 'object') {
      // legacy
      for (const [id, proto] of Object.entries(parsed.protocols)) {
        const n = normalizeProto(proto);
        if (n) testResults.set(id, { ok: true, protocol: n, latencyMs: null, at: null });
      }
    }
  } catch (_) { /* first run */ }
};

const saveState = () => {
  try {
    const persistedResults = {};
    for (const [id, r] of testResults.entries()) {
      persistedResults[id] = {
        ok: !!r.ok,
        protocol: r.protocol || null,
        latencyMs: r.latencyMs ?? null,
        error: r.error || null,
        at: r.at || null,
      };
    }
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      disabled: [...disabledIds],
      proxiesEnabled,
      testResults: persistedResults,
    }, null, 2));
  } catch (err) {
    logger.warn(`proxy state save failed: ${err.message}`);
  }
};

const parseText = (text) =>
  String(text || '').split(/\r?\n/).map(parseLine).filter(Boolean).map(makeProxy);

const applyPersistedProtocols = () => {
  for (const p of proxies) {
    const r = testResults.get(p.id);
    if (r?.protocol) p.protocol = r.protocol;
  }
};

const load = () => {
  try {
    const text = fs.readFileSync(config.webshareProxyFile, 'utf8');
    proxies = parseText(text);
    applyPersistedProtocols();
    logger.info(`proxies loaded: ${proxies.length}`);
  } catch (err) {
    proxies = [];
    logger.warn(`proxy file not loaded: ${err.message}`);
  }
};

const importText = (text) => {
  const parsed = parseText(text);
  if (parsed.length === 0) return { ok: false, count: 0, error: 'no valid proxy lines found' };
  try {
    fs.mkdirSync(path.dirname(config.webshareProxyFile), { recursive: true });
    fs.writeFileSync(config.webshareProxyFile, text);
  } catch (err) {
    logger.warn(`proxy file write failed: ${err.message}`);
    return { ok: false, count: 0, error: err.message };
  }
  proxies = parsed;
  testResults.clear();
  health.clear();
  disabledIds.clear();
  saveState();
  return { ok: true, count: proxies.length };
};

loadState();
load();

const isHealthy = (id) => {
  const h = health.get(id);
  if (!h) return true;
  return !(h.until && h.until > Date.now());
};

const markDead = (id) => health.set(id, { until: Date.now() + HEALTH_DEAD_MS, reason: 'dead' });
const markRateLimited = (id) => health.set(id, { until: Date.now() + HEALTH_RATE_LIMITED_MS, reason: 'rate-limited' });

const latencyOf = (id) => {
  const t = testResults.get(id);
  return t && t.ok && Number.isFinite(t.latencyMs) ? t.latencyMs : Number.POSITIVE_INFINITY;
};

const pick = (excludeIds = null) => {
  if (proxies.length === 0) return null;
  const enabled = proxies.filter((p) => !disabledIds.has(p.id) && (!excludeIds || !excludeIds.has(p.id)));
  if (enabled.length === 0) return null;
  const tested = enabled.filter((p) => {
    const t = testResults.get(p.id);
    return t && t.ok;
  });
  const pool = tested.length > 0 ? tested : enabled;
  const sorted = pool.slice().sort((a, b) => latencyOf(a.id) - latencyOf(b.id));
  for (const p of sorted) {
    if (isHealthy(p.id)) return p;
  }
  return sorted[0];
};

const agent = (proxy) => makeAgent(proxy, proxy.protocol || 'http');

const healthInfo = (id) => {
  const h = health.get(id);
  if (!h || h.until <= Date.now()) return { healthy: true };
  return { healthy: false, reason: h.reason, until: h.until };
};

// Export proxies in a re-importable text format.
// Optional filter: { enabledOnly, protocol, healthyOnly, workingOnly }.
// Each line: `protocol://user:pass@ip:port` (or `protocol://ip:port` if no creds).
const exportText = (filter = {}) => {
  const lines = [];
  for (const p of proxies) {
    if (filter.enabledOnly && disabledIds.has(p.id)) continue;
    const t = testResults.get(p.id);
    const h = healthInfo(p.id);
    if (filter.healthyOnly && h.healthy === false) continue;
    if (filter.workingOnly && (!t || !t.ok)) continue;
    const proto = (t && t.ok && t.protocol) || p.protocol || 'http';
    if (filter.protocol && proto !== filter.protocol) continue;
    const auth = p.user && p.pass
      ? `${encodeURIComponent(p.user)}:${encodeURIComponent(p.pass)}@`
      : '';
    lines.push(`${proto}://${auth}${p.ip}:${p.port}`);
  }
  return lines.join('\n');
};

const list = () => proxies.map((p) => {
  const t = testResults.get(p.id);
  return {
    id: p.id,
    ip: p.ip,
    port: p.port,
    protocol: p.protocol,
    enabled: !disabledIds.has(p.id),
    ...healthInfo(p.id),
    lastTest: t && t.at ? {
      ok: t.ok,
      latencyMs: t.latencyMs,
      protocol: t.protocol,
      error: t.error || null,
      at: t.at,
      results: t.perProto || null,
    } : null,
  };
});

const probe = (proxy, proto, timeoutMs = TEST_TIMEOUT_MS) => {
  const t0 = Date.now();
  const controller = new AbortController();
  const probePromise = (async () => {
    try {
      const a = makeAgent(proxy, proto);
      const res = await axios({
        url: TEST_URL,
        method: 'GET',
        timeout: timeoutMs,
        httpAgent: a,
        httpsAgent: a,
        proxy: false,
        signal: controller.signal,
        validateStatus: () => true,
      });
      const ok = res.status >= 200 && res.status < 400;
      return { ok, latencyMs: Date.now() - t0, error: ok ? null : `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, error: err.code || err.message || 'unknown' };
    }
  })();
  const hardTimeout = new Promise((resolve) => {
    setTimeout(() => {
      try { controller.abort(); } catch (_) { /* noop */ }
      resolve({ ok: false, latencyMs: Date.now() - t0, error: 'hard-timeout' });
    }, Math.max(timeoutMs + 2000, PROBE_HARD_TIMEOUT_MS));
  });
  return Promise.race([probePromise, hardTimeout]);
};

let testRun = null;

const testOne = async (proxy, { persist = true, timeoutMs } = {}) => {
  const [http, socks5] = await Promise.all([
    probe(proxy, 'http', timeoutMs),
    probe(proxy, 'socks5', timeoutMs),
  ]);
  const perProto = { http, socks5 };
  const working = Object.entries(perProto).filter(([, r]) => r.ok);
  working.sort(([, a], [, b]) => a.latencyMs - b.latencyMs);
  const best = working[0];
  const ok = Boolean(best);
  const result = {
    ok,
    protocol: ok ? best[0] : null,
    latencyMs: ok ? best[1].latencyMs : null,
    error: ok ? null : (perProto.http.error || perProto.socks5.error || 'all probes failed'),
    perProto,
    at: Date.now(),
  };
  testResults.set(proxy.id, result);
  if (ok) {
    proxy.protocol = best[0];
    health.delete(proxy.id);
  } else {
    markDead(proxy.id);
  }
  if (persist) saveState();
  return { id: proxy.id, ...result };
};

const testById = async (id) => {
  const proxy = proxies.find((p) => p.id === id);
  if (!proxy) return null;
  return testOne(proxy);
};

const startBackgroundTest = ({
  concurrency = DEFAULT_TEST_CONCURRENCY,
  timeoutMs = TEST_TIMEOUT_MS,
  autoRemoveDead = true,
  force = false,
  onProgress,
  onDone,
} = {}) => {
  if (testRun && testRun.status === 'running') {
    const age = Date.now() - (testRun.startedAt || 0);
    if (force || age > STUCK_RUN_MS) {
      testRun.status = 'cancelled';
      testRun.finishedAt = Date.now();
    } else {
      return testRun;
    }
  }
  if (proxies.length === 0) {
    const state = { status: 'idle', total: 0, done: 0, ok: 0, failed: 0, removedDead: 0, startedAt: null, finishedAt: Date.now() };
    testRun = state;
    onDone?.(state);
    return state;
  }
  const idsSnapshot = proxies.map((p) => p.id);
  const conc = Math.max(1, Math.min(Number(concurrency) || DEFAULT_TEST_CONCURRENCY, 200));
  const tmo = Math.max(1000, Math.min(Number(timeoutMs) || TEST_TIMEOUT_MS, 30_000));
  const state = {
    status: 'running',
    total: idsSnapshot.length,
    done: 0,
    ok: 0,
    failed: 0,
    removedDead: 0,
    startedAt: Date.now(),
    finishedAt: null,
    concurrency: conc,
    timeoutMs: tmo,
  };
  testRun = state;

  (async () => {
    try {
      onProgress?.({ ...state });
    } catch (err) {
      logger.warn(`proxy test initial emit failed: ${err.message}`);
    }
    let cursor = 0;
    let lastSave = 0;
    let lastEmit = 0;
    const safeEmit = () => {
      try { onProgress?.({ ...state }); }
      catch (err) { logger.warn(`proxy test emit failed: ${err.message}`); }
    };
    const worker = async (workerId) => {
      while (cursor < idsSnapshot.length && state.status === 'running') {
        const id = idsSnapshot[cursor++];
        try {
          const proxy = proxies.find((p) => p.id === id);
          if (!proxy) {
            state.done += 1;
            state.failed += 1;
            continue;
          }
          let r;
          try {
            r = await testOne(proxy, { persist: false, timeoutMs: tmo });
          } catch (err) {
            logger.warn(`proxy probe ${id} threw: ${err.message}`);
            r = { ok: false, error: err.message || 'probe-threw' };
            testResults.set(id, { ok: false, protocol: null, latencyMs: null, error: r.error, perProto: {}, at: Date.now() });
            markDead(id);
          }
          state.done += 1;
          if (r.ok) state.ok += 1; else state.failed += 1;
        } catch (err) {
          logger.warn(`proxy worker ${workerId} iteration failed for ${id}: ${err.message}`);
          state.done += 1;
          state.failed += 1;
        }
        const now = Date.now();
        if (now - lastSave > 1000) {
          lastSave = now;
          try { saveState(); } catch (_) { /* logged inside */ }
        }
        if (now - lastEmit > 250 || state.done === state.total) {
          lastEmit = now;
          safeEmit();
        }
      }
    };
    const workerCount = Math.min(conc, idsSnapshot.length);
    logger.info(`proxy test starting: ${idsSnapshot.length} proxies, ${workerCount} workers, ${tmo}ms timeout`);
    await Promise.allSettled(
      Array.from({ length: workerCount }, (_, i) => worker(i).catch((err) => {
        logger.warn(`proxy worker ${i} crashed: ${err.message}`);
      }))
    );
    try { saveState(); } catch (_) { /* logged */ }
    if (autoRemoveDead && state.status === 'running') {
      try {
        const removed = removeDead();
        state.removedDead = removed.removed;
        state.remaining = removed.remaining;
      } catch (err) {
        logger.warn(`auto removeDead failed: ${err.message}`);
      }
    }
    if (state.status === 'running') state.status = 'done';
    state.finishedAt = Date.now();
    logger.info(`proxy test ${state.status}: ${state.done}/${state.total} (${state.ok} ok, ${state.failed} fail, ${state.removedDead || 0} removed)`);
    try { onDone?.({ ...state }); }
    catch (err) { logger.warn(`proxy test onDone failed: ${err.message}`); }
  })();

  return state;
};

const cancelBackgroundTest = () => {
  if (testRun && testRun.status === 'running') {
    testRun.status = 'cancelled';
    testRun.finishedAt = Date.now();
  }
  return testRun || { status: 'idle' };
};

const getTestRun = () => testRun;

const setEnabled = (id, enabled) => {
  if (!proxies.find((p) => p.id === id)) return false;
  if (enabled) {
    disabledIds.delete(id);
    health.delete(id);
  } else {
    disabledIds.add(id);
  }
  saveState();
  return true;
};

const setManyEnabled = (enabled) => {
  if (enabled) {
    disabledIds.clear();
    health.clear();
  } else {
    for (const p of proxies) disabledIds.add(p.id);
  }
  saveState();
};

const clearHealth = () => { health.clear(); };

const keepOnlyWorking = () => {
  disabledIds.clear();
  let kept = 0;
  let disabled = 0;
  for (const p of proxies) {
    const t = testResults.get(p.id);
    if (t && t.ok) {
      health.delete(p.id);
      kept += 1;
    } else {
      disabledIds.add(p.id);
      disabled += 1;
    }
  }
  saveState();
  return { kept, disabled };
};

const removeDead = () => {
  const before = proxies.length;
  const survivors = proxies.filter((p) => {
    const t = testResults.get(p.id);
    return !t || t.ok;
  });
  const removed = before - survivors.length;
  if (removed === 0) return { removed: 0, remaining: before };
  for (const p of proxies) {
    if (!survivors.includes(p)) {
      disabledIds.delete(p.id);
      health.delete(p.id);
      testResults.delete(p.id);
    }
  }
  proxies = survivors;
  try {
    const text = proxies
      .map((p) => {
        const auth = p.user && p.pass ? `${p.user}:${p.pass}@` : '';
        return `${p.protocol || 'http'}://${auth}${p.ip}:${p.port}`;
      })
      .join('\n');
    fs.writeFileSync(config.webshareProxyFile, text);
  } catch (err) {
    logger.warn(`proxy file rewrite failed: ${err.message}`);
  }
  saveState();
  return { removed, remaining: proxies.length };
};

const isGloballyEnabled = () => proxiesEnabled;

const setGloballyEnabled = (enabled) => {
  proxiesEnabled = Boolean(enabled);
  saveState();
  return proxiesEnabled;
};

const protocolSummary = () => {
  const s = { http: 0, socks5: 0, untested: 0, dead: 0 };
  for (const p of proxies) {
    const t = testResults.get(p.id);
    if (!t || !t.at) { s.untested += 1; continue; }
    if (!t.ok) { s.dead += 1; continue; }
    s[t.protocol] = (s[t.protocol] || 0) + 1;
  }
  return s;
};

module.exports = {
  pick,
  agent,
  markDead,
  markRateLimited,
  count: () => proxies.length,
  enabledCount: () => proxies.filter((p) => !disabledIds.has(p.id)).length,
  reload: () => { loadState(); load(); },
  list,
  setEnabled,
  setManyEnabled,
  clearHealth,
  keepOnlyWorking,
  removeDead,
  testOne,
  testById,
  startBackgroundTest,
  cancelBackgroundTest,
  getTestRun,
  isGloballyEnabled,
  setGloballyEnabled,
  protocolSummary,
  importText,
  exportText,
};
