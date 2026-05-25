/**
 * SteamDataTransformer
 * Handles all transformations of Steam API data
 */
const logger = require('../utils/logger');

class SteamDataTransformer {
  /**
   * Extract SteamID64 from different formats (profile URL, vanity URL, etc.)
   * @param {string} identifier - Input identifier (URL, SteamID, etc)
   * @param {Object} steamApiClient - Instance of SteamApiClient
   * @returns {Promise<string>} - Resolved SteamID64
   */
  async resolveSteamId(identifier, steamApiClient) {
    // If it's already a valid SteamID64, return it
    if (steamApiClient.isValidSteamId64(identifier)) {
      return identifier;
    }

    // Check if it's a profile URL containing the steamID64
    const steamIdMatch = identifier.match(/steamcommunity\.com\/profiles\/([0-9]+)/i);
    if (steamIdMatch && steamIdMatch[1] && steamApiClient.isValidSteamId64(steamIdMatch[1])) {
      return steamIdMatch[1];
    }

    // Check if it's a vanity URL
    const vanityMatch = identifier.match(/steamcommunity\.com\/id\/([^\/]+)/i);
    const vanityName = vanityMatch ? vanityMatch[1] : identifier;

    // Resolve vanity URL to SteamID64
    try {
      return await steamApiClient.resolveVanityUrl(vanityName);
    } catch (error) {
      logger.error('Steam', `Failed to resolve vanity URL: ${error.message}`);
      throw new Error(`Failed to resolve identifier: ${identifier}`);
    }
  }

  /**
   * Helper method to extract games array from different response formats
   * @param {Object|Array} gamesData - The response from Steam API
   * @returns {Array} - Extracted games array
   */
  extractGamesArray(gamesData) {
    if (!gamesData) return [];
    
    if (gamesData.response && Array.isArray(gamesData.response.games)) {
      return gamesData.response.games;
    } else if (gamesData.games && Array.isArray(gamesData.games)) {
      return gamesData.games;
    } else if (Array.isArray(gamesData)) {
      return gamesData;
    }
    
    return [];
  }

  /**
   * Process recently played games data to get last played game and total playtime
   * @param {Object} recentGamesData - Data from Steam API
   * @returns {Object} - Processed data with last played game and total playtime
   */
  processRecentGamesData(recentGamesData) {
    const games = this.extractGamesArray(recentGamesData);
    
    if (!games || games.length === 0) {
      return {
        lastPlayedGame: '',
        playtime2Weeks: 0,
        games: []
      };
    }
    
    // Sort games by last played time (most recent first)
    // Steam API provides 'rtime_last_played' field for this
    const sortedByLastPlayed = [...games].sort((a, b) => 
      (parseInt(b.rtime_last_played) || 0) - (parseInt(a.rtime_last_played) || 0)
    );
    
    // Get the most recently played game (not most played by time)
    const lastPlayedGame = sortedByLastPlayed[0] && sortedByLastPlayed[0].name ? sortedByLastPlayed[0].name : '';
    
    // Calculate total playtime in the last 2 weeks
    const playtime2Weeks = games.reduce((sum, game) => {
      return sum + (parseInt(game.playtime_2weeks) || 0);
    }, 0);
    
    // Sort games by playtime for reference
    const sortedByPlaytime = [...games].sort((a, b) => 
      (parseInt(b.playtime_2weeks) || 0) - (parseInt(a.playtime_2weeks) || 0)
    );
    
    return {
      lastPlayedGame,
      playtime2Weeks,
      games: sortedByPlaytime // Keep sorted by playtime for other uses
    };
  }

  /**
   * Process badge data to find the most recent badge
   * @param {Array} badges - Badges from Steam API
   * @returns {Object} - Processed badge data with last badge date and medal flags
   */
  processBadgeData(badges) {
    if (!badges || !Array.isArray(badges) || badges.length === 0) {
      return { 
        lastBadgeDate: null,
        hasSpecialMedals: false,
        has2025ServiceMedal: false
      };
    }
    
    // Find the most recent badge
    const sortedBadges = [...badges].sort((a, b) => 
      (b.completion_time || 0) - (a.completion_time || 0)
    );
    
    const lastBadgeDate = sortedBadges.length > 0 && sortedBadges[0].completion_time ? 
      new Date(sortedBadges[0].completion_time * 1000) : null;
    
    // Check for special medals
    const has2025ServiceMedal = badges.some(badge => 
      badge.badgeid === 47 && badge.level >= 2025
    );
    
    const hasSpecialMedals = has2025ServiceMedal;
    
    return {
      lastBadgeDate,
      recentBadge: sortedBadges[0] || null,
      hasSpecialMedals,
      has2025ServiceMedal
    };
  }

  /**
   * Transform Steam API profile data to our database schema format
   * @param {Object} apiProfile - Profile data from Steam API
   * @returns {Object} - Profile data in our DB schema format
   */
  transformApiProfileToDbModel(apiProfile) {
    if (!apiProfile || (!apiProfile.steamid && !apiProfile.steamId)) {
      throw new Error('Invalid API profile data');
    }
    
    // Handle both raw Steam API format and combined profile data format
    const steamId = apiProfile.steamid || apiProfile.steamId;
    const name = apiProfile.personaname || apiProfile.name || '';
    const realName = apiProfile.realname || apiProfile.real_name || '';
    const avatarUrl = apiProfile.avatarfull || apiProfile.avatar_url || '';
    const profileUrl = apiProfile.profileurl || apiProfile.profile_url || '';
    const country = apiProfile.loccountrycode || apiProfile.country || '';
    const locStateCode = apiProfile.locstatecode || '';
    const locCityId = apiProfile.loccityid || null;
    const hasCyrillic = apiProfile.has_cyrillic || /[а-яА-Я]/.test(name);
    
    // Handle different field name formats for game and badge data
    const lastPlayedGame = apiProfile.gameextrainfo || apiProfile.last_played_game || '';
    const playtime2Weeks = apiProfile.playtime_2weeks || 0;
    
    // Handle lastBadgeDate - could be ISO string or timestamp
    let lastBadgeDate = null;
    if (apiProfile.lastBadgeDate) {
      lastBadgeDate = new Date(apiProfile.lastBadgeDate);
    } else if (apiProfile.last_badge_date) {
      lastBadgeDate = new Date(apiProfile.last_badge_date);
    }
    
    const communityVisibilityState = apiProfile.communityvisibilitystate || 0;
    const profileState = apiProfile.profilestate || 0;
    const personaState = apiProfile.personastate || 0;
    const lastLogoff = apiProfile.lastlogoff ? new Date(apiProfile.lastlogoff * 1000) : null;
    const friendsCount = apiProfile.friends_count || 0;
    
    const vacBanned = apiProfile.vac_banned === true || apiProfile.VACBanned === true;
    const gameBanned = apiProfile.game_banned === true || apiProfile.NumberOfGameBans > 0;
    const tradeBanned = apiProfile.trade_banned === true || (apiProfile.EconomyBan && apiProfile.EconomyBan !== 'none');
    
    return {
      steamId,
      name,
      realName,
      avatarUrl,
      profileUrl,
      country,
      locStateCode,
      locCityId,
      hasCyrillic,
      lastPlayedGame,
      communityVisibilityState,
      profileState,
      personaState,
      lastLogoff,
      friendsCount,
      playtime2Weeks,
      lastBadgeDate,
      vacBanned,
      gameBanned,
      tradeBanned
    };
  }

  /**
   * Combine all profile data from various API endpoints into a single object
   * @param {Object} profile - Basic profile data
   * @param {Array} friends - Friend list
   * @param {Object} recentGamesData - Recent games data
   * @param {Object} banInfo - Ban information
   * @param {Array} badges - Badge information
   * @returns {Object} - Full combined profile data
   */
  combineProfileData(profile, friends = [], recentGamesData = {}, banInfo = {}, badges = []) {
    // Process recent games data
    const { lastPlayedGame, playtime2Weeks, games } = this.processRecentGamesData(recentGamesData);
    
    // Process badge data
    const { lastBadgeDate, hasSpecialMedals, has2025ServiceMedal } = this.processBadgeData(badges);
    
    // Return combined profile data
    return {
      ...profile,
      friends_count: Array.isArray(friends) ? friends.length : 0,
      // Add recent games data
      recent_games: games,
      last_played_game: lastPlayedGame,
      playtime_2weeks: playtime2Weeks,
      // Add ban information
      vac_banned: banInfo.VACBanned === true,
      game_banned: (parseInt(banInfo.NumberOfGameBans) || 0) > 0,
      trade_banned: banInfo.EconomyBan && banInfo.EconomyBan !== 'none',
      // Add badge information
      lastBadgeDate: lastBadgeDate ? lastBadgeDate.toISOString() : null,
      // Add special medal flags
      hasSpecialMedals,
      has2025ServiceMedal,
      // Store recent badges for reference
      recent_badges: badges,
    };
  }

  /**
   * Build a complete profile from all available Steam API data
   * @param {string} steamId - Steam ID to fetch
   * @param {Object} steamApiClient - Instance of SteamApiClient
   * @returns {Promise<Object>} - Complete profile data
   */
  async buildFullProfileData(steamId, steamApiClient) {
    try {
      logger.info('Steam', `Building full profile data for: ${steamId}`);
      
      // Get basic profile data
      const profile = await steamApiClient.getPlayerSummary(steamId);
      
      // Get additional data in parallel
      logger.info('Steam', `Fetching additional data for: ${steamId}`);
      const [friends, recentGames, bans, badges] = await Promise.all([
        steamApiClient.getFriendList(steamId).catch((err) => {
          logger.info('Steam', `Friends list failed for ${steamId}: ${err.message}`);
          return [];
        }),
        steamApiClient.getRecentlyPlayedGames(steamId).catch((err) => {
          logger.info('Steam', `Recent games failed for ${steamId}: ${err.message}`);
          return {};
        }),
        steamApiClient.getPlayerBans(steamId).catch((err) => {
          logger.info('Steam', `Player bans failed for ${steamId}: ${err.message}`);
          return {};
        }),
        steamApiClient.getPlayerBadges(steamId).catch((err) => {
          logger.info('Steam', `Badges failed for ${steamId}: ${err.message}`);
          return [];
        })
      ]);
      
      // Log what we actually received
      logger.info('Steam', `Recent games data for ${steamId}:`, recentGames);
      
      // Combine all data
      logger.info('Steam', `Complete profile assembled for: ${steamId}`);
      return this.combineProfileData(profile, friends, recentGames, bans, badges);
    } catch (error) {
      logger.error('Steam', `Failed to build complete profile: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SteamDataTransformer();
