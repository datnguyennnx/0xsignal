import type { ChartDataPoint } from "../../types/chart";
import type { OrderBlock, OrderBlockType } from "./types";
import { getCandleBodySize, isBullishCandle, isBearishCandle } from "../common";
import { DIRECTION, DETECTION_THRESHOLDS } from "../constants";

export const detectOrderBlocks = (data: ChartDataPoint[], atr: number): OrderBlock[] => {
  const orderBlocks: OrderBlock[] = [];
  if (data.length < 3 || atr === 0) return orderBlocks;

  const runningMinLow: number[] = new Array(data.length);
  const runningMaxHigh: number[] = new Array(data.length);

  runningMinLow[data.length - 1] = data[data.length - 1].low;
  runningMaxHigh[data.length - 1] = data[data.length - 1].high;

  for (let i = data.length - 2; i >= 0; i--) {
    runningMinLow[i] = Math.min(data[i].low, runningMinLow[i + 1]);
    runningMaxHigh[i] = Math.max(data[i].high, runningMaxHigh[i + 1]);
  }

  for (let i = 1; i < data.length - 1; i++) {
    const candle = data[i];
    const nextCandle = data[i + 1];
    const nextBodySize = getCandleBodySize(nextCandle);

    if (
      isBearishCandle(candle) &&
      isBullishCandle(nextCandle) &&
      nextBodySize > atr * DETECTION_THRESHOLDS.ORDER_BLOCK_ATR_MULTIPLIER
    ) {
      const mitigatedAt =
        i + 2 < data.length && runningMinLow[i + 2] <= candle.low ? data[i + 2].time : undefined;

      orderBlocks.push({
        time: candle.time,
        type: DIRECTION.BULLISH,
        high: candle.high,
        low: candle.low,
        mitigated: !!mitigatedAt,
        mitigatedAt,
        index: i,
      });
    }

    if (
      isBullishCandle(candle) &&
      isBearishCandle(nextCandle) &&
      nextBodySize > atr * DETECTION_THRESHOLDS.ORDER_BLOCK_ATR_MULTIPLIER
    ) {
      const mitigatedAt =
        i + 2 < data.length && runningMaxHigh[i + 2] >= candle.high ? data[i + 2].time : undefined;

      orderBlocks.push({
        time: candle.time,
        type: DIRECTION.BEARISH,
        high: candle.high,
        low: candle.low,
        mitigated: !!mitigatedAt,
        mitigatedAt,
        index: i,
      });
    }
  }

  return orderBlocks;
};

export const getUnmitigatedOBs = (orderBlocks: OrderBlock[]): OrderBlock[] => {
  return orderBlocks.filter((ob) => !ob.mitigated);
};

export const getRecentOBs = (
  orderBlocks: OrderBlock[],
  count: number,
  type?: OrderBlockType
): OrderBlock[] => {
  let filtered = orderBlocks;
  if (type) {
    filtered = orderBlocks.filter((ob) => ob.type === type);
  }
  return filtered.slice(-count);
};

export const getActiveOrderBlock = (
  orderBlocks: OrderBlock[],
  currentPrice: number,
  type: OrderBlockType
): OrderBlock | null => {
  const unmitigated = orderBlocks.filter((ob) => !ob.mitigated && ob.type === type);
  if (unmitigated.length === 0) return null;

  const last = unmitigated[unmitigated.length - 1];
  if (type === DIRECTION.BULLISH && currentPrice > last.low && currentPrice < last.high) {
    return last;
  }
  if (type === DIRECTION.BEARISH && currentPrice < last.high && currentPrice > last.low) {
    return last;
  }
  return null;
};
