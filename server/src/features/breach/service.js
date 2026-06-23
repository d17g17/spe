'use strict';

const crypto = require('crypto');
const axios = require('axios');
const suborbit = require('../../proxy/suborbit');
const { models } = require('../../db');
const logger = require('../../utils/logger');

const ENDPOINT = process.env.BREACH_API_URL || 'https://breach.vip/api/search';
const REQUEST_TIMEOUT_MS = 30_000;

// Allowed search fields per the upstream OpenAPI spec.
const ALLOWED_FIELDS = new Set([
  'domain', 'steamid', 'phone', 'name', 'email',
  'username', 'password', 'ip', 'discordid', 'uuid',
]);

const sanitizeFields = (fields) => {
  if (!Array.isArray(fields)) return [];
  const out = [];
  for (const f of fields) {
    if (typeof f === 'string' && ALLOWED_FIELDS.has(f) && !out.includes(f)) out.push(f);
    if (out.length >= 10) break;
  }
  return out;
};

const search = async ({ term, fields, wildcard, caseSensitive }) => {
  if (typeof term !== 'string' || term.length === 0 || term.length > 100) {
    const e = new Error('term must be a non-empty string up to 100 chars');
    e.status = 400; throw e;
  }
  const safeFields = sanitizeFields(fields);
  if (safeFields.length === 0) {
    const e = new Error('fields must include at least one of: ' + Array.from(ALLOWED_FIELDS).join(', '));
    e.status = 400; throw e;
  }

  const body = {
    term,
    fields: safeFields,
    wildcard: Boolean(wildcard),
    case_sensitive: Boolean(caseSensitive),
  };

  // axios's `timeout` option is unreliable when a custom httpsAgent is in use
  // (request can hang at TLS/connect time with no callback firing). Pair it
  // with an AbortController hard cap so the request always resolves.
  const controller = new AbortController();
  const hardTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const opts = {
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    validateStatus: () => true,
    signal: controller.signal,
  };
  if (suborbit.enabled && suborbit.agent) {
    opts.httpAgent = suborbit.agent;
    opts.httpsAgent = suborbit.agent;
    opts.proxy = false;
  }

  const via = suborbit.enabled ? 'suborbit' : 'direct';
  const t0 = Date.now();
  try {
    const { data, status } = await axios.post(ENDPOINT, body, opts);
    const dur = Date.now() - t0;
    logger.info(`breach search "${term}" fields=${safeFields.join('+')} via ${via} -> http ${status}, ${Array.isArray(data?.results) ? data.results.length : 0} results in ${dur}ms`);
    return data;
  } catch (err) {
    const dur = Date.now() - t0;
    const aborted = err.code === 'ERR_CANCELED' || err.name === 'CanceledError';
    logger.warn(`breach search via ${via} failed in ${dur}ms: ${aborted ? `aborted after ${REQUEST_TIMEOUT_MS}ms` : err.message}`);
    throw err;
  } finally {
    clearTimeout(hardTimer);
  }
};

// ---- Cache: link breach rows to a specific Steam profile for re-use --------
//
// Each row is stored with a stable hash (sha1 over its sorted-key JSON) so
// (profile_id, row_hash) uniquely identifies a saved entry. That way saving
// the same record twice is a no-op, and the client can show which rows are
// already cached without re-querying.

const hashRow = (row) => {
  const sorted = {};
  for (const k of Object.keys(row).sort()) sorted[k] = row[k];
  return crypto.createHash('sha1').update(JSON.stringify(sorted)).digest('hex');
};

const listCache = async (profileId) => {
  if (!profileId) return [];
  const rows = await models.BreachCache.findAll({
    where: { profileId: String(profileId) },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    rowHash: r.rowHash,
    createdAt: r.createdAt,
    row: safeJson(r.rowJson),
  }));
};

const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };

const saveCache = async (profileId, items) => {
  if (!profileId) {
    const e = new Error('profileId required'); e.status = 400; throw e;
  }
  if (!Array.isArray(items) || items.length === 0) return { saved: 0, entries: [] };

  const records = items
    .filter((it) => it && it.row && typeof it.row === 'object')
    .map((it) => {
      const source = (it.source || it.row.source || 'unknown').toString();
      const row = it.row;
      return {
        profileId: String(profileId),
        source,
        rowHash: hashRow(row),
        rowJson: JSON.stringify(row),
      };
    });

  if (records.length === 0) return { saved: 0, entries: [] };

  // Use bulkCreate with ignoreDuplicates so re-saving an existing row is a no-op.
  await models.BreachCache.bulkCreate(records, { ignoreDuplicates: true });
  const entries = await listCache(profileId);
  return { saved: records.length, entries };
};

const deleteCacheEntry = async (id) => {
  const n = await models.BreachCache.destroy({ where: { id: Number(id) } });
  return { deleted: n };
};

const clearCacheForProfile = async (profileId) => {
  const n = await models.BreachCache.destroy({ where: { profileId: String(profileId) } });
  return { deleted: n };
};

module.exports = {
  search,
  listCache,
  saveCache,
  deleteCacheEntry,
  clearCacheForProfile,
  hashRow,
  ALLOWED_FIELDS: Array.from(ALLOWED_FIELDS),
};
