'use strict';

const { models } = require('../../db');
const community = require('../../steam/community');
const prices = require('../prices/service');
const { extractStickers, itemRarityScore } = require('../../steam/stickers');
const { extractTraits, traitScore } = require('../../steam/itemTraits');
const logger = require('../../utils/logger');

const buildMarketHashName = (desc) => desc?.market_hash_name || desc?.market_name || desc?.name || null;

const MEDAL_RE = /(service medal|premier season|veteran coin|loyalty badge|commemorative|global offensive badge|\d+\s*year veteran|operation.*coin|\bcoin\b)/i;
const MEDAL_SKIP_RE = /(sticker|case|capsule|graffiti|music kit|patch pack|agent|pin)/i;

const isMedalOrCoin = (name) => {
  if (!name) return false;
  if (MEDAL_SKIP_RE.test(name)) return false;
  return MEDAL_RE.test(name);
};

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
    const stickers = extractStickers(desc);
    items.push({
      name: buildMarketHashName(desc),
      tradable,
      classid: asset.classid,
      icon: desc.icon_url || null,
      stickers,
    });
  }
  const tradable = items.filter((i) => i.tradable).length;
  return { total: items.length, tradable, items };
};

const getStored = async (profileId) => {
  const row = await models.CS2Inventory.findOne({ where: { profileId } });
  return row ? row.toJSON() : null;
};

const ensureProfileExists = async (steamId) => {
  const existing = await models.Profile.findByPk(steamId, { attributes: ['steamId'] });
  if (existing) return;
  await models.Profile.create({
    steamId,
    hasCyrillic: false,
    vacBanned: false,
    gameBanned: false,
    tradeBanned: false,
  });
};

const upsert = async (profileId, payload) => {
  await ensureProfileExists(profileId);
  await models.CS2Inventory.upsert({ profileId, ...payload });
  return getStored(profileId);
};

const fetchAndStore = async (profileId) => {
  const t0 = Date.now();
  const existing = await getStored(profileId);
  const hasGoodPrior = existing && (existing.status === 'checked' || existing.status === 'empty');
  const resp = await community.fetchCs2Inventory(profileId);

  if (resp.status === 'error') {
    if (hasGoodPrior) {
      logger.warn(`cs2 fetch transient error for ${profileId} (${resp.reason}) - keeping prior ${existing.status} data`);
      await models.CS2Inventory.update(
        { lastChecked: new Date(), skipReason: `transient: ${resp.reason || 'unknown'}` },
        { where: { profileId } }
      );
      return getStored(profileId);
    }
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
  if (resp.status === 'private') {
    if (hasGoodPrior) {
      logger.warn(`cs2 fetch returned private for ${profileId} - keeping prior ${existing.status} data (possible false positive)`);
      await models.CS2Inventory.update(
        { lastChecked: new Date(), skipReason: `transient: looked private (${resp.reason || 'unknown'})` },
        { where: { profileId } }
      );
      return getStored(profileId);
    }
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
  const tradableNames = processed.items.filter((i) => i.tradable && i.name).map((i) => i.name);
  const stickerNames = [];
  for (const it of processed.items) {
    for (const s of it.stickers || []) {
      if (s.name) stickerNames.push(`Sticker | ${s.name}`);
    }
  }
  const uniqueNames = Array.from(new Set([...tradableNames, ...stickerNames]));
  const priceMap = await prices.getPrices(uniqueNames);

  const aggregated = new Map();
  for (const item of processed.items) {
    if (!item.name) continue;
    const pricedStickers = (item.stickers || []).map((s) => {
      const sp = s.name ? priceMap.get(`Sticker | ${s.name}`) : null;
      return { ...s, price: sp ? sp.price : null };
    });
    const stickerKey = pricedStickers.map((s) => s.icon || s.name || '').join('|');
    const key = `${item.name}|${item.tradable ? 't' : 'n'}|${stickerKey}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      const pv = item.tradable ? priceMap.get(item.name) : null;
      aggregated.set(key, {
        name: item.name,
        tradable: item.tradable,
        icon: item.icon,
        price: pv ? pv.price : null,
        volume: pv ? pv.volume : 0,
        quantity: 1,
        stickers: pricedStickers,
      });
    }
  }
  const items = Array.from(aggregated.values()).map((it) => {
    const stickerTotal = (it.stickers || []).reduce(
      (acc, s) => acc + (Number.isFinite(s.price) ? s.price : 0),
      0
    );
    const traits = extractTraits(it.name);
    return {
      ...it,
      traits,
      stickerTotal: Number(stickerTotal.toFixed(2)),
      totalPrice: Number.isFinite(it.price) ? Number((it.price * it.quantity).toFixed(2)) : null,
    };
  });

  let totalValue = 0;
  let totalStickerValue = 0;
  let tradableUnique = 0;
  let pricedUnique = 0;
  let unpricedQty = 0;
  for (const it of items) {
    if (!it.tradable) continue;
    tradableUnique += 1;
    if (Number.isFinite(it.price)) {
      pricedUnique += 1;
      totalValue += it.totalPrice;
    } else {
      unpricedQty += it.quantity;
    }
    totalStickerValue += (it.stickerTotal || 0) * it.quantity;
  }
  const totalValueWithStickers = Number((totalValue + totalStickerValue).toFixed(2));
  logger.info(
    `cs2 fetch ${profileId}: priced ${pricedUnique}/${tradableUnique} unique tradables` +
    (unpricedQty > 0 ? ` (${unpricedQty} items missing market price)` : '') +
    ` -> $${totalValue.toFixed(2)} (with stickers $${totalValueWithStickers.toFixed(2)})`
  );

  const pickFields = (i) => ({
    name: i.name,
    price: i.price,
    icon: i.icon,
    quantity: i.quantity || 1,
    stickers: i.stickers || [],
    stickerTotal: i.stickerTotal || 0,
    traits: i.traits || null,
  });

  const top5 = items
    .filter((i) => i.tradable && Number.isFinite(i.price))
    .sort((a, b) => (b.price + (b.stickerTotal || 0)) - (a.price + (a.stickerTotal || 0)))
    .slice(0, 5)
    .map(pickFields);

  const scored = items
    .filter((i) => i.tradable)
    .map((i) => {
      const stickerR = itemRarityScore(i.stickers || []);
      const traitR = traitScore(i.traits);
      const stickerValuePts = Math.min((i.stickerTotal || 0) * 2, 40);
      const stickerBombPts = i.price && i.stickerTotal > i.price ? 15 : 0;
      const expensivePts = Number.isFinite(i.price) ? Math.min(Math.log10(Math.max(i.price, 1)) * 10, 25) : 0;
      const score = stickerR + traitR + stickerValuePts + stickerBombPts + expensivePts;
      return { ...i, notableScore: Number(score.toFixed(1)) };
    })
    .filter((i) => i.notableScore >= 25);

  const seen = new Set();
  const notable = scored
    .sort((a, b) => b.notableScore - a.notableScore || (b.price || 0) - (a.price || 0))
    .filter((i) => {
      const k = `${i.name}|${(i.stickers || []).map((s) => s.icon).join('|')}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 10)
    .map(pickFields);

  const medals = items
    .filter((i) => isMedalOrCoin(i.name))
    .map((i) => ({ title: i.name, icon: i.icon, quantity: i.quantity || 1 }));

  return upsert(profileId, {
    status: 'checked',
    totalValueUsd: Number(totalValue.toFixed(2)),
    totalValueWithStickersUsd: totalValueWithStickers,
    tradableItemsCount: processed.tradable,
    totalItemsCount: processed.total,
    top5TradableItems: top5,
    notableItems: notable,
    medals,
    items,
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
