export { formatSignedUsd, formatFundingPercent } from "@/core/utils/formatters";

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

export { getNextFundingMs } from "@/core/utils/formatters";
