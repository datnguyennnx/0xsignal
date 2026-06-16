export const getThemeColor = (token: string, fallback: string = ""): string => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  return value || fallback;
};

/** Stable HSL color from string seed. */
export const getStableColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use the hash to drive HSL for better visual distribution than RGB
  const h = Math.abs(hash) % 360;
  const s = 70 + (Math.abs(hash >> 8) % 20); // 70-90%
  const l = 45 + (Math.abs(hash >> 16) % 15); // 45-60%
  return `hsl(${h}, ${s}%, ${l}%)`;
};
