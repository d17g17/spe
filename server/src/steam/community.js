'use strict';

const client = require('./client');

const INV_URL = (steamId) =>
  `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=2000`;

const browserHeaders = (steamId) => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: `https://steamcommunity.com/profiles/${steamId}/inventory`,
  'X-Requested-With': 'XMLHttpRequest',
});

const fetchCs2Inventory = async (steamId) => {
  try {
    const { data, status } = await client.get(
      INV_URL(steamId),
      {},
      { strategy: 'suborbit', headers: browserHeaders(steamId) }
    );
    if (!data || typeof data !== 'object') return { status: 'error', reason: `empty response (${status})` };
    if (data.success === false) return { status: 'private', reason: 'inventory private' };
    if (!Array.isArray(data.assets) || data.assets.length === 0) {
      return { status: 'empty' };
    }
    if (!Array.isArray(data.descriptions)) {
      return { status: 'empty' };
    }
    return { status: 'ok', assets: data.assets, descriptions: data.descriptions };
  } catch (err) {
    const s = err.response?.status;
    if (s === 401 || s === 403) return { status: 'private', reason: 'profile or inventory private' };
    if (s === 429) return { status: 'error', reason: 'rate limited' };
    if (s === 400) return { status: 'error', reason: 'bad request (Steam may be throttling)' };
    if (s === 500 || s === 502 || s === 503) return { status: 'error', reason: `Steam server ${s}` };
    return { status: 'error', reason: err.message || 'request failed' };
  }
};

const fetchMarketPrice = async (marketHashName) => {
  const url = 'https://steamcommunity.com/market/priceoverview/';
  try {
    const { data } = await client.get(
      url,
      { appid: 730, currency: 1, market_hash_name: marketHashName },
      { strategy: 'suborbit', timeout: 10000 }
    );
    if (!data || data.success !== true) return null;
    const raw = data.lowest_price || data.median_price || null;
    const priceNum = raw ? parseFloat(String(raw).replace(/[^0-9.]/g, '')) : null;
    const volumeNum = data.volume ? parseInt(String(data.volume).replace(/[^0-9]/g, ''), 10) : 0;
    if (priceNum == null || !Number.isFinite(priceNum)) return null;
    return { price: priceNum, volume: Number.isFinite(volumeNum) ? volumeNum : 0 };
  } catch (_) {
    return null;
  }
};

const decode = (s) => s
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ');

const trimText = (s) => decode(String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());

const ICON_RE = /data-delayed-image="([^"]+)"/;
const ICON_FALLBACK_RE = /<img[^>]+class="badge_icon"[^>]*src="([^"]+)"/;
const TITLE_RE = /<div class="badge_info_title">([^<]+)<\/div>/;
const XP_RE = /(\d+(?:,\d+)*)\s*XP/;
const UNLOCKED_RE = /Unlocked\s+([^<]+?)(?:\s*<|\s*$)/;
const LEVEL_RE = /Level\s+(\d+),\s*(\d+(?:,\d+)*)\s*XP/i;
const BADGE_TITLE_RE = /<div class="badge_title">\s*([\s\S]*?)(?:&nbsp;|<span)/;

const splitBadgeBlocks = (html) => {
  const marker = 'class="badge_row is_link"';
  const parts = [];
  let cursor = 0;
  while (true) {
    const start = html.indexOf(marker, cursor);
    if (start === -1) break;
    const next = html.indexOf(marker, start + marker.length);
    const end = next === -1 ? html.indexOf('class="profile_badges_footer"', start) : next;
    parts.push(html.slice(start, end === -1 ? html.length : end));
    cursor = end === -1 ? html.length : end;
    if (next === -1) break;
  }
  return parts;
};

const CS_BADGE_RE = /(service medal|veteran coin|loyalty badge|premier season|operation\s+(bravo|phoenix|breakout|vanguard|bloodhound|wildfire|hydra|shattered web|broken fang|riptide))/i;

const isCsBadge = (title, icon) => {
  if (title && CS_BADGE_RE.test(title)) return true;
  if (icon && /\/(730|2073850|2326450|2520490)\//.test(icon)) return true;
  return false;
};

const fetchBadgesPage = async (steamId) => {
  const url = `https://steamcommunity.com/profiles/${steamId}/badges/`;
  try {
    const { data: html } = await client.get(
      url,
      { l: 'english' },
      { strategy: 'suborbit', timeout: 15000, headers: { Accept: 'text/html' } }
    );
    if (typeof html !== 'string') return { status: 'error', reason: 'unexpected response' };
    if (html.includes('profile_private_info')) return { status: 'private', badges: [] };

    const badges = [];
    for (const block of splitBadgeBlocks(html)) {
      const icon = (block.match(ICON_RE) || block.match(ICON_FALLBACK_RE) || [])[1] || null;
      let title = trimText((block.match(TITLE_RE) || [])[1] || '');
      if (!title) title = trimText((block.match(BADGE_TITLE_RE) || [])[1] || '');
      if (!isCsBadge(title, icon)) continue;
      const xpMatch = block.match(XP_RE);
      const xp = xpMatch ? Number(xpMatch[1].replace(/,/g, '')) : null;
      const lvlMatch = block.match(LEVEL_RE);
      const level = lvlMatch ? Number(lvlMatch[1]) : null;
      const unlockedMatch = block.match(UNLOCKED_RE);
      const unlocked = unlockedMatch ? trimText(unlockedMatch[1]) : null;
      if (!title && !icon) continue;
      badges.push({ title: title || null, icon, xp, level, unlocked });
    }
    return { status: 'ok', badges };
  } catch (err) {
    const s = err.response?.status;
    if (s === 401 || s === 403) return { status: 'private', badges: [] };
    return { status: 'error', reason: err.message || 'request failed', badges: [] };
  }
};

module.exports = { fetchCs2Inventory, fetchMarketPrice, fetchBadgesPage };
