import { countryFlagUrl } from '../utils/format.js';

export default function Flag({ code, size = 16, className = '' }) {
  if (!code) return null;
  const url = countryFlagUrl(code, size);
  if (!url) return null;
  const h = Math.round(size * 0.75);
  return (
    <img
      src={url}
      alt={code}
      title={code}
      width={size}
      height={h}
      loading="lazy"
      className={`inline-block rounded-sm shrink-0 ${className}`}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}
