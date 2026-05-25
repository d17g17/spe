'use strict';

const { Op } = require('sequelize');
const { models } = require('../../db');
const community = require('../../steam/community');
const config = require('../../config');

const CASE_RE = /(Case|Capsule|Sticker Capsule|Patch Pack|Souvenir Package)/i;
const isCase = (name) => CASE_RE.test(name);

const isFresh = (row) => {
  if (!row) return false;
  const ageMs = Date.now() - new Date(row.lastUpdated).getTime();
  const maxAgeMs = (row.isCase ? config.casePriceHours : config.itemPriceDays * 24) * 3600_000;
  return ageMs < maxAgeMs;
};

const getCachedMap = async (names) => {
  if (names.length === 0) return new Map();
  const rows = await models.ItemPrice.findAll({
    where: { itemIdentifier: { [Op.in]: names } },
    raw: true,
  });
  return new Map(rows.map((r) => [r.itemIdentifier, r]));
};

const upsertPrice = async (name, price, volume) => {
  const isC = isCase(name);
  await models.ItemPrice.upsert({
    itemIdentifier: name,
    priceUsd: price,
    lastUpdated: new Date(),
    isCase: isC,
    fetchCount: 1,
    volume: volume || 0,
  });
};

const PRICE_FETCH_CONCURRENCY = 10;
const PRICE_FETCH_RETRIES = 1;

const runPool = async (items, worker, concurrency) => {
  const it = items[Symbol.iterator]();
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const next = it.next();
      if (next.done) return;
      await worker(next.value);
    }
  });
  await Promise.all(workers);
};

const fetchWithRetry = async (name, retries) => {
  for (let i = 0; i <= retries; i += 1) {
    const r = await community.fetchMarketPrice(name);
    if (r && r.price != null) return r;
    if (i < retries) await new Promise((res) => setTimeout(res, 250 + Math.random() * 500));
  }
  return null;
};

const getPrices = async (names) => {
  const cached = await getCachedMap(names);
  const out = new Map();
  const stale = [];
  for (const name of names) {
    const row = cached.get(name);
    if (row && isFresh(row)) out.set(name, { price: Number(row.priceUsd), volume: Number(row.volume) || 0 });
    else stale.push(name);
  }
  await runPool(stale, async (name) => {
    const fetched = await fetchWithRetry(name, PRICE_FETCH_RETRIES);
    if (fetched && fetched.price != null) {
      await upsertPrice(name, fetched.price, fetched.volume);
      out.set(name, fetched);
    } else {
      const row = cached.get(name);
      if (row) out.set(name, { price: Number(row.priceUsd), volume: Number(row.volume) || 0 });
    }
  }, PRICE_FETCH_CONCURRENCY);
  return out;
};

const listAll = async () => {
  const rows = await models.ItemPrice.findAll({ raw: true, order: [['lastUpdated', 'DESC']] });
  return rows;
};

const importMany = async (items) => {
  if (!Array.isArray(items)) return { imported: 0 };
  const cleaned = items
    .filter((i) => i && typeof i.itemIdentifier === 'string' && Number.isFinite(Number(i.priceUsd)))
    .map((i) => ({
      itemIdentifier: i.itemIdentifier,
      priceUsd: Number(i.priceUsd),
      lastUpdated: i.lastUpdated ? new Date(i.lastUpdated) : new Date(),
      isCase: Boolean(i.isCase),
      fetchCount: Number(i.fetchCount) || 1,
    }));
  if (cleaned.length === 0) return { imported: 0 };
  await models.ItemPrice.bulkCreate(cleaned, {
    updateOnDuplicate: ['priceUsd', 'lastUpdated', 'isCase', 'fetchCount'],
  });
  return { imported: cleaned.length };
};

const clearAll = async () => {
  const n = await models.ItemPrice.destroy({ where: {}, truncate: false });
  return { deleted: n };
};

const stats = async () => {
  const total = await models.ItemPrice.count();
  const cases = await models.ItemPrice.count({ where: { isCase: true } });
  const recent = await models.ItemPrice.count({
    where: { lastUpdated: { [Op.gt]: new Date(Date.now() - 24 * 3600_000) } },
  });
  return { total, cases, recent24h: recent };
};

module.exports = { getPrices, listAll, importMany, clearAll, stats, isCase };
