'use strict';

const service = require('./service');

const search = async (req, res, next) => {
  try {
    const { term, fields, wildcard, caseSensitive, case_sensitive } = req.body || {};
    const data = await service.search({
      term,
      fields,
      wildcard,
      caseSensitive: caseSensitive ?? case_sensitive,
    });
    // Upstream returns a 4xx/5xx-shaped JSON body even on success path because
    // we set validateStatus=()=>true. Pass non-2xx through with original status.
    if (data && data.error) {
      const status = /rate limited/i.test(data.error) ? 429
        : /bad request/i.test(data.error) ? 400
        : /method not allowed/i.test(data.error) ? 405
        : /internal/i.test(data.error) ? 502
        : 502;
      return res.status(status).json({ error: data.error, kind: 'breach-upstream' });
    }
    res.json(data || { results: [] });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
};

const fields = (_req, res) => res.json({ fields: service.ALLOWED_FIELDS });

const cacheList = async (req, res, next) => {
  try {
    const entries = await service.listCache(req.params.steamId);
    res.json({ entries });
  } catch (err) { next(err); }
};

const cacheSave = async (req, res, next) => {
  try {
    const { profileId, items, rows } = req.body || {};
    // accept either { items: [{source, row}] } or { rows: [row, ...] }
    const list = Array.isArray(items)
      ? items
      : Array.isArray(rows)
        ? rows.map((r) => ({ source: r.source, row: r }))
        : [];
    const out = await service.saveCache(profileId, list);
    res.json(out);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
};

const cacheDelete = async (req, res, next) => {
  try {
    const out = await service.deleteCacheEntry(req.params.id);
    res.json(out);
  } catch (err) { next(err); }
};

const cacheClearProfile = async (req, res, next) => {
  try {
    const out = await service.clearCacheForProfile(req.params.steamId);
    res.json(out);
  } catch (err) { next(err); }
};

module.exports = { search, fields, cacheList, cacheSave, cacheDelete, cacheClearProfile };
