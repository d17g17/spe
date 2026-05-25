'use strict';

const KNIFE_RE = /★/;
const GLOVES_RE = /(?:^|\s)(Specialist Gloves|Sport Gloves|Driver Gloves|Bloodhound Gloves|Hand Wraps|Hydra Gloves|Moto Gloves|Broken Fang Gloves)\s*\|/i;
const SOUVENIR_RE = /^Souvenir\s/i;
const STATTRAK_RE = /StatTrak/i;
const WEAR_RE = /\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/i;
const RARE_PATTERN_RE = /(Case Hardened|Crimson Web|Marble Fade|Tiger Tooth|Doppler|Gamma Doppler|Lore|Damascus Steel|Black Pearl|Slaughter|Fade|Emerald)/i;

const WEAR_SCORE = {
  'factory new': 4,
  'minimal wear': 2,
  'field-tested': 0,
  'well-worn': 1,
  'battle-scarred': 3,
};

const extractTraits = (name) => {
  if (!name) return null;
  const traits = {
    isKnife: KNIFE_RE.test(name),
    isGloves: GLOVES_RE.test(name),
    isSouvenir: SOUVENIR_RE.test(name),
    isStatTrak: STATTRAK_RE.test(name),
    hasRarePattern: RARE_PATTERN_RE.test(name),
    wear: null,
  };
  const w = name.match(WEAR_RE);
  if (w) traits.wear = w[1].toLowerCase();
  return traits;
};

const traitScore = (traits) => {
  if (!traits) return 0;
  let score = 0;
  if (traits.isKnife) score += 60;
  if (traits.isGloves) score += 60;
  if (traits.isSouvenir) score += 25;
  if (traits.isStatTrak) score += 8;
  if (traits.hasRarePattern) score += 20;
  if (traits.wear && WEAR_SCORE[traits.wear] != null) score += WEAR_SCORE[traits.wear];
  return score;
};

const TAG_LABELS = (traits) => {
  if (!traits) return [];
  const tags = [];
  if (traits.isKnife) tags.push({ id: 'knife', label: 'Knife', cls: 'bg-yellow-700/30 text-yellow-200' });
  if (traits.isGloves) tags.push({ id: 'gloves', label: 'Gloves', cls: 'bg-yellow-700/30 text-yellow-200' });
  if (traits.isSouvenir) tags.push({ id: 'souvenir', label: 'Souvenir', cls: 'bg-yellow-600/40 text-yellow-100' });
  if (traits.isStatTrak) tags.push({ id: 'stattrak', label: 'StatTrak', cls: 'bg-orange-700/40 text-orange-200' });
  if (traits.hasRarePattern) tags.push({ id: 'pattern', label: 'Rare pattern', cls: 'bg-rose-700/40 text-rose-200' });
  return tags;
};

module.exports = { extractTraits, traitScore, TAG_LABELS };
