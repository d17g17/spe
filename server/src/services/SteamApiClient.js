/**
 * SteamApiClient
 * Handles direct API calls to Steam API endpoints
 */
const profileProxyManager = require('./profileProxyManager');
const { URL } = require('url');
const logger = require('../utils/logger');
const requestLimiter = require('../utils/requestLimiter'); // Import requestLimiter

// Base Steam API URLs
const STEAM_API_BASE = 'https://api.steampowered.com';
const STEAM_USER_API = `${STEAM_API_BASE}/ISteamUser`;

// Steam API Key will be read from environment variables
const API_KEY = process.env.STEAM_API_KEY || '';

// Enhanced caching for better performance
const friendCache = new Map();
const playerSummaryCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache TTL for better performance

// Request deduplication to prevent concurrent requests for same data
const activeRequests = new Map();

/**
 * Deduplicate concurrent requests for the same key
 */
async function deduplicatedRequest(key, requestFn) {
  if (activeRequests.has(key)) {
    return activeRequests.get(key);
  }
  
  const promise = requestFn();
  activeRequests.set(key, promise);
  
  try {
    const result = await promise;
    return result;
  } finally {
    activeRequests.delete(key);
  }
}

// Cache cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  
  // Clean friend cache
  for (const [key, value] of friendCache.entries()) {
    if (value.timestamp && now - value.timestamp > CACHE_TTL) {
      friendCache.delete(key);
    }
  }
  
  // Clean player summary cache
  for (const [key, value] of playerSummaryCache.entries()) {
    if (value.timestamp && now - value.timestamp > CACHE_TTL) {
      playerSummaryCache.delete(key);
    }
  }
}, 60000); // Clean every minute

class SteamApiClient {
  constructor() {
    if (!API_KEY) {
      logger.warn('STEAM', 'API key missing - add STEAM_API_KEY to environment');
    } else {
      logger.success('STEAM', 'API client initialized successfully');
    }
  }

  /**
   * Make a request to Steam API using the intelligent proxy manager
   */
  async makeRequest(endpoint, params = {}, headers = {}) {
    const url = new URL(endpoint);
    
    // Add API key and other params to URL
    Object.entries({ ...params, key: API_KEY }).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const fullUrl = url.toString();
    logger.debug('STEAM', `API request: ${endpoint.split('/').pop()}`);


    return logger.timed(
      'steam-api-request',
      async () => {
        try {
          const response = await requestLimiter(() => profileProxyManager.makeRequest(fullUrl, {
            method: 'GET',
            headers: { ...headers, 'Accept': 'application/json' },
            maxRetries: 1, // reduced retries for faster processing
            timeout: 6000 // optimized timeout for better balance between speed and reliability
          }));
          return response;
        } catch (error) {
          // surface up – logger.timed will log on error path too
          throw error;
        }
      },
      {
        context: logger.steamApi,
        operation: 'HTTP Request',
        metadata: { endpoint: endpoint.split('/').pop() }
      }
    );
  }

  /**
   * Check if a string is a valid SteamID64
   */
  isValidSteamId64(steamId) {
    // SteamID64 is a 17-digit number starting with '7656'
    return /^7656\d{13}$/.test(steamId);
  }

  /**
   * Resolve vanity URL to SteamID64
   */
  async resolveVanityUrl(vanityName) {
    logger.debug('STEAM', `Resolving vanity URL: ${vanityName}`);
    
    const response = await this.makeRequest(`${STEAM_USER_API}/ResolveVanityURL/v1/`, {
      vanityurl: vanityName
    });

    const data = response.data;
    if (data.response && data.response.success === 1 && data.response.steamid) {
      logger.success('STEAM', `Resolved ${vanityName} → ${data.response.steamid}`);
      return data.response.steamid;
    } else {
      throw new Error(`Could not resolve vanity URL "${vanityName}"`);
    }
  }

  /**
   * Get player summaries for a single Steam ID
   */
  async getPlayerSummary(steamId) {
    // Check cache first
    const cached = playerSummaryCache.get(steamId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('STEAM', `Using cached profile: ${cached.data.personaname || 'Unknown'} (${steamId})`);
      return cached.data;
    }

    const response = await this.makeRequest(`${STEAM_USER_API}/GetPlayerSummaries/v2/`, {
      steamids: steamId
    });

    const data = response.data;
    if (data.response && data.response.players && data.response.players.length > 0) {
      const player = data.response.players[0];
      
      // Cache the result
      playerSummaryCache.set(steamId, {
        data: player,
        timestamp: Date.now()
      });
      
      logger.debug('STEAM', `Profile found: ${player.personaname || 'Unknown'} (${steamId})`);
      return player;
    } else {
      throw new Error(`No player found with SteamID: ${steamId}`);
    }
  }

  /**
   * Get player summaries for multiple Steam IDs in batches
   */
  async getPlayerSummariesBatch(steamIds) {
    // Ensure we have valid input
    if (!steamIds || !Array.isArray(steamIds) || steamIds.length === 0) {
      return {};
    }
    
    const chunkCount = Math.ceil(steamIds.length / 100);
    logger.debug('STEAM', `Batch fetching ${steamIds.length} profiles in ${chunkCount} chunks`);
    
    const results = await logger.timed(
      'batch-player-summaries',
      async () => {
        const chunks = [];
        for (let i = 0; i < steamIds.length; i += 100) {
          chunks.push(steamIds.slice(i, i + 100));
        }

        const summaries = {};
        // Process chunks in parallel for faster execution
        const chunkPromises = chunks.map(async (chunk) => {
          const idsParam = chunk.join(',');
          const resp = await this.makeRequest(`${STEAM_USER_API}/GetPlayerSummaries/v2/`, { steamids: idsParam });
          return resp.data.response.players || [];
        });
        
        const allPlayers = await Promise.all(chunkPromises);
        allPlayers.flat().forEach(p => { summaries[p.steamid] = p; });
        return summaries;
      },
      {
        context: logger.steamApi,
        operation: 'Batch Get Player Summaries',
        metadata: { count: steamIds.length }
      }
    );

    return results;
  }

  /**
   * Get friend list using lightweight Web API (returns only IDs)
   * @param {string} steamId - Steam ID64 of the profile
   * @returns {Promise<Array>} - Array of friend objects { steamid, relationship, friend_since }
   */
  async getFriendList(steamId) {
    return deduplicatedRequest(`friends:${steamId}`, async () => {
      const cached = friendCache.get(steamId);
      const headers = cached?.etag ? { 'If-None-Match': cached.etag } : {};

      const response = await this.makeRequest(`${STEAM_USER_API}/GetFriendList/v1/`, {
        steamid: steamId,
        relationship: 'friend'
      }, headers);

      if (!response || !response.data) return [];

      if (response.status === 304 && cached) {
        return cached.friends;
      }

      const friends = response.data.friendslist?.friends || [];
      const newEtag = response.headers?.etag;
      if (newEtag) {
        friendCache.set(steamId, { 
          etag: newEtag, 
          friends, 
          timestamp: Date.now() 
        });
      }
      return friends;
    });
  }



  /**
   * Get player's owned games
   */
  async getOwnedGames(steamId) {
    logger.info('STEAM', `FETCH_GAMES for SteamID: ${steamId}`);
    
    try {
      const response = await this.makeRequest(`${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/`, {
        steamid: steamId,
        include_appinfo: true,
        include_played_free_games: true
      });

      const data = response.data;
      if (data.response && data.response.games) {
        logger.success('STEAM', `GAMES_FOUND for SteamID: ${steamId}, Count: ${data.response.games.length}`);
        return data.response.games;
      } else {
        logger.info('STEAM', `NO_GAMES for SteamID: ${steamId}`);
        return [];
      }
    } catch (error) {
      // Games list might be private
      if (error.response && error.response.status === 401) {
        logger.warn('STEAM', `PRIVATE_GAMES for SteamID: ${steamId}`);
        return [];
      }
      logger.error('STEAM', `GAMES_ERROR for SteamID: ${steamId}, Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get player's recently played games
   */
  async getRecentlyPlayedGames(steamId) {
    logger.info('STEAM', `FETCH_RECENT for SteamID: ${steamId}`);
    
    try {
      const response = await this.makeRequest(`${STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/`, {
        steamid: steamId,
        count: 10
      });

      const data = response.data;
      if (data.response) {
        logger.info('Steam', `Got ${data.response.games?.length || 0} recently played games for: ${steamId}`);
        return data;
      } else {
        logger.info('Steam', `No recently played games found for: ${steamId}`);
        return { response: { games: [] } };
      }
    } catch (error) {
      logger.error('Steam', `Error getting recently played games for ${steamId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get player ban information
   */
  async getPlayerBans(steamId) {
    logger.info('Steam', `Fetching ban information for: ${steamId}`);
    try {
      const response = await this.makeRequest(`${STEAM_USER_API}/GetPlayerBans/v1/`, {
        steamids: steamId
      });

      const data = response.data;
      if (data.players && data.players.length > 0) {
        logger.info('Steam', `Got ban information for: ${steamId}`);
        return data.players[0];
      } else {
        logger.warn('Steam', `No ban information found in response for: ${steamId}`);
        return {
          SteamId: steamId,
          VACBanned: false,
          NumberOfVACBans: 0,
          NumberOfGameBans: 0,
          EconomyBan: 'none'
        };
      }
    } catch (error) {
      logger.error('Steam', `Failed to get ban info: ${steamId}: ${error.message}`);
      return {
        SteamId: steamId,
        VACBanned: false,
        NumberOfVACBans: 0,
        NumberOfGameBans: 0,
        EconomyBan: 'none'
      };
    }
  }

  /**
   * Get player ban information for multiple users
   */
  async getPlayerBansBatch(steamIds) {
    // Ensure we have valid input
    if (!steamIds || !Array.isArray(steamIds) || steamIds.length === 0) {
      return {};
    }
    
    const chunkCount = Math.ceil(steamIds.length / 100);
    logger.info('Steam', `Batch fetching ban information for ${steamIds.length} profiles in ${chunkCount} chunks`);
    
    const results = await logger.timed(
      'batch-player-bans',
      async () => {
        const chunks = [];
        for (let i = 0; i < steamIds.length; i += 100) {
          chunks.push(steamIds.slice(i, i + 100));
        }

        const bans = {};
        // Process chunks in parallel for faster execution
        const chunkPromises = chunks.map(async (chunk) => {
          const idsParam = chunk.join(',');
          const resp = await this.makeRequest(`${STEAM_USER_API}/GetPlayerBans/v1/`, { steamids: idsParam });
          return resp.data.players || [];
        });
        
        const allPlayers = await Promise.all(chunkPromises);
        allPlayers.flat().forEach(p => { bans[p.SteamId] = p; });
        return bans;
      },
      {
        context: logger.steamApi,
        operation: 'Batch Get Player Bans',
        metadata: { count: steamIds.length }
      }
    );

    return results;
  }

  /**
   * Get player's badges
   */
  async getPlayerBadges(steamId) {
    logger.info('Steam', `Fetching badges for: ${steamId}`);
    try {
      const response = await this.makeRequest(`${STEAM_API_BASE}/IPlayerService/GetBadges/v1/`, {
        steamid: steamId
      });

      const data = response.data;
      if (data.response && data.response.badges) {
        logger.info('Steam', `Got ${data.response.badges.length} badges for: ${steamId}`);
        return data.response.badges;
      } else {
        logger.info('Steam', `No badges found for: ${steamId}`);
        return [];
      }
    } catch (error) {
      // Badges might be private
      if (error.response && error.response.status === 401) {
        logger.warn('Steam', `Private badges for: ${steamId}`);
        return [];
      }
      logger.error('Steam', `Failed to get badges for ${steamId}: ${error.message}`);
      return [];
    }
  }


}

module.exports = new SteamApiClient();
