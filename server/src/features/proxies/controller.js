'use strict';

const webshare = require('../../proxy/webshare');
const suborbit = require('../../proxy/suborbit');
const socketBus = require('../../socket');

const list = async (_req, res, next) => {
  try {
    res.json({
      proxiesEnabled: webshare.isGloballyEnabled(),
      protocolSummary: webshare.protocolSummary(),
      webshare: {
        total: webshare.count(),
        enabled: webshare.enabledCount(),
        proxies: webshare.list(),
      },
      suborbit: {
        configured: suborbit.enabled,
      },
    });
  } catch (err) { next(err); }
};

const setOne = async (req, res, next) => {
  try {
    const id = req.params.id;
    const enabled = req.body?.enabled === true || req.body?.enabled === 'true';
    const ok = webshare.setEnabled(id, enabled);
    if (!ok) return res.status(404).json({ error: 'proxy not found' });
    res.json({ id, enabled });
  } catch (err) { next(err); }
};

const setAll = async (req, res, next) => {
  try {
    const enabled = req.body?.enabled === true || req.body?.enabled === 'true';
    webshare.setManyEnabled(enabled);
    res.json({ enabled });
  } catch (err) { next(err); }
};

const setGlobal = async (req, res, next) => {
  try {
    const enabled = req.body?.enabled === true || req.body?.enabled === 'true';
    const result = webshare.setGloballyEnabled(enabled);
    res.json({ proxiesEnabled: result });
  } catch (err) { next(err); }
};

const reload = async (_req, res, next) => {
  try {
    webshare.reload();
    res.json({ total: webshare.count(), enabled: webshare.enabledCount() });
  } catch (err) { next(err); }
};

const clearHealth = async (_req, res, next) => {
  try {
    webshare.clearHealth();
    res.json({ ok: true });
  } catch (err) { next(err); }
};

const keepWorking = async (_req, res, next) => {
  try {
    res.json(webshare.keepOnlyWorking());
  } catch (err) { next(err); }
};

const removeDead = async (_req, res, next) => {
  try {
    res.json(webshare.removeDead());
  } catch (err) { next(err); }
};

const testOne = async (req, res, next) => {
  try {
    const r = await webshare.testById(req.params.id);
    if (!r) return res.status(404).json({ error: 'proxy not found' });
    res.json(r);
  } catch (err) { next(err); }
};

const testAll = async (req, res, next) => {
  try {
    const force = req.body?.force === true;
    const existing = webshare.getTestRun();
    if (!force && existing && existing.status === 'running') {
      return res.status(202).json({ started: false, alreadyRunning: true, ...existing });
    }
    const timeoutMs = req.body?.timeoutMs != null ? Number(req.body.timeoutMs) : undefined;
    const concurrency = req.body?.concurrency != null ? Number(req.body.concurrency) : undefined;
    const autoRemoveDead = req.body?.autoRemoveDead !== false;
    const state = webshare.startBackgroundTest({
      concurrency,
      timeoutMs,
      autoRemoveDead,
      force,
      onProgress: (s) => socketBus.emit('proxies:testProgress', s),
      onDone: (s) => socketBus.emit('proxies:testDone', { ...s, summary: webshare.protocolSummary() }),
    });
    res.status(202).json({ started: true, ...state });
  } catch (err) { next(err); }
};

const testCancel = async (_req, res, next) => {
  try {
    const state = webshare.cancelBackgroundTest();
    socketBus.emit('proxies:testDone', state);
    res.json(state);
  } catch (err) { next(err); }
};

const testStatus = async (_req, res, next) => {
  try {
    res.json(webshare.getTestRun() || { status: 'idle' });
  } catch (err) { next(err); }
};

const importProxies = async (req, res, next) => {
  try {
    const text = typeof req.body === 'string' ? req.body : (req.body?.text || '');
    if (!text) return res.status(400).json({ error: 'no text provided' });
    const result = webshare.importText(text);
    if (!result.ok) return res.status(400).json({ error: result.error || 'import failed' });
    res.json(result);
  } catch (err) { next(err); }
};

const exportProxies = async (req, res, next) => {
  try {
    const enabledOnly = req.query?.enabledOnly === 'true';
    const workingOnly = req.query?.workingOnly === 'true';
    const healthyOnly = req.query?.healthyOnly === 'true';
    const protocol = req.query?.protocol === 'http' || req.query?.protocol === 'socks5'
      ? req.query.protocol : undefined;
    const text = webshare.exportText({ enabledOnly, workingOnly, healthyOnly, protocol });
    res.type('text/plain').send(text);
  } catch (err) { next(err); }
};

module.exports = {
  list, setOne, setAll, setGlobal, reload, clearHealth, testOne, testAll, testStatus, testCancel,
  importProxies, exportProxies, keepWorking, removeDead,
};
