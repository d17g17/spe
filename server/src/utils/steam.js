/**
 * steam.js
 * Shared Steam-utility helpers used across the server-side codebase.
 */

/**
 * Check whether a string is a valid SteamID64.
 * According to Valve docs it is a 17-digit numeric string that always starts with 7656.
 * @param {string} steamId
 * @returns {boolean}
 */
function isValidSteamId64(steamId) {
  return typeof steamId === 'string' && /^7656\d{13}$/.test(steamId);
}

/**
 * Convert an object’s camelCase keys to snake_case – shallow conversion.
 * Useful if legacy API clients still expect snake_cased JSON.
 * @param {Object} obj – The source object
 * @returns {Object}
 */
function toSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const snake = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snake] = value;
  }
  return result;
}

module.exports = {
  isValidSteamId64,
  toSnake,
};
