'use strict';

const { Op } = require('sequelize');
const { models } = require('../../db');
const { computeRareTags } = require('./rareDetect');
const logger = require('../../utils/logger');

const MEDAL_RE = /(service medal|premier season|veteran coin|loyalty badge|commemorative|global offensive badge|\d+\s*year veteran|operation.*coin|\bcoin\b)/i;
const MEDAL_SKIP_RE = /(sticker|case|capsule|graffiti|music kit|patch pack|agent|pin)/i;

const isMedalOrCoin = (name) => {
  if (!name) return false;
  if (MEDAL_SKIP_RE.test(name)) return false;
  return MEDAL_RE.test(name);
};

const backfillMedalsFromItems = async () => {
  const rows = await models.CS2Inventory.findAll({
    where: { status: 'checked', medals: { [Op.is]: null } },
    attributes: ['profileId', 'items'],
  });
  let updated = 0;
  let skipped = 0;
  for (const r of rows) {
    let items = r.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (_) { items = null; }
    }
    if (!Array.isArray(items) || items.length === 0) {
      skipped += 1;
      continue;
    }
    const medals = items
      .filter((i) => isMedalOrCoin(i.name))
      .map((i) => ({ title: i.name, icon: i.icon, quantity: i.quantity || 1 }));
    await models.CS2Inventory.update(
      { medals },
      { where: { profileId: r.profileId } }
    );
    updated += 1;
  }
  logger.info(`medal backfill: updated ${updated}, skipped ${skipped}`);
  return { updated, skipped, total: rows.length };
};

const backfillRareTagsFromItems = async () => {
  // Recompute for every checked inventory: rules change over time and the
  // function is cheap (no network, just regex over stored items).
  const rows = await models.CS2Inventory.findAll({
    where: { status: 'checked' },
    attributes: ['profileId', 'items'],
  });
  let updated = 0;
  let skipped = 0;
  for (const r of rows) {
    let items = r.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (_) { items = null; }
    }
    if (!Array.isArray(items) || items.length === 0) {
      skipped += 1;
      continue;
    }
    const rareTags = computeRareTags(items);
    await models.CS2Inventory.update(
      { rareTags },
      { where: { profileId: r.profileId } }
    );
    updated += 1;
  }
  logger.info(`rare-tags backfill: updated ${updated}, skipped ${skipped}`);
  return { updated, skipped, total: rows.length };
};

module.exports = { backfillMedalsFromItems, backfillRareTagsFromItems };
