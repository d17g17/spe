'use strict';

const STICKER_IMG_RE = /<img[^>]*src="([^"]+)"[^>]*title="Sticker:\s*([^"]+)"/gi;
const HOLO_RE = /\(Holo\)/i;
const FOIL_RE = /\(Foil\)/i;
const GOLD_RE = /\(Gold\)/i;
const LENTICULAR_RE = /\(Lenticular\)/i;
const LEGENDARY_TOURNAMENT_RE = new RegExp([
  'dreamhack (?:winter )?20(?:13|14)',
  'katowice 201[4-7]',
  'cologne 201[4-7]',
  'columbus 2016',
  'cluj[- ]?napoca 2015',
  'atlanta 2017',
  'krak[oó]w 2017',
  'boston 2018',
].join('|'), 'i');

const classifySticker = (name) => {
  if (!name) return 'paper';
  if (GOLD_RE.test(name)) return 'gold';
  if (LENTICULAR_RE.test(name)) return 'lenticular';
  if (HOLO_RE.test(name)) return 'holo';
  if (FOIL_RE.test(name)) return 'foil';
  if (LEGENDARY_TOURNAMENT_RE.test(name)) return 'legendary';
  return 'paper';
};

const RARITY_SCORE = { gold: 5, lenticular: 4, legendary: 4, holo: 3, foil: 2, paper: 1 };

const extractStickers = (desc) => {
  if (!Array.isArray(desc?.descriptions)) return [];
  for (const sub of desc.descriptions) {
    if (typeof sub.value !== 'string') continue;
    if (!sub.value.includes('sticker_info') && !sub.value.includes('Sticker:')) continue;
    const out = [];
    let m;
    STICKER_IMG_RE.lastIndex = 0;
    while ((m = STICKER_IMG_RE.exec(sub.value)) !== null) {
      const icon = m[1];
      const name = m[2].trim();
      out.push({ name, icon, rarity: classifySticker(name) });
    }
    if (out.length) return out;
  }
  return [];
};

const itemRarityScore = (stickers) => {
  if (!Array.isArray(stickers) || stickers.length === 0) return 0;
  let max = 0;
  for (const s of stickers) {
    const v = RARITY_SCORE[s.rarity] || 0;
    if (v > max) max = v;
  }
  return max * 100 + stickers.length;
};

module.exports = { extractStickers, classifySticker, itemRarityScore, RARITY_SCORE };
