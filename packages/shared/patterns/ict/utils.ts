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

export { DEFAULT_ICT_CONFIG } from "./types";

export const analyzeICT = (candles: ChartDataPoint[], config: ICTConfig): ICTAnalysis => {
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
  const unsweptLiquidity = getUnsweptLiquidity(analysis.liquidityZones);

  if (trend === "bullish") {
    const recentFVGs = getRecentFVGs(unfilledFVGs, 3, "bullish");
    const recentOBs = unmitigatedOBs.filter((ob) => ob.type === "bullish").slice(-2);
    const gpZone = getGoldenPocketZone(analysis.oteZones);

    if (recentFVGs.length > 0 && recentOBs.length > 0) {
      const lastFVG = recentFVGs[recentFVGs.length - 1];
      const lastOB = recentOBs[recentOBs.length - 1];

      if (currentPrice <= lastFVG.midpoint && currentPrice >= lastOB.low) {
        signals.push({
          type: "long",
          entry: currentPrice,
          stopLoss: lastOB.low - (lastOB.high - lastOB.low) * 0.5,
          takeProfit: currentPrice + (currentPrice - lastOB.low) * 2,
          reason: "Bullish FVG + Order Block confluence",
          confidence: 75,
          timestamp: Date.now(),
        });
      }
    }

    if (gpZone && isPriceInOTE(currentPrice, analysis.oteZones, "bullish")) {
      signals.push({
        type: "long",
        entry: currentPrice,
        stopLoss: gpZone.low - (gpZone.high - gpZone.low) * 0.5,
        takeProfit: currentPrice + (currentPrice - gpZone.low) * 2,
        reason: "Price in Golden Pocket OTE zone",
        confidence: 80,
        timestamp: Date.now(),
      });
    }
  } else if (trend === "bearish") {
    const recentFVGs = getRecentFVGs(unfilledFVGs, 3, "bearish");
    const recentOBs = unmitigatedOBs.filter((ob) => ob.type === "bearish").slice(-2);
    const gpZone = getGoldenPocketZone(analysis.oteZones);

    if (recentFVGs.length > 0 && recentOBs.length > 0) {
      const lastFVG = recentFVGs[recentFVGs.length - 1];
      const lastOB = recentOBs[recentOBs.length - 1];

      if (currentPrice >= lastFVG.midpoint && currentPrice <= lastOB.high) {
        signals.push({
          type: "short",
          entry: currentPrice,
          stopLoss: lastOB.high + (lastOB.high - lastOB.low) * 0.5,
          takeProfit: currentPrice - (lastOB.high - currentPrice) * 2,
          reason: "Bearish FVG + Order Block confluence",
          confidence: 75,
          timestamp: Date.now(),
        });
      }
    }

    if (gpZone && isPriceInOTE(currentPrice, analysis.oteZones, "bearish")) {
      signals.push({
        type: "short",
        entry: currentPrice,
        stopLoss: gpZone.high + (gpZone.high - gpZone.low) * 0.5,
        takeProfit: currentPrice - (gpZone.high - currentPrice) * 2,
        reason: "Price in Golden Pocket OTE zone",
        confidence: 80,
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
