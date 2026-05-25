'use strict';

const { Op } = require('sequelize');
const { sequelize, models } = require('../../db');

const listFriends = async (steamId, { limit = 1000, offset = 0 } = {}) => {
  const rows = await models.Friendship.findAll({
    where: { profileSteamId: steamId },
    include: [
      {
        model: models.Profile,
        as: 'friend',
        include: [{ model: models.CS2Inventory, as: 'cs2Inventory', required: false }],
      },
    ],
    limit: Math.max(1, Math.min(Number(limit) || 1000, 5000)),
    offset: Math.max(0, Number(offset) || 0),
  });
  return rows.map((r) => ({
    ...(r.friend ? r.friend.toJSON() : { steamId: r.friendSteamId }),
    friendSince: r.friendSince,
  }));
};

const countFriends = (steamId) =>
  models.Friendship.count({ where: { profileSteamId: steamId } });

const listFriendIds = async (steamId, { sortBy = 'friendSince', sortDir = 'DESC' } = {}) => {
  const dir = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  let order;
  let include;
  if (sortBy === 'name') {
    include = [{ model: models.Profile, as: 'friend', attributes: [], required: false }];
    order = [[sequelize.literal('`friend`.`name`'), dir]];
  } else if (sortBy === 'friendsCount') {
    include = [{ model: models.Profile, as: 'friend', attributes: [], required: false }];
    order = [[sequelize.literal('`friend`.`friendsCount`'), dir]];
  } else if (sortBy === 'inventoryValue') {
    include = [{
      model: models.Profile, as: 'friend', attributes: [], required: false,
      include: [{ model: models.CS2Inventory, as: 'cs2Inventory', attributes: [], required: false }],
    }];
    order = [[sequelize.literal("COALESCE(`friend->cs2Inventory`.`total_value_usd`, 0)"), dir]];
  } else {
    include = undefined;
    order = [['friendSince', dir]];
  }
  const rows = await models.Friendship.findAll({
    where: { profileSteamId: steamId },
    attributes: ['friendSteamId'],
    include,
    order,
    raw: true,
    subQuery: false,
  });
  return rows.map((r) => r.friendSteamId);
};

const replaceFriendships = async (steamId, friendships) => {
  await sequelize.transaction(async (t) => {
    await models.Friendship.destroy({ where: { profileSteamId: steamId }, transaction: t });
    if (friendships.length === 0) return;
    await models.Friendship.bulkCreate(
      friendships.map((f) => ({
        profileSteamId: steamId,
        friendSteamId: f.steamId,
        friendSince: f.friendSince || null,
      })),
      { transaction: t, ignoreDuplicates: true }
    );
  });
};

const bulkInsertPlaceholders = async (steamIds) => {
  if (!Array.isArray(steamIds) || steamIds.length === 0) return;
  const rows = steamIds.map((id) => ({
    steamId: id,
    hasCyrillic: false,
    vacBanned: false,
    gameBanned: false,
    tradeBanned: false,
  }));
  await models.Profile.bulkCreate(rows, { ignoreDuplicates: true });
};

const bulkUpsertProfiles = async (profileShapes) => {
  if (!Array.isArray(profileShapes) || profileShapes.length === 0) return;
  await models.Profile.bulkCreate(profileShapes, {
    updateOnDuplicate: [
      'name', 'realName', 'avatarUrl', 'profileUrl', 'country', 'locStateCode',
      'locCityId', 'hasCyrillic', 'lastPlayedGame', 'communityVisibilityState',
      'profileState', 'personaState', 'lastLogoff', 'vacBanned', 'gameBanned',
      'tradeBanned', 'updatedAt',
    ],
  });
};

const setFriendsCount = async (steamId, count) => {
  await models.Profile.update({ friendsCount: count }, { where: { steamId } });
};

const existingProfileIds = async (steamIds) => {
  if (!Array.isArray(steamIds) || steamIds.length === 0) return new Set();
  const rows = await models.Profile.findAll({
    where: { steamId: { [Op.in]: steamIds } },
    attributes: ['steamId'],
    raw: true,
  });
  return new Set(rows.map((r) => r.steamId));
};

module.exports = {
  listFriends,
  listFriendIds,
  countFriends,
  replaceFriendships,
  bulkInsertPlaceholders,
  bulkUpsertProfiles,
  existingProfileIds,
  setFriendsCount,
};
