'use strict';

const { Op } = require('sequelize');
const { sequelize, models } = require('../../db');

const SORTABLE = new Set([
  'updatedAt', 'createdAt', 'name', 'friendsCount', 'playtime2Weeks',
  'lastLogoff', 'lastBadgeDate', 'country', 'personaState',
]);

const findById = (steamId) => models.Profile.findByPk(steamId);

const upsert = async (profileShape) => {
  const [row] = await models.Profile.upsert(profileShape, { returning: true });
  return row;
};

const deleteById = (steamId) => models.Profile.destroy({ where: { steamId } });
const deleteAll = () => models.Profile.destroy({ where: {}, truncate: false });

const buildWhere = (filters = {}, search = '') => {
  const where = {};
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
  return where;
};

const list = async ({
  sortBy = 'updatedAt',
  sortDir = 'DESC',
  limit = 60,
  offset = 0,
  filters = {},
  search = '',
} = {}) => {
  const column = SORTABLE.has(sortBy) ? sortBy : 'updatedAt';
  const dir = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const where = buildWhere(filters, search);

  const { rows, count } = await models.Profile.findAndCountAll({
    where,
    include: [{ model: models.CS2Inventory, as: 'cs2Inventory', required: false }],
    order: [[column, dir]],
    limit: Math.max(1, Math.min(Number(limit) || 60, 300)),
    offset: Math.max(0, Number(offset) || 0),
  });

  return { rows: rows.map((r) => r.toJSON()), total: count };
};

const findWithInventoryError = async (steamIds) => {
  if (!Array.isArray(steamIds) || steamIds.length === 0) return [];
  const rows = await models.Profile.findAll({
    where: { steamId: { [Op.in]: steamIds } },
    include: [{ model: models.CS2Inventory, as: 'cs2Inventory', where: { status: 'error' }, required: true }],
  });
  return rows.map((r) => r.toJSON());
};

module.exports = { findById, upsert, deleteById, deleteAll, list, findWithInventoryError, sequelize };
