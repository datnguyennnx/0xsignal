import { getTimeframeMs, type MarketTimeframe } from "./timeframe";

export const alignRangeToTimeframe = (
  timeframe: MarketTimeframe,
  startTime: Date,
  endTime: Date,
): { startTime: Date; endTime: Date } => {
  const timeframeMs = getTimeframeMs(timeframe);
  const alignedStartMs = Math.ceil(startTime.getTime() / timeframeMs) * timeframeMs;
  const alignedEndMs = Math.floor(endTime.getTime() / timeframeMs) * timeframeMs;

  return {
    startTime: new Date(alignedStartMs),
    endTime: new Date(alignedEndMs),
  };
};
