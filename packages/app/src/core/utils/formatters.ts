const MAX_SIG_FIGS = 5;

export const formatPrice = (price: number, pxDecimals?: number): string => {
  const maxDec = pxDecimals ?? Math.min(MAX_SIG_FIGS, 6);
  const config =
    price >= 1000
      ? { min: Math.min(2, maxDec), max: Math.min(2, maxDec) }
      : price >= 1
        ? { min: Math.min(2, maxDec), max: Math.min(4, maxDec) }
        : { min: Math.min(4, maxDec), max: Math.min(6, maxDec) };

  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: config.min,
    maximumFractionDigits: config.max,
  });
};

export const formatSize = (size: number): string => {
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(2)}M`;
  if (size >= 1_000) return `${(size / 1_000).toFixed(2)}K`;
  return size.toFixed(size < 1 ? 4 : 2);
};

export const formatPriceWithScaling = (price: number, scaling: number): string => {
  let decimals: number;
  if (scaling >= 1) decimals = 0;
  else decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(scaling))));

  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatCompactUsd = (value: number): string => {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Calculate milliseconds remaining until the next funding interval (top of the hour).
 */
export const getNextFundingMs = (): number => {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setHours(next.getHours() + 1);
  }
  return next.getTime() - now.getTime();
};

export const formatSignedPercent = (pct: number): string => {
  if (!Number.isFinite(pct)) return "-";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
};
