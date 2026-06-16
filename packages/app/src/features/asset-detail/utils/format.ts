export const formatSignedUsd = (value: number): string => {
  if (!Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: abs >= 100 ? 0 : 2,
    maximumFractionDigits: abs >= 100 ? 2 : 4,
  });
  return `${value >= 0 ? "+" : "-"}$${formatted}`;
};

export const formatFundingPercent = (fundingRate: number): string => {
  if (!Number.isFinite(fundingRate)) return "-";
  return `${fundingRate >= 0 ? "+" : ""}${(fundingRate * 100).toFixed(4)}%`;
};

export const toCountdown = (msRemaining: number): string => {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

export const getNextFundingMs = (): number => {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setHours(next.getHours() + 1);
  }
  return next.getTime() - now.getTime();
};
