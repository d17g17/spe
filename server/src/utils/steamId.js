'use strict';

const STEAM_ID_RE = /^7656119[0-9]{10}$/;

const isSteamId64 = (v) => typeof v === 'string' && STEAM_ID_RE.test(v);

const parseSteamInput = (raw) => {
  if (typeof raw !== 'string') return { kind: 'invalid' };
  const s = raw.trim();
  if (!s) return { kind: 'invalid' };

  if (isSteamId64(s)) return { kind: 'id', value: s };

  const url = s.match(/^https?:\/\/steamcommunity\.com\/(profiles|id)\/([^/?#]+)/i);
  if (url) {
    const seg = decodeURIComponent(url[2]);
    if (url[1].toLowerCase() === 'profiles' && isSteamId64(seg)) {
      return { kind: 'id', value: seg };
    }
    return { kind: 'vanity', value: seg };
  }

  return { kind: 'vanity', value: s };
};

module.exports = { isSteamId64, parseSteamInput };
