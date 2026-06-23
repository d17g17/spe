'use strict';

const repo = require('./repo');
const steamApi = require('../../steam/api');
const community = require('../../steam/community');
const transform = require('../../steam/transform');
const cs2Service = require('../cs2/service');
const { parseSteamInput } = require('../../utils/steamId');
const config = require('../../config');
const logger = require('../../utils/logger');

const cacheFresh = (updatedAt) => {
  if (!updatedAt) return false;
  const age = Date.now() - new Date(updatedAt).getTime();
  return age < config.profileCacheMinutes * 60_000;
};

const resolveIdentifier = async (raw) => {
  const parsed = parseSteamInput(raw);
  if (parsed.kind === 'invalid') return null;
  if (parsed.kind === 'id') return parsed.value;
  const id = await steamApi.resolveVanity(parsed.value);
  return id;
};

const fetchFullFromSteam = async (steamId) => {
  const [summary, bans, recent, badges, badgesPage, friends] = await Promise.all([
    steamApi.getPlayerSummary(steamId).catch(() => null),
    steamApi.getPlayerBans([steamId]).then((b) => b[0] || null).catch(() => null),
    steamApi.getRecentlyPlayed(steamId).catch(() => []),
    steamApi.getBadges(steamId).catch(() => null),
    community.fetchBadgesPage(steamId).catch(() => null),
    steamApi.getFriendList(steamId).catch(() => null),
  ]);

  if (!summary) return null;

  const shape = transform.summaryToDbShape(summary);
  const banShape = transform.bansToDbShape(bans);
  const badgeShape = transform.badgesToShape(badges);
  const scraped = (badgesPage && badgesPage.status === 'ok') ? badgesPage.badges : null;
  const friendsField = Array.isArray(friends) ? { friendsCount: friends.length } : {};
  return {
    ...shape,
    ...banShape,
    ...friendsField,
    playtime2Weeks: transform.recentToPlaytime2Weeks(recent),
    lastBadgeDate: badgeShape.lastBadgeDate,
    steamLevel: badgeShape.steamLevel,
    badges: scraped,
  };
};

const getOrFetchBySteamId = async (steamId, { force = false } = {}) => {
  const existing = await repo.findById(steamId);
  if (existing && !force && cacheFresh(existing.updatedAt)) {
    return { profile: existing.toJSON(), fromCache: true };
  }

  const shape = await fetchFullFromSteam(steamId);
  if (!shape) return { error: 'not-found-on-steam' };

  await repo.upsert(shape);
  const row = await repo.findById(steamId);
  return { profile: row.toJSON(), fromCache: false };
};

const getOrFetch = async (rawIdentifier, { force = false } = {}) => {
  const steamId = await resolveIdentifier(rawIdentifier);
  if (!steamId) return { error: 'invalid-identifier' };
  return getOrFetchBySteamId(steamId, { force });
};

const getOrFetchWithInventory = async (rawIdentifier, { force = false } = {}) => {
  const steamId = await resolveIdentifier(rawIdentifier);
  if (!steamId) return { error: 'invalid-identifier' };

  const [profileOut, inventory] = await Promise.all([
    getOrFetchBySteamId(steamId, { force }),
    cs2Service.fetchAndStore(steamId).catch((err) => {
      logger.warn(`inventory fetch alongside profile failed for ${steamId}: ${err.message}`);
      return { inventoryError: err.message || 'inventory fetch failed' };
    }),
  ]);

  if (profileOut.error) return profileOut;

  const out = { ...profileOut };
  if (inventory && inventory.inventoryError) {
    out.inventoryError = inventory.inventoryError;
  } else if (inventory) {
    out.inventory = inventory;
  }
  return out;
};

const getLocal = async (steamId) => {
  const row = await repo.findById(steamId);
  return row ? row.toJSON() : null;
};

const remove = async (steamId) => {
  return repo.deleteById(steamId);
};

const removeAll = async () => {
  await repo.sequelize.query('DELETE FROM Friendships');
  await repo.sequelize.query('DELETE FROM cs2_inventories');
  return repo.deleteAll();
};

const list = (opts) => repo.list(opts);

const withInventoryErrors = (ids) => repo.findWithInventoryError(ids);

const setIgnored = (steamId, ignored) => repo.setIgnored(steamId, ignored);

module.exports = {
  getOrFetch,
  getOrFetchWithInventory,
  getOrFetchBySteamId,
  getLocal,
  remove,
  removeAll,
  list,
  withInventoryErrors,
  setIgnored,
  fetchFullFromSteam,
};
