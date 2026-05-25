'use strict';

const CYRILLIC_RE = /[\u0400-\u04FF]/;

const toDateOrNull = (v) => {
  if (!v) return null;
  if (typeof v === 'number') return new Date(v * 1000);
  if (v instanceof Date) return v;
  return null;
};

const summaryToDbShape = (s) => {
  if (!s) return null;
  const name = s.personaname || null;
  const hasCyrillic = name ? CYRILLIC_RE.test(name) : false;
  return {
    steamId: s.steamid,
    name,
    realName: s.realname || null,
    avatarUrl: s.avatarfull || s.avatar || null,
    profileUrl: s.profileurl || null,
    country: s.loccountrycode || null,
    locStateCode: s.locstatecode || null,
    locCityId: s.loccityid != null ? Number(s.loccityid) : null,
    hasCyrillic,
    lastPlayedGame: s.gameextrainfo || null,
    communityVisibilityState: s.communityvisibilitystate ?? null,
    profileState: s.profilestate ?? null,
    personaState: s.personastate ?? null,
    lastLogoff: toDateOrNull(s.lastlogoff),
    timeCreated: toDateOrNull(s.timecreated),
  };
};

const bansToDbShape = (b) => {
  if (!b) return { vacBanned: false, gameBanned: false, tradeBanned: false };
  return {
    vacBanned: Boolean(b.VACBanned),
    gameBanned: (b.NumberOfGameBans || 0) > 0,
    tradeBanned: b.EconomyBan && b.EconomyBan !== 'none',
  };
};

const recentToPlaytime2Weeks = (games) => {
  if (!Array.isArray(games)) return 0;
  return games.reduce((acc, g) => acc + (g.playtime_2weeks || 0), 0);
};

const badgesToShape = (badgeData) => {
  if (!badgeData || !Array.isArray(badgeData.badges)) {
    return {
      lastBadgeDate: null,
      steamLevel: badgeData?.player_level ?? null,
      has2025ServiceMedal: false,
      hasPremierSeasonOneMedal: false,
      hasPremierSeasonTwoMedal: false,
    };
  }
  let latest = 0;
  let has2025 = false;
  let s1 = false;
  let s2 = false;
  for (const b of badgeData.badges) {
    if (b.completion_time && b.completion_time > latest) latest = b.completion_time;
    const aid = b.appid;
    const bid = b.badgeid;
    if (aid === 2073850) has2025 = true;
    if (aid === 2326450 || bid === 50) s1 = true;
    if (aid === 2520490 || bid === 51) s2 = true;
  }
  return {
    lastBadgeDate: latest ? new Date(latest * 1000) : null,
    steamLevel: badgeData.player_level ?? null,
    has2025ServiceMedal: has2025,
    hasPremierSeasonOneMedal: s1,
    hasPremierSeasonTwoMedal: s2,
  };
};

const friendsToShape = (friends) => {
  if (!Array.isArray(friends)) return [];
  return friends.map((f) => ({
    steamId: f.steamid,
    friendSince: toDateOrNull(f.friend_since),
  }));
};

module.exports = {
  summaryToDbShape,
  bansToDbShape,
  recentToPlaytime2Weeks,
  badgesToShape,
  friendsToShape,
};
