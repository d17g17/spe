'use strict';

const { Op } = require('sequelize');
const { sequelize, models } = require('../../db');

const SORTABLE = new Set([
  'updatedAt', 'createdAt', 'name', 'friendsCount', 'playtime2Weeks',
  'lastLogoff', 'lastBadgeDate', 'country', 'personaState',
  'inventoryValue', 'oldestBadge', 'veteranMix', 'smart',
]);

const findById = (steamId) => models.Profile.findByPk(steamId);

const upsert = async (profileShape) => {
  const [row] = await models.Profile.upsert(profileShape, { returning: true });
  return row;
};

const deleteById = (steamId) => models.Profile.destroy({ where: { steamId } });
const deleteAll = () => models.Profile.destroy({ where: {}, truncate: false });

const setIgnored = async (steamId, ignored) => {
  const [n] = await models.Profile.update(
    { ignored: Boolean(ignored) },
    { where: { steamId } }
  );
  return n;
};

const setStar = async (steamId, isStarred, starNote) => {
  const [n] = await models.Profile.update(
    { isStarred: Boolean(isStarred), starNote: starNote || null },
    { where: { steamId } }
  );
  return n;
};

const buildWhere = (filters = {}, search = '') => {
  const where = {};
  // Hide ignored profiles by default; opt-in via filters.includeIgnored.
  if (!filters.includeIgnored) where.ignored = false;
  if (search) {
    where[Op.or] = [
      { steamId: { [Op.like]: `%${search}%` } },
      { name: { [Op.like]: `%${search}%` } },
      { realName: { [Op.like]: `%${search}%` } },
    ];
  }
  if (filters.country) where.country = filters.country;
  if (filters.vacBanned != null) where.vacBanned = Boolean(filters.vacBanned);
  if (filters.gameBanned != null) where.gameBanned = Boolean(filters.gameBanned);
  if (filters.tradeBanned != null) where.tradeBanned = Boolean(filters.tradeBanned);
  if (filters.hasCyrillic != null) where.hasCyrillic = Boolean(filters.hasCyrillic);
  if (filters.personaState != null) where.personaState = Number(filters.personaState);
  if (filters.visibilityState != null) where.communityVisibilityState = Number(filters.visibilityState);
  if (filters.minFriends != null) where.friendsCount = { ...(where.friendsCount || {}), [Op.gte]: Number(filters.minFriends) };
  if (filters.maxFriends != null) where.friendsCount = { ...(where.friendsCount || {}), [Op.lte]: Number(filters.maxFriends) };
  if (filters.isStarred) where.isStarred = true;
  return where;
};

const buildOrder = (sortBy, sortDir) => {
  const key = SORTABLE.has(sortBy) ? sortBy : 'updatedAt';
  const dir = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  if (key === 'inventoryValue') {
    return [
      [sequelize.literal('COALESCE(`cs2Inventory`.`total_value_usd`, 0)'), dir],
    ];
  }
  if (key === 'oldestBadge') {
    return [
      [sequelize.literal('CASE WHEN `Profile`.`lastBadgeDate` IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['lastBadgeDate', 'ASC'],
    ];
  }
  if (key === 'veteranMix' || key === 'smart') {
    return [
      [sequelize.literal(
        "(COALESCE(`cs2Inventory`.`total_value_usd`, 0) * COALESCE(julianday('now') - julianday(`Profile`.`lastBadgeDate`), 0))"
      ), 'DESC'],
    ];
  }
  return [[key, dir]];
};

const list = async ({
  sortBy = 'updatedAt',
  sortDir = 'DESC',
  limit = 60,
  offset = 0,
  filters = {},
  search = '',
} = {}) => {
  const where = buildWhere(filters, search);

  const { rows, count } = await models.Profile.findAndCountAll({
    where,
    include: [{ model: models.CS2Inventory, as: 'cs2Inventory', required: false }],
    order: buildOrder(sortBy, sortDir),
    limit: Math.max(1, Math.min(Number(limit) || 60, 300)),
    offset: Math.max(0, Number(offset) || 0),
    subQuery: false,
  });

  return { rows: rows.map((r) => r.toJSON()), total: count };
};

const listIds = async ({ sortBy, sortDir, filters = {}, search = '', steamIds } = {}) => {
  const where = buildWhere(filters, search);
  if (Array.isArray(steamIds)) {
    if (steamIds.length === 0) return [];
    where.steamId = { ...(where.steamId || {}), [Op.in]: steamIds };
  }
  const rows = await models.Profile.findAll({
    where,
    include: [{ model: models.CS2Inventory, as: 'cs2Inventory', required: false, attributes: [] }],
    attributes: ['steamId'],
    order: buildOrder(sortBy, sortDir),
    subQuery: false,
    raw: true,
  });
  return rows.map((r) => r.steamId);
};

const findWithInventoryError = async (steamIds) => {
  if (!Array.isArray(steamIds) || steamIds.length === 0) return [];
  const rows = await models.Profile.findAll({
    where: { steamId: { [Op.in]: steamIds } },
    include: [{ model: models.CS2Inventory, as: 'cs2Inventory', where: { status: 'error' }, required: true }],
  });
  return rows.map((r) => r.toJSON());
};

const bulkUpsertProfiles = async (shapes) => {
  if (!shapes || shapes.length === 0) return [];
  const fields = Object.keys(shapes[0]).filter(k => k !== 'steamId' && k !== 'createdAt');
  await models.Profile.bulkCreate(shapes, { updateOnDuplicate: fields });
  return shapes;
};

module.exports = { findById, upsert, bulkUpsertProfiles, deleteById, deleteAll, list, listIds, findWithInventoryError, setIgnored, setStar, sequelize };
