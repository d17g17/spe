/**
 * Shared utility functions for formatting and displaying data
 */

/**
 * Format a date string into a localized date display
 * @param {string} dateString - ISO date string to format
 * @param {boolean} includeTime - Whether to include time in the output
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (includeTime) {
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    return 'Invalid Date';
  }
};

/**
 * Format playtime minutes into hours with one decimal point
 * @param {number} minutes - Minutes to convert to hours
 * @returns {string} Formatted hour string
 */
export const formatPlaytime = (minutes) => {
  if (!minutes) return 'N/A';
  return `${Math.round((minutes / 60) * 10) / 10}h`;
};

/**
 * Get visibility status text and styling based on communityVisibilityState
 * @param {number} state - Steam community visibility state
 * @returns {Object} Object with text and color class
 */
export const getVisibilityStatus = (state) => {
  switch (state) {
    case 1: return { text: 'Private', color: 'text-red-400' };
    case 2: return { text: 'Friends Only', color: 'text-amber-400' };
    case 3: return { text: 'Public', color: 'text-green-400' };
    default: return { text: 'Unknown', color: 'text-gray-400' };
  }
};

/**
 * Get persona state text based on personastate value
 * Steam-inspired colors: Green for in-game, Blue for online states, Gray for offline
 * @param {number} state - Steam persona state
 * @param {string|number} gameId - Game ID if currently playing (optional)
 * @returns {Object} Object with text and color class
 */
export const getPersonaState = (state, gameId = null) => {
  // If gameId is present and not empty/zero, user is in-game (green)
  if (gameId && gameId !== '0' && gameId !== 0) {
    return { text: 'In-Game', color: 'text-green-400' };
  }
  
  switch (state) {
    case 0: return { text: 'Offline', color: 'text-gray-400' };
    case 1: return { text: 'Online', color: 'text-blue-400' };
    case 2: return { text: 'Busy', color: 'text-blue-400' };
    case 3: return { text: 'Away', color: 'text-blue-400' };
    case 4: return { text: 'Snooze', color: 'text-blue-400' };
    case 5: return { text: 'Looking to Trade', color: 'text-blue-400' };
    case 6: return { text: 'Looking to Play', color: 'text-blue-400' };
    default: return { text: 'Unknown', color: 'text-gray-400' };
  }
};

/**
 * Get border color class based on persona state for avatar styling
 * Steam-inspired colors: Green for in-game, Blue for online states, Gray for offline
 * @param {number} state - Steam persona state
 * @param {string|number} gameId - Game ID if currently playing (optional)
 * @returns {string} Border color class
 */
export const getPersonaStateBorderColor = (state, gameId = null) => {
  // If gameId is present and not empty/zero, user is in-game (green)
  if (gameId && gameId !== '0' && gameId !== 0) {
    return 'border-green-400';
  }
  
  switch (state) {
    case 0: return 'border-gray-500';     // Offline - Gray
    case 1: return 'border-blue-400';     // Online - Blue
    case 2: return 'border-blue-400';     // Busy - Blue
    case 3: return 'border-blue-400';     // Away - Blue
    case 4: return 'border-blue-400';     // Snooze - Blue
    case 5: return 'border-blue-400';     // Looking to Trade - Blue
    case 6: return 'border-blue-400';     // Looking to Play - Blue
    default: return 'border-gray-500';
  }
};

/**
 * Format ban information into a unified display
 * @param {boolean} vacBanned - VAC banned status
 * @param {boolean} gameBanned - Game banned status
 * @param {boolean} tradeBanned - Trade banned status
 * @returns {Object} Object with text and color class
 */
export const formatBanStatus = (vacBanned, gameBanned, tradeBanned) => {
  if (!vacBanned && !gameBanned && !tradeBanned) {
    return { text: 'None', color: 'text-green-600 dark:text-green-400' };
  }

  const bans = [];
  if (vacBanned) bans.push('VAC');
  if (gameBanned) bans.push('Game');
  if (tradeBanned) bans.push('Trade');

  return { text: bans.join(', '), color: 'text-red-600 dark:text-red-400' };
};

/**
 * Generate Steam profile URL from Steam ID
 * @param {string} steamId - Steam ID64
 * @returns {string} Steam profile URL
 */
export const getSteamProfileUrl = (steamId) => {
  return `https://steamcommunity.com/profiles/${steamId}`;
};
