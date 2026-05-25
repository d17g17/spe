'use strict';

const repo = require('./repo');
const steamApi = require('../../steam/api');
const transform = require('../../steam/transform');
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
  const [summary, bans, recent, badges] = await Promise.all([
    steamApi.getPlayerSummary(steamId).catch(() => null),
    steamApi.getPlayerBans([steamId]).then((b) => b[0] || null).catch(() => null),
    steamApi.getRecentlyPlayed(steamId).catch(() => []),
    steamApi.getBadges(steamId).catch(() => null),
  ]);

  if (!summary) return null;

  const shape = transform.summaryToDbShape(summary);
  const banShape = transform.bansToDbShape(bans);
  const badgeShape = transform.badgesToShape(badges);
  return {
    ...shape,
    ...banShape,
    playtime2Weeks: transform.recentToPlaytime2Weeks(recent),
    lastBadgeDate: badgeShape.lastBadgeDate,
  };
};

const getOrFetch = async (rawIdentifier, { force = false } = {}) => {
  const steamId = await resolveIdentifier(rawIdentifier);
  if (!steamId) return { error: 'invalid-identifier' };

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

module.exports = { getOrFetch, getLocal, remove, removeAll, list, withInventoryErrors, fetchFullFromSteam };
