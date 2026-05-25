// Map adaptive concurrency target to a "speed" percent.
// 12 -> 100% (baseline cruise).
// 20 -> 200% (max overdrive). Below 12 ramps linearly to 0%.
export const speedPercent = (target) => {
  const t = Math.max(1, Number(target) || 1);
  if (t <= 12) return Math.round((t / 12) * 100);
  return Math.round(100 + ((t - 12) / 8) * 100);
};
