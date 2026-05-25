'use strict';

const { models } = require('../../db');
const community = require('../../steam/community');
const prices = require('../prices/service');
const logger = require('../../utils/logger');

const buildMarketHashName = (desc) => desc?.market_hash_name || desc?.market_name || desc?.name || null;

const processInventory = (resp) => {
  if (!resp || !Array.isArray(resp.descriptions) || !Array.isArray(resp.assets)) {
    return { total: 0, tradable: 0, items: [] };
  }
  const descMap = new Map();
  for (const d of resp.descriptions) {
    descMap.set(`${d.classid}_${d.instanceid}`, d);
  }
  const items = [];
  for (const asset of resp.assets) {
    const desc = descMap.get(`${asset.classid}_${asset.instanceid}`);
    if (!desc) continue;
    const tradable = desc.tradable === 1 || desc.tradable === true;
    items.push({
      name: buildMarketHashName(desc),
      tradable,
      classid: asset.classid,
      icon: desc.icon_url || null,
    });
  }
  const tradable = items.filter((i) => i.tradable).length;
  return { total: items.length, tradable, items };
};

const getStored = (profileId) =>
  models.CS2Inventory.findOne({ where: { profileId }, raw: true });

const upsert = async (profileId, payload) => {
  await models.CS2Inventory.upsert({ profileId, ...payload });
  return getStored(profileId);
};

const fetchAndStore = async (profileId) => {
  const t0 = Date.now();
  const resp = await community.fetchCs2Inventory(profileId);
  if (resp.status === 'private') {
    return upsert(profileId, {
      status: 'private',
      skipReason: resp.reason || null,
      totalValueUsd: 0,
      tradableItemsCount: 0,
      totalItemsCount: 0,
      top5TradableItems: [],
      lastChecked: new Date(),
      processingTimeMs: Date.now() - t0,
    });
  }
  if (resp.status === 'error') {
    return upsert(profileId, {
      status: 'error',
      skipReason: resp.reason || null,
      totalValueUsd: 0,
      tradableItemsCount: 0,
      totalItemsCount: 0,
      top5TradableItems: [],
      lastChecked: new Date(),
      processingTimeMs: Date.now() - t0,
    });
  }
  if (resp.status === 'empty') {
    return upsert(profileId, {
      status: 'empty',
      totalValueUsd: 0,
      tradableItemsCount: 0,
      totalItemsCount: 0,
      top5TradableItems: [],
      lastChecked: new Date(),
      processingTimeMs: Date.now() - t0,
    });
  }

  const processed = processInventory(resp);
  const tradableItems = processed.items.filter((i) => i.tradable && i.name);
  const uniqueNames = Array.from(new Set(tradableItems.map((i) => i.name)));
  const priceMap = await prices.getPrices(uniqueNames);

  let totalValue = 0;
  for (const item of tradableItems) {
    const p = priceMap.get(item.name);
    if (Number.isFinite(p)) {
      item.price = p;
      totalValue += p;
    }
  }

  const top5 = tradableItems
    .filter((i) => Number.isFinite(i.price))
    .sort((a, b) => b.price - a.price)
    .slice(0, 5)
    .map((i) => ({ name: i.name, price: i.price, icon: i.icon }));

  return upsert(profileId, {
    status: 'checked',
    totalValueUsd: Number(totalValue.toFixed(2)),
    tradableItemsCount: processed.tradable,
    totalItemsCount: processed.total,
    top5TradableItems: top5,
    lastChecked: new Date(),
    processingTimeMs: Date.now() - t0,
  });
};

const stats = async () => {
  const total = await models.CS2Inventory.count();
  const checked = await models.CS2Inventory.count({ where: { status: 'checked' } });
  const priv = await models.CS2Inventory.count({ where: { status: 'private' } });
  const err = await models.CS2Inventory.count({ where: { status: 'error' } });
  return { total, checked, private: priv, error: err };
};

module.exports = { getStored, fetchAndStore, stats };
