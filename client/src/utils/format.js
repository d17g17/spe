export const formatMoney = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '$0.00';
  const num = Number(n);
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

export const formatRelative = (date) => {
  if (!date) return '—';
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
};

export const formatMinutes = (m) => {
  if (!m || !Number.isFinite(Number(m))) return '0h';
  const h = Math.floor(Number(m) / 60);
  return `${h}h`;
};

const PERSONA = ['Offline', 'Online', 'Busy', 'Away', 'Snooze', 'Looking to trade', 'Looking to play'];
export const personaLabel = (s) => PERSONA[Number(s) || 0] || 'Offline';

const VIS = { 1: 'Private', 2: 'Friends Only', 3: 'Public' };
export const visibilityLabel = (s) => VIS[Number(s)] || 'Unknown';

export const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const countryFlagUrl = (code, size = 24) => {
  if (!code || typeof code !== 'string' || code.length !== 2) return null;
  const cc = code.toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return null;
  const w = size <= 16 ? 16 : size <= 20 ? 20 : size <= 24 ? 24 : size <= 32 ? 32 : 40;
  return `https://flagcdn.com/w${w}/${cc}.png`;
};
