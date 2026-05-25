import { useState } from 'react';

const ICON_BASE = 'https://community.cloudflare.steamstatic.com/economy/image/';

const badgeLabel = (b) => b.title || b.name || '?';

const badgeIconUrl = (icon) => {
  if (!icon) return null;
  if (/^https?:\/\//i.test(icon)) return icon;
  return `${ICON_BASE}${icon}/64fx64f`;
};

export default function BadgesRow({ badges, max = 3, inline = false }) {
  const [showAll, setShowAll] = useState(false);
  if (!Array.isArray(badges) || badges.length === 0) return null;
  const visible = showAll ? badges : badges.slice(0, max);
  const overflow = badges.length - visible.length;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${inline ? '' : 'mt-1'}`}>
      {visible.map((b, idx) => (
        <BadgeIcon key={`${badgeLabel(b)}-${idx}`} badge={b} />
      ))}
      {!showAll && overflow > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-[11px] text-sky-400 hover:text-sky-300"
          title={`Show all ${badges.length} medals/coins`}
        >
          +{overflow}
        </button>
      )}
      {showAll && badges.length > max && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="text-[11px] text-gray-500 hover:text-gray-300"
        >
          less
        </button>
      )}
    </div>
  );
}

function BadgeIcon({ badge }) {
  const label = badgeLabel(badge);
  const tooltip = [
    label,
    badge.quantity > 1 ? `×${badge.quantity}` : null,
    badge.unlocked ? `Unlocked ${badge.unlocked}` : null,
    badge.level != null ? `Level ${badge.level}` : null,
  ].filter(Boolean).join(' · ');
  const src = badgeIconUrl(badge.icon);
  if (!src) {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded bg-gray-800 text-[9px] text-gray-400 text-center leading-tight px-0.5"
        title={tooltip}
      >
        {label.slice(0, 3)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={label}
      title={tooltip}
      loading="lazy"
      className="w-7 h-7 object-contain rounded bg-gray-900/50"
      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
    />
  );
}
