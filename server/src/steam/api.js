'use strict';

const client = require('./client');

const BASE = 'https://api.steampowered.com';

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const resolveVanity = async (vanity) => {
  const key = client.requireKey();
  const { data } = await client.get(`${BASE}/ISteamUser/ResolveVanityURL/v1/`, { key, vanityurl: vanity });
  if (data?.response?.success === 1) return data.response.steamid;
  return null;
};

const getPlayerSummaries = async (steamIds) => {
  if (!Array.isArray(steamIds) || steamIds.length === 0) return [];
  const key = client.requireKey();
  const out = [];
  for (const ids of chunk(steamIds, 100)) {
    const { data } = await client.get(`${BASE}/ISteamUser/GetPlayerSummaries/v2/`, {
      key,
      steamids: ids.join(','),
    });
    if (Array.isArray(data?.response?.players)) out.push(...data.response.players);
  }
  return out;
};

const getPlayerSummary = async (steamId) => {
  const list = await getPlayerSummaries([steamId]);
  return list[0] || null;
};

const getFriendList = async (steamId) => {
  const key = client.requireKey();
  try {
    const { data } = await client.get(`${BASE}/ISteamUser/GetFriendList/v1/`, {
      key,
      steamid: steamId,
      relationship: 'friend',
    });
    return Array.isArray(data?.friendslist?.friends) ? data.friendslist.friends : [];
  } catch (err) {
    if (err.response?.status === 401) return [];
    throw err;
  }
};

const getPlayerBans = async (steamIds) => {
  if (!Array.isArray(steamIds) || steamIds.length === 0) return [];
  const key = client.requireKey();
  const out = [];
  for (const ids of chunk(steamIds, 100)) {
    const { data } = await client.get(`${BASE}/ISteamUser/GetPlayerBans/v1/`, {
      key,
      steamids: ids.join(','),
    });
    if (Array.isArray(data?.players)) out.push(...data.players);
  }
  return out;
};

const getRecentlyPlayed = async (steamId) => {
  const key = client.requireKey();
  try {
    const { data } = await client.get(`${BASE}/IPlayerService/GetRecentlyPlayedGames/v1/`, {
      key,
      steamid: steamId,
      count: 5,
    });
    return Array.isArray(data?.response?.games) ? data.response.games : [];
  } catch (err) {
    if (err.response?.status === 401) return [];
    throw err;
  }
};

const getBadges = async (steamId) => {
  const key = client.requireKey();
  try {
    const { data } = await client.get(`${BASE}/IPlayerService/GetBadges/v1/`, {
      key,
      steamid: steamId,
    });
    return data?.response || null;
  } catch (err) {
    if (err.response?.status === 401) return null;
    throw err;
  }
};

module.exports = {
  resolveVanity,
  getPlayerSummary,
  getPlayerSummaries,
  getFriendList,
  getPlayerBans,
  getRecentlyPlayed,
  getBadges,
};
