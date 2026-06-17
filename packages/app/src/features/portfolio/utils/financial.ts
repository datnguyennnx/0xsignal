export function computeMaxDrawdown(history: [number, string][]): number | null {
  if (history.length < 2) return null;
  let peak = -Infinity,
    maxDd = 0;
  for (const [, v] of history) {
    const val = Number(v);
    if (!Number.isFinite(val)) continue;
    if (val > peak) peak = val;
    if (peak > 0) {
      const dd = (val - peak) / peak;
      if (dd < maxDd) maxDd = dd;
    }
  }
  return maxDd;
}
