'use strict';

const client = require('./client');

const INV_URL = (steamId) =>
  `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=5000`;

const fetchCs2Inventory = async (steamId) => {
  try {
    const { data, status } = await client.get(INV_URL(steamId), {}, { strategy: 'suborbit' });
    if (!data) return { status: 'error', reason: `empty response (${status})` };
    if (!data.descriptions) {
      return { status: 'empty', items: [] };
    }
    return { status: 'ok', assets: data.assets || [], descriptions: data.descriptions };
  } catch (err) {
    const s = err.response?.status;
    if (s === 403) return { status: 'private', reason: 'profile or inventory private' };
    if (s === 429) return { status: 'error', reason: 'rate limited' };
    return { status: 'error', reason: err.message || 'request failed' };
  }
};

const fetchMarketPrice = async (marketHashName) => {
  const url = 'https://steamcommunity.com/market/priceoverview/';
  try {
    const { data } = await client.get(url, {
      appid: 730,
      currency: 1,
      market_hash_name: marketHashName,
    });
    if (!data || data.success !== true) return null;
    const raw = data.lowest_price || data.median_price || null;
    if (!raw) return null;
    const num = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    return Number.isFinite(num) ? num : null;
  } catch (_) {
    return null;
  }
};

module.exports = { fetchCs2Inventory, fetchMarketPrice };
