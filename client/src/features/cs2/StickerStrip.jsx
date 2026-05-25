const RARITY_RING = {
  gold: 'ring-amber-400',
  lenticular: 'ring-fuchsia-400',
  legendary: 'ring-orange-400',
  holo: 'ring-sky-400',
  foil: 'ring-emerald-400',
  paper: 'ring-gray-600',
};

const RARITY_BADGE = {
  gold: 'bg-amber-700/40 text-amber-200',
  lenticular: 'bg-fuchsia-700/40 text-fuchsia-200',
  legendary: 'bg-orange-700/40 text-orange-200',
  holo: 'bg-sky-700/40 text-sky-200',
  foil: 'bg-emerald-700/40 text-emerald-200',
  paper: 'bg-gray-700/40 text-gray-300',
};

const RARITY_RANK = { gold: 5, lenticular: 4, legendary: 4, holo: 3, foil: 2, paper: 1 };

export function bestRarity(stickers = []) {
  let best = null;
  let bestRank = 0;
  for (const s of stickers) {
    const r = RARITY_RANK[s.rarity] || 0;
    if (r > bestRank) { best = s.rarity; bestRank = r; }
  }
  return best;
}

export default function StickerStrip({ stickers = [], size = 24 }) {
  if (!stickers.length) return null;
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {stickers.map((s, idx) => (
        <span
          key={idx}
          title={
            s.name +
            (s.rarity && s.rarity !== 'paper' ? ` (${s.rarity})` : '') +
            (Number.isFinite(s.price) ? ` — $${s.price.toFixed(2)}` : '')
          }
          className={`inline-block rounded-sm ring-1 ${RARITY_RING[s.rarity] || RARITY_RING.paper} bg-gray-950/50 overflow-hidden`}
          style={{ width: size, height: size }}
        >
          {s.icon ? (
            <img src={s.icon} alt="" className="w-full h-full object-contain" />
          ) : null}
        </span>
      ))}
    </span>
  );
}

export function RarityBadge({ rarity }) {
  if (!rarity || rarity === 'paper') return null;
  const cls = RARITY_BADGE[rarity] || RARITY_BADGE.paper;
  return <span className={`badge text-[10px] uppercase ${cls}`}>{rarity}</span>;
}
