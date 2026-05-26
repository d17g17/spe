'use strict';

// Flags items whose value isn't captured by Steam market price alone.
// Only catches "offsite-premium" rarity: applied super-rare stickers, pattern
// gems, and phase-variance skins. Pure market value (expensive knives, plain
// rifles, sticker bombs) is NOT flagged here -- that's already obvious from the
// price badge.

const GOLD_RE = /\(Gold\)/i;
const LENTICULAR_RE = /\(Lenticular\)/i;

// 2013-2016 tournament holos only (2017+ excluded -- too young / not blue-chip)
const LEGENDARY_HOLO_RE = new RegExp([
  'dreamhack 2013',
  'dreamhack (?:winter )?2014',
  'katowice 2014',
  'katowice 2015',
  'cologne 2014',
  'cologne 2015',
  'cologne 2016',
  'cluj[- ]?napoca 2015',
  'columbus 2016',
].join('|'), 'i');

const KNIFE_RE = /★/;
const GLOVES_RE = /\b(Specialist Gloves|Sport Gloves|Driver Gloves|Bloodhound Gloves|Hand Wraps|Hydra Gloves|Moto Gloves|Broken Fang Gloves)\b/i;

const GAMMA_DOPPLER_RE = /Gamma Doppler/i;
const DOPPLER_RE = /\bDoppler\b/i;
const CASE_HARDENED_RE = /Case Hardened/i;
const MARBLE_FADE_RE = /Marble Fade/i;
const FADE_RE = /\bFade\b/i; // matches plain "Fade" not "Marble Fade" thanks to ordering

const isKnifeOrGloves = (name) => KNIFE_RE.test(name) || GLOVES_RE.test(name);

const computeRareTags = (items) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  const tags = [];
  const seen = new Set();
  const push = (id, label, detail) => {
    const key = id + '|' + detail;
    if (seen.has(key)) return;
    seen.add(key);
    tags.push({ id, label, detail });
  };

  for (const it of items) {
    if (!it || !it.tradable) continue;
    const name = it.name || '';

    // --- Applied super-rare stickers only ---
    // extractStickers parses sticker_info overlays, so it.stickers is populated
    // only when stickers are APPLIED to a weapon. Loose Sticker | X items have
    // empty stickers arrays and won't trigger here.
    for (const s of it.stickers || []) {
      const sn = s.name || '';
      if (s.rarity === 'gold' || GOLD_RE.test(sn)) {
        push('gold-sticker', 'Gold sticker (applied)', `${sn} on ${name}`);
      } else if (s.rarity === 'lenticular' || LENTICULAR_RE.test(sn)) {
        push('lenticular-sticker', 'Lenticular sticker (applied)', `${sn} on ${name}`);
      } else if (s.rarity === 'holo' && LEGENDARY_HOLO_RE.test(sn)) {
        push('legendary-holo', 'Legendary holo (applied)', `${sn} on ${name}`);
      }
    }

    // --- Pattern / phase rarity (offsite premium not captured by market) ---
    // Case Hardened: blue gems on ANY weapon trade for 10-1000x market price.
    if (CASE_HARDENED_RE.test(name)) {
      push('case-hardened', 'Case Hardened (blue gem potential)', name);
      continue;
    }
    // For other pattern families, only flag knives/gloves where phase / fade %
    // variance commands real premium. Plain rifle Dopplers don't exist.
    if (!isKnifeOrGloves(name)) continue;

    if (GAMMA_DOPPLER_RE.test(name)) {
      push('gamma-doppler', 'Gamma Doppler (Emerald potential)', name);
    } else if (DOPPLER_RE.test(name)) {
      push('doppler', 'Doppler (Ruby/Sapphire/BP potential)', name);
    } else if (MARBLE_FADE_RE.test(name)) {
      push('marble-fade', 'Marble Fade (Fire & Ice potential)', name);
    } else if (FADE_RE.test(name)) {
      push('fade', 'Fade (% variance)', name);
    }
  }

  return tags;
};

module.exports = { computeRareTags };
