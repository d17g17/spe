/**
 * Friendship Repository
 * Handles all database operations for friendship relationships
 */
const { Friendship, Profile, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Store bidirectional friendships between a profile and multiple friends
 * Creates relationships in both directions (A is friends with B, and B is friends with A)
 * @param {string} profileSteamId - The profile's Steam ID
 * @param {Array<string>} friendSteamIds - An array of friend Steam IDs
 * @returns {Promise<number>} - Number of friendship relationships created
 */
const storeBidirectionalFriendships = async (profileSteamId, friendSteamIds) => {
  if (!profileSteamId || !friendSteamIds || friendSteamIds.length === 0) return 0;
  
  logger.db('FriendshipRepo', `Storing friendships for ${profileSteamId}`, {
    friendCount: friendSteamIds.length
  });
  
  // Create forward relationships (profile -> friends)
  const forwardFriendships = friendSteamIds.map(friendSteamId => ({
    profileSteamId: profileSteamId,
    friendSteamId: friendSteamId,
    friendSince: new Date()
  }));
  
  // Create reverse relationships (friends -> profile)
  const reverseFriendships = friendSteamIds.map(friendSteamId => ({
    profileSteamId: friendSteamId,
    friendSteamId: profileSteamId,
    friendSince: new Date()
  }));
  
  // Combine all relationships
  const friendships = [...forwardFriendships, ...reverseFriendships];
  
  // Use bulkCreate with ignoreDuplicates for SQLite compatibility
  await Friendship.bulkCreate(friendships, {
    ignoreDuplicates: true
  });
  
  logger.debug('FriendshipRepo', `Created ${friendships.length} friendship relations`);
  return friendships.length;
};

/**
 * Get friends of a profile with pagination and sorting
 * @param {string} steamId - The Steam ID to get friends for
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of friends to return
 * @param {number} options.offset - Pagination offset
 * @param {string} options.sortBy - Field to sort by
 * @param {string} options.sortOrder - Sort direction ('ASC' or 'DESC')
 * @returns {Promise<Object>} - Friends and total count
 */
const getFriendsOfProfile = async (steamId, options = {}) => {
  const { 
    limit = 50, 
    offset = 0, 
    sortBy = 'inventoryValue', 
    sortOrder = 'DESC',
    useCachedOnly = false
  } = options;
  
  // Log if we're using cached only mode
  if (useCachedOnly) {
    logger.debug('FriendshipRepo', `Getting cached friends for ${steamId} (cached only mode)`);
  }
  
  // If useCachedOnly is true, first check if we have any friends cached
  if (useCachedOnly) {
    const friendCount = await Friendship.count({
      where: { profileSteamId: steamId }
    });
    
    // If no friends are cached, return empty result
    if (friendCount === 0) {
      logger.debug('FriendshipRepo', `No cached friends found for ${steamId}`);
      return {
        friends: [],
        pagination: {
          total: 0,
          offset: parseInt(offset),
          limit: parseInt(limit)
        }
      };
    }
  }
  
  // Validate sort field to prevent SQL injection
  const validSortFields = ['name', 'lastLogoff', 'createdAt', 'updatedAt', 'inventoryValue'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'inventoryValue';
  const order = sortOrder === 'DESC' ? 'DESC' : 'ASC';

  // Map field to actual SQL expression
  let orderByField;
  if (sortField === 'inventoryValue') {
    orderByField = 'inv.total_value_usd';
  } else {
    orderByField = `p.${sortField}`;
  }
  
  // Get the friends with their profile information
  // Using optimized JOIN with proper indexing hints
  const friends = await sequelize.query(`
    SELECT 
      p.steamId, p.name, p.realName, p.avatarUrl, p.profileUrl, p.country, p.locStateCode, p.locCityId,
      p.lastLogoff, p.communityVisibilityState, p.personaState, p.friendsCount, 
      p.lastPlayedGame, p.playtime2Weeks, p.lastBadgeDate, p.vacBanned, p.gameBanned, p.tradeBanned,
      p.createdAt, p.updatedAt, p.notes,
      inv.total_value_usd AS inventoryValue, 
      inv.status AS inventoryStatus, 
      inv.skip_reason AS inventorySkipReason, 
      inv.last_checked AS inventoryLastChecked, 
      inv.has_2025_service_medal AS inventoryHas2025ServiceMedal,
      inv.has_premier_season_one_medal AS inventoryHasPremierSeasonOneMedal,
      inv.has_premier_season_two_medal AS inventoryHasPremierSeasonTwoMedal
    FROM Friendships f
    INNER JOIN Profiles p ON p.steamId = f.friendSteamId
    LEFT JOIN cs2_inventories inv ON p.steamId = inv.profile_id
    WHERE f.profileSteamId = :steamId
    ORDER BY ${orderByField} ${order}
    LIMIT :limit OFFSET :offset
  `, {
    replacements: { 
      steamId, 
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    },
    type: sequelize.QueryTypes.SELECT,
  });
  
  // Get the total count of friends
  const totalFriends = await Friendship.count({
    where: { profileSteamId: steamId }
  });
  
  return {
    friends,
    pagination: {
      total: totalFriends,
      offset: parseInt(offset),
      limit: parseInt(limit)
    }
  };
};

/**
 * Count the number of friends for a profile
 * @param {string} steamId - The Steam ID to count friends for
 * @returns {Promise<number>} - The number of friends
 */
const countFriends = async (steamId) => {
  return await Friendship.count({
    where: { profileSteamId: steamId }
  });
};

/**
 * Find existing friend relationships for a set of Steam IDs
 * @param {string} profileSteamId - The profile's Steam ID
 * @param {Array<string>} friendSteamIds - Steam IDs to check
 * @returns {Promise<Array<string>>} - Steam IDs of existing friends
 */
const findExistingFriendships = async (profileSteamId, friendSteamIds) => {
  const existingFriendships = await Friendship.findAll({
    where: {
      profileSteamId,
      friendSteamId: {
        [Op.in]: friendSteamIds
      }
    },
    attributes: ['friendSteamId']
  });
  
  return existingFriendships.map(f => f.friendSteamId);
};

module.exports = {
  storeBidirectionalFriendships,
  getFriendsOfProfile,
  countFriends,
  findExistingFriendships
};
