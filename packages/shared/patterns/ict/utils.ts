import type { ChartDataPoint } from "../../types/chart";
import type { ICTAnalysis, ICTConfig } from "./types";
import type { TradingSignal } from "../types";
import type { PatternAnalysis } from "../types";
import { calculateATR, isSwingHigh, isSwingLow } from "../common";
import { detectMarketStructure, getCurrentTrend, getLastSwing } from "./market-structure";
import { detectFVGs, getUnfilledFVGs, getRecentFVGs } from "./fvg";
import { detectOrderBlocks, getUnmitigatedOBs } from "./order-blocks";
import { detectLiquidityZones, getUnsweptLiquidity } from "./liquidity";
import { calculateOTEZones, getGoldenPocketZone, isPriceInOTE } from "./ote";
import { DIRECTION, SIGNAL_TYPE, TRADE_PARAMS, CONFIDENCE } from "../constants";

export { DEFAULT_ICT_CONFIG } from "./types";

export const analyzeICT = (candles: ChartDataPoint[], config: ICTConfig): ICTAnalysis => {
  if (candles.length === 0) {
    return {
      marketStructure: { swings: [], events: [], currentTrend: DIRECTION.NEUTRAL },
      fvgs: [],
      orderBlocks: [],
      liquidityZones: [],
      oteZones: [],
    };
  }

  const atr = calculateATR(candles, config.atrPeriod);
  const marketStructure = detectMarketStructure(candles, config.swingLookback);
  const fvgs = detectFVGs(candles, config.fvgMinSize);
  const orderBlocks = detectOrderBlocks(candles, atr);
  const liquidityZones = detectLiquidityZones(candles, config.liquidityTolerance);
  const oteZones = calculateOTEZones(marketStructure.swings, marketStructure.events);

  return {
    marketStructure,
    fvgs,
    orderBlocks,
    liquidityZones,
    oteZones,
  };
};

export const generateICTSignals = (
  analysis: ICTAnalysis,
  currentPrice: number
): TradingSignal[] => {
  const signals: TradingSignal[] = [];
  const trend = getCurrentTrend(analysis.marketStructure);
  const unfilledFVGs = getUnfilledFVGs(analysis.fvgs);
  const unmitigatedOBs = getUnmitigatedOBs(analysis.orderBlocks);

  if (trend === DIRECTION.BULLISH) {
    const recentFVGs = getRecentFVGs(unfilledFVGs, 3, DIRECTION.BULLISH);
    const recentOBs = unmitigatedOBs.filter((ob) => ob.type === DIRECTION.BULLISH).slice(-2);
    const gpZone = getGoldenPocketZone(analysis.oteZones);

    if (recentFVGs.length > 0 && recentOBs.length > 0) {
      const lastFVG = recentFVGs[recentFVGs.length - 1];
      const lastOB = recentOBs[recentOBs.length - 1];

      if (currentPrice <= lastFVG.midpoint && currentPrice >= lastOB.low) {
        signals.push({
          type: SIGNAL_TYPE.LONG,
          entry: currentPrice,
          stopLoss: lastOB.low - (lastOB.high - lastOB.low) * TRADE_PARAMS.STOP_LOSS_MULTIPLIER,
          takeProfit:
            currentPrice + (currentPrice - lastOB.low) * TRADE_PARAMS.TAKE_PROFIT_MULTIPLIER,
          reason: "Bullish FVG + Order Block confluence",
          confidence: CONFIDENCE.MEDIUM,
          timestamp: Date.now(),
        });
      }
    }

    if (gpZone && isPriceInOTE(currentPrice, analysis.oteZones, DIRECTION.BULLISH)) {
      signals.push({
        type: SIGNAL_TYPE.LONG,
        entry: currentPrice,
        stopLoss: gpZone.low - (gpZone.high - gpZone.low) * TRADE_PARAMS.STOP_LOSS_MULTIPLIER,
        takeProfit:
          currentPrice + (currentPrice - gpZone.low) * TRADE_PARAMS.TAKE_PROFIT_MULTIPLIER,
        reason: "Price in Golden Pocket OTE zone",
        confidence: CONFIDENCE.HIGH,
        timestamp: Date.now(),
      });
    }
  } else if (trend === DIRECTION.BEARISH) {
    const recentFVGs = getRecentFVGs(unfilledFVGs, 3, DIRECTION.BEARISH);
    const recentOBs = unmitigatedOBs.filter((ob) => ob.type === DIRECTION.BEARISH).slice(-2);
    const gpZone = getGoldenPocketZone(analysis.oteZones);

    if (recentFVGs.length > 0 && recentOBs.length > 0) {
      const lastFVG = recentFVGs[recentFVGs.length - 1];
      const lastOB = recentOBs[recentOBs.length - 1];

      if (currentPrice >= lastFVG.midpoint && currentPrice <= lastOB.high) {
        signals.push({
          type: SIGNAL_TYPE.SHORT,
          entry: currentPrice,
          stopLoss: lastOB.high + (lastOB.high - lastOB.low) * TRADE_PARAMS.STOP_LOSS_MULTIPLIER,
          takeProfit:
            currentPrice - (lastOB.high - currentPrice) * TRADE_PARAMS.TAKE_PROFIT_MULTIPLIER,
          reason: "Bearish FVG + Order Block confluence",
          confidence: CONFIDENCE.MEDIUM,
          timestamp: Date.now(),
        });
      }
    }

    if (gpZone && isPriceInOTE(currentPrice, analysis.oteZones, DIRECTION.BEARISH)) {
      signals.push({
        type: SIGNAL_TYPE.SHORT,
        entry: currentPrice,
        stopLoss: gpZone.high + (gpZone.high - gpZone.low) * TRADE_PARAMS.STOP_LOSS_MULTIPLIER,
        takeProfit:
          currentPrice - (gpZone.high - currentPrice) * TRADE_PARAMS.TAKE_PROFIT_MULTIPLIER,
        reason: "Price in Golden Pocket OTE zone",
        confidence: CONFIDENCE.HIGH,
        timestamp: Date.now(),
      });
    }
  }

  return signals;
};

export const analyzeICTWithSignals = (
  candles: ChartDataPoint[],
  config: ICTConfig
): PatternAnalysis => {
  const analysis = analyzeICT(candles, config);
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const signals = generateICTSignals(analysis, currentPrice);

  return {
    signals,
    metadata: {
      trend: analysis.marketStructure.currentTrend,
      swingCount: analysis.marketStructure.swings.length,
      fvgCount: analysis.fvgs.length,
      obCount: analysis.orderBlocks.length,
      liquidityCount: analysis.liquidityZones.length,
      oteCount: analysis.oteZones.length,
    },
  };
};

export {
  detectMarketStructure,
  detectFVGs,
  detectOrderBlocks,
  detectLiquidityZones,
  calculateOTEZones,
  getCurrentTrend,
  getLastSwing,
  getUnfilledFVGs,
  getUnmitigatedOBs,
  getUnsweptLiquidity,
  getGoldenPocketZone,
  isPriceInOTE,
  isSwingHigh,
  isSwingLow,
};
