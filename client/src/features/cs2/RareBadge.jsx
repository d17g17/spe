export default function RareBadge({ inventory }) {
  const tags = Array.isArray(inventory?.rareTags) ? inventory.rareTags : [];
  if (tags.length === 0) return null;

  const tooltip = tags
    .map((t) => `${t.label}: ${t.detail}`)
    .join('\n');

  return (
    <span
      title={tooltip}
      className="badge border border-amber-400/60 bg-gradient-to-r from-amber-500/30 to-rose-500/30 text-amber-100 font-bold tracking-wider"
    >
      RARE
    </span>
  );
}
