/**
 * Profile Repository
 * Handles all database operations for profiles
 */
const { Profile, Sequelize } = require('../models');
const { Op } = Sequelize;
const logger = require('../utils/logger');
const { CS2Inventory } = require('../models');

/**
 * Find a profile by its Steam ID
 * @param {string} steamId - The Steam ID to find
 * @returns {Promise<Object|null>} - The profile or null if not found
 */
const findBySteamId = async (steamId) => {
  logger.db('ProfileRepo', `Finding profile by ID: ${steamId}`);
  
  try {
    // Include CS2Inventory for consistent badge display
    const { CS2Inventory } = require('../models');
    
    const profile = await Profile.findByPk(steamId, {
      include: [{
        model: CS2Inventory,
        as: 'cs2Inventory',
        required: false, // Use LEFT JOIN to include profiles without inventory
        attributes: ['status', 'totalValueUsd', 'skipReason', 'lastChecked', 'has2025ServiceMedal'] // Only include needed fields
      }]
    });
    
    return profile;
  } catch (error) {
    logger.error('ProfileRepo', `Error including CS2Inventory in findBySteamId: ${error.message}`);
    // Fall back to basic query if there's an error
    return await Profile.findByPk(steamId);
  }
};

/**
 * Create a new profile or update if it exists
 * @param {Object} profileData - The profile data to save
 * @returns {Promise<Object>} - The created/updated profile
 */
const createOrUpdate = async (profileData) => {
  const operationType = profileData.steamId ? 'update' : 'create';
  logger.db('ProfileRepo', `${operationType} profile ${profileData.steamId || '(new)'}`);
  
  const [profile, created] = await Profile.upsert(profileData, {
    returning: true
  });
  
  logger.debug('ProfileRepo', `Profile ${created ? 'created' : 'updated'}: ${profile.steamId}`);
  return { profile, created };
};

/**
 * Get all profiles with optional sorting, filtering, and searching
 * @param {Object} options - Query options
 * @param {string} options.sortBy - Field to sort by
 * @param {string} options.sortOrder - Sort direction ('ASC' or 'DESC')
 * @param {number} options.limit - Maximum number of profiles to return
 * @param {number} options.offset - Pagination offset
 * @param {Object} options.filters - Filter criteria to apply
 * @param {string} options.searchQuery - Text search query
 * @returns {Promise<Object>} - Profiles and total count
 */
const findAll = async (options = {}) => {
  const { 
    sortBy = 'updatedAt', 
    sortOrder = 'DESC',
    limit = 100,
    offset = 0,
    filters = {},
    searchQuery = ''
  } = options;
  
  logger.db('ProfileRepo', `Finding profiles with filters`, { 
    limit, 
    offset, 
    sortBy, 
    sortOrder,
    filterCount: Object.keys(filters).length,
    hasSearch: !!searchQuery
  });
  
  // Always include CS2Inventory model for consistent badge display
  let includeModels = [];
  let orderStatement = [];
  let specialSort = false;
  
  try {
    // Get the CS2Inventory model
    const { CS2Inventory } = require('../models');
    
    // Always include CS2Inventory for badge display
    includeModels.push({
      model: CS2Inventory,
      as: 'cs2Inventory',
      required: false, // Use LEFT JOIN to include profiles without inventory
      attributes: ['status', 'totalValueUsd', 'skipReason', 'lastChecked', 'has2025ServiceMedal'] // Only include needed fields
    });
    
    // Special sorting for inventory value
    if (sortBy === 'inventoryValue') {
      specialSort = true;
      // Set order to use the joined model's field
      orderStatement = [[{ model: CS2Inventory, as: 'cs2Inventory' }, 'total_value_usd', sortOrder]];
      logger.debug('ProfileRepo', `Using special sort for inventory value`);
    }
  } catch (error) {
    logger.error('ProfileRepo', `Error setting up CS2Inventory include: ${error.message}`);
    // Fall back to default includes/sorting if there's an error
    includeModels = [];
    specialSort = false;
  }
  
  // If not using special sort, use standard field sorting
  if (!specialSort) {
    // Whitelist sortable fields for security
    const validSortFields = [
      // Basic fields
      'steamId', 'name', 'realName', 'createdAt', 'updatedAt', 
      'lastLogoff', 'communityVisibilityState', 'profileState', 'personaState',
      
      // Numeric fields
      'friendsCount', 'playtime2Weeks',
      
      // Location fields
      'country', 'locStateCode', 'locCityId',
      
      // Activity fields
      'lastBadgeDate', 'lastPlayedGame',
      
      // Ban fields
      'vacBanned', 'gameBanned', 'tradeBanned',
      
      // Other attributes
      'hasCyrillic'
    ];
    
    // Log when a sort field is not in the whitelist
    if (!validSortFields.includes(sortBy)) {
      logger.warn('ProfileRepo', `Invalid sort field '${sortBy}', falling back to 'updatedAt'`);
      sortBy = 'updatedAt';
    }
    
    orderStatement = [[sortBy, sortOrder]];
  }
  
  const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  
  // Build where clause for filtering
  const whereClause = {};
  
  // Add search query if provided
  if (searchQuery) {
    whereClause[Op.or] = [
      { name: { [Op.like]: `%${searchQuery}%` } },
      { steamId: { [Op.like]: `%${searchQuery}%` } },
      { realName: { [Op.like]: `%${searchQuery}%` } },
      { lastPlayedGame: { [Op.like]: `%${searchQuery}%` } }
    ];
  }
  
  // Add filters
  if (filters && Object.keys(filters).length > 0) {
    Object.entries(filters).forEach(([key, value]) => {
      switch (key) {
        // Boolean filters
        case 'hasAvatar':
          if (value) {
            whereClause.avatarUrl = { 
              [Op.and]: [
                { [Op.ne]: null },
                { [Op.notLike]: '%fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb%' } // Default Steam avatar
              ]
            };
          }
          break;
          
        case 'isPrivate':
          if (value) {
            whereClause.communityVisibilityState = 1;
          }
          break;
          
        case 'isOnline':
          if (value) {
            whereClause.personaState = { [Op.gt]: 0 };
          }
          break;
          
        case 'hasCyrillic':
          if (value) {
            whereClause.hasCyrillic = true;
          }
          break;
          
        case 'hasBans':
          if (value) {
            whereClause[Op.or] = [
              { vacBanned: true },
              { gameBanned: true },
              { tradeBanned: true }
            ];
          }
          break;
          
        case 'hasVacBan':
          if (value) {
            whereClause.vacBanned = true;
          }
          break;
          
        case 'hasGameBan':
          if (value) {
            whereClause.gameBanned = true;
          }
          break;
          
        case 'hasTradeBan':
          if (value) {
            whereClause.tradeBanned = true;
          }
          break;
          
        // Text filters
        case 'hasUsername':
          if (value) {
            whereClause.name = { [Op.like]: `%${value}%` };
          }
          break;
          
        case 'hasGame':
          if (value) {
            whereClause.lastPlayedGame = { [Op.like]: `%${value}%` };
          }
          break;
          
        case 'country':
          if (value) {
            whereClause.country = value;
          }
          break;
          
        // Numeric filters
        case 'minFriends':
          if (value) {
            whereClause.friendsCount = { [Op.gte]: parseInt(value, 10) };
          }
          break;
          
        case 'minPlaytime':
          if (value) {
            // Convert hours to minutes for DB comparison
            whereClause.playtime2Weeks = { [Op.gte]: parseInt(value, 10) * 60 };
          }
          break;
          
        default:
          logger.debug('ProfileRepo', `Ignoring unsupported filter: ${key}`);
          break;
      }
    });
  }
  
  logger.debug('ProfileRepo', `Applied where clause:`, whereClause);
  
  // Build query options
  const queryOptions = {
    where: whereClause,
    order: orderStatement,
    limit: parseInt(limit),
    offset: parseInt(offset)
  };
  
  // Add includes if needed
  if (includeModels.length > 0) {
    queryOptions.include = includeModels;
  }
  
  logger.debug('ProfileRepo', `Executing query with options:`, {
    where: Object.keys(whereClause),
    order: JSON.stringify(orderStatement),
    includesCount: includeModels.length
  });
  
  // Execute query with filters
  const { count, rows } = await Profile.findAndCountAll(queryOptions);
  
  logger.debug('ProfileRepo', `Found ${rows.length} profiles out of ${count} total matching filters`);
  
  return { 
    profiles: rows,
    pagination: {
      total: count,
      offset: parseInt(offset),
      limit: parseInt(limit)
    }
  };
};

/**
 * Get count of all profiles
 * @returns {Promise<number>} - Total number of profiles
 */
const countAll = async () => {
  logger.db('ProfileRepo', 'Counting all profiles');
  return await Profile.count();
};

/**
 * Delete a profile by its Steam ID
 * @param {string} steamId - The Steam ID to delete
 * @returns {Promise<number>} - Number of rows deleted
 */
const deleteProfile = async (steamId) => {
  logger.db('ProfileRepo', `Deleting profile: ${steamId}`);
  return await Profile.destroy({ where: { steamId } });
};

/**
 * Delete all profiles
 * @returns {Promise<number>} - Number of rows deleted
 */
const deleteAll = async () => {
  logger.db('ProfileRepo', 'Deleting all profiles');
  // Consider potential performance implications for very large tables
  return await Profile.destroy({ where: {}, truncate: true }); // truncate for efficiency if supported and desired
};

/**
 * Bulk create or update profiles
 * @param {Array<Object>} profileDataList - List of profile data to save
 * @returns {Promise<Array<Object>>} - The created/updated profiles
 */
const bulkCreateOrUpdate = async (profileDataList) => {
  if (!profileDataList || profileDataList.length === 0) {
    return [];
  }
  
  logger.db('ProfileRepo', `Bulk creating/updating ${profileDataList.length} profiles`);
  
  // For better performance with large datasets, use bulkCreate with updateOnDuplicate
  // This is more efficient than individual upserts
  try {
    const results = await Profile.bulkCreate(profileDataList, {
      updateOnDuplicate: [
        'name', 'realName', 'avatarUrl', 'profileUrl', 'country', 'locStateCode', 
        'locCityId', 'hasCyrillic', 'lastPlayedGame', 'communityVisibilityState', 
        'profileState', 'personaState', 'lastLogoff', 'friendsCount', 'playtime2Weeks', 
        'lastBadgeDate', 'vacBanned', 'gameBanned', 'tradeBanned', 'updatedAt'
      ],
      returning: true
    });
    
    logger.debug('ProfileRepo', `Successfully bulk created/updated ${results.length} profiles`);
    return results;
  } catch (error) {
    logger.error('ProfileRepo', `Bulk operation failed, falling back to individual upserts: ${error.message}`);
    
    // Fallback to individual upserts if bulk operation fails
    const results = await Promise.all(profileDataList.map(profileData => 
      Profile.upsert(profileData, { returning: true })
    ));
    return results.map(result => result[0]);
  }
};

/**
 * Update friend count for a specific profile without overwriting other data
 * @param {string} steamId - The Steam ID to update
 * @param {number} friendCount - The new friend count
 * @returns {Promise<number>} - Number of rows updated
 */
const updateFriendCount = async (steamId, friendCount) => {
  logger.db('ProfileRepo', `Updating friend count for ${steamId} to ${friendCount}`);
  const [updatedRows] = await Profile.update(
    { friendsCount: friendCount },
    { where: { steamId } }
  );
  return updatedRows;
};

/**
 * Find Steam IDs of profiles with CS2Inventory status as 'error'.
 * @returns {Promise<Array<string>>} - A list of Steam IDs.
 */
const findSteamIdsWithInventoryError = async () => {
  logger.db('ProfileRepo', 'Finding Steam IDs with CS2Inventory status error');
  try {
    const profiles = await Profile.findAll({
      attributes: ['steamId'],
      include: [{
        model: CS2Inventory,
        as: 'cs2Inventory',
        attributes: [], // We don't need any attributes from CS2Inventory itself in the final result
        where: {
          status: 'error'
        },
        required: true // Ensures an INNER JOIN
      }],
      raw: true // Returns plain objects, easier to map
    });
    return profiles.map(p => p.steamId);
  } catch (error) {
    logger.error('ProfileRepo', `Error finding Steam IDs with inventory error: ${error.message}`, error);
    throw error; // Re-throw the error to be handled by the caller
  }
};

/**
 * Find Steam IDs from a given list that have CS2Inventory status as 'error'.
 * @param {Array<string>} steamIds - A list of Steam IDs to check.
 * @returns {Promise<Array<string>>} - A list of Steam IDs from the input list that have inventory errors.
 */
const findSteamIdsWithInventoryErrorInList = async (steamIds) => {
  if (!steamIds || steamIds.length === 0) {
    return [];
  }
  logger.db('ProfileRepo', `Finding Steam IDs with CS2Inventory status error within a list of ${steamIds.length} IDs`);
  try {
    const profiles = await Profile.findAll({
      attributes: ['steamId'],
      where: {
        steamId: { [Op.in]: steamIds } // Filter by the provided list of SteamIDs
      },
      include: [{
        model: CS2Inventory,
        as: 'cs2Inventory',
        attributes: [], 
        where: {
          status: 'error'
        },
        required: true // Ensures an INNER JOIN - only profiles with an erroring inventory entry
      }],
      raw: true 
    });
    return profiles.map(p => p.steamId);
  } catch (error) {
    logger.error('ProfileRepo', `Error finding Steam IDs with inventory error in list: ${error.message}`, error);
    throw error;
  }
};

module.exports = {
  findBySteamId,
  createOrUpdate,
  findAll,
  countAll,
  deleteProfile,
  deleteAll,
  bulkCreateOrUpdate,
  updateFriendCount,
  findSteamIdsWithInventoryError,
  findSteamIdsWithInventoryErrorInList
};
