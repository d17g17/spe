// Steam's official level tier colors (every 10 levels = new color).
const LEVEL_TIER_COLORS = [
  '#a0a0a0', // 0–9   Gray
  '#e25555', // 10–19 Red
  '#f08a3c', // 20–29 Orange
  '#f4d24a', // 30–39 Yellow
  '#5ec264', // 40–49 Green
  '#4f9cff', // 50–59 Blue
  '#a06ed8', // 60–69 Purple
  '#ec7ad0', // 70–79 Pink
  '#8a4b2b', // 80–89 Brown (Vinous)
  '#d4a93b', // 90–99 Gold
  '#3affff', // 100+  Diamond/Special
];

const colorForLevel = (level) => {
  const tens = Math.min(10, Math.floor(level / 10));
  return LEVEL_TIER_COLORS[tens];
};

// Steam-style circular level badge — matches the look of the level disc shown
// on Steam profile pages: dark inner circle, tier-colored ring + level inside.
export function LevelBadge({ level, size = 'sm' }) {
  if (level == null) return null;
  const color = colorForLevel(level);
  const isLg = size === 'lg';
  const dim = isLg ? 36 : 28;
  const fontSize = isLg ? 14 : 12;

  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 select-none font-bold tabular-nums"
      style={{
        width: `${dim}px`,
        height: `${dim}px`,
        background: 'radial-gradient(circle at 50% 35%, #2a2a2a 0%, #111 80%)',
        border: `2px solid ${color}`,
        boxShadow: `0 0 6px ${color}66, inset 0 0 4px ${color}33`,
        color,
        fontSize: `${fontSize}px`,
        lineHeight: 1,
      }}
      title={`Steam Level ${level}`}
    >
      {level}
    </span>
  );
}

// Steam's official Years of Service badges, hosted on Steam CDN.
// URL pattern: steamyears{N}_80.png  (N = years, available 1..22).
const YEARS_BADGE_MAX = 22;
const yearsBadgeUrl = (years) => {
  const clamped = Math.max(1, Math.min(YEARS_BADGE_MAX, years));
  return `https://community.akamai.steamstatic.com/public/images/badges/02_years/steamyears${clamped}_80.png`;
};

export function YearsBadge({ timeCreated, size = 'sm' }) {
  if (!timeCreated) return null;
  const t = new Date(timeCreated).getTime();
  if (!Number.isFinite(t)) return null;
  const years = (Date.now() - t) / (365.25 * 24 * 3600 * 1000);
  const whole = Math.floor(years);
  if (whole < 1) return null;

  const isLg = size === 'lg';
  const iconSize = isLg ? 40 : 30;
  const date = new Date(timeCreated).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

  return (
    <img
      src={yearsBadgeUrl(whole)}
      alt={`${whole} Years of Service`}
      width={iconSize}
      height={iconSize}
      loading="lazy"
      draggable="false"
      className="shrink-0 select-none"
      title={`Years of Service · ${whole} year${whole === 1 ? '' : 's'} · Account created ${date} (${years.toFixed(1)} years ago)`}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}
