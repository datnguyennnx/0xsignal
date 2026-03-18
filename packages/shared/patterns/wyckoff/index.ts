import type { ChartDataPoint } from "../../types/chart";
import type { WyckoffAnalysis, WyckoffConfig, Climax, WyckoffEvent, EffortResult } from "./types";
import type { TradingSignal, PatternAnalysis } from "../types";
import { DEFAULT_WYCKOFF_CONFIG } from "./types";
import {
  detectSellingClimax,
  detectBuyingClimax,
  detectTradingRange,
  determineCycle,
  determinePhase,
  buildPhaseMarkers,
} from "./phases";
import {
  detectSpring,
  detectUpthrust,
  detectSecondaryTest,
  detectLPS,
  detectLPSY,
  detectSOS,
  detectSOW,
} from "./events";
import { calculateEffortResult } from "./effort-result";
import { isInAccumulation, isInDistribution } from "./cycles";

export { DEFAULT_WYCKOFF_CONFIG } from "./types";
export type {
  WyckoffPhase,
  WyckoffCycle,
  ClimaxType,
  TestType,
  TradingRange,
  Climax,
  WyckoffEvent,
  PhaseMarker,
  EffortResult,
  WyckoffAnalysis,
  WyckoffConfig,
} from "./types";

export const analyzeWyckoff = (data: ChartDataPoint[], config: WyckoffConfig): WyckoffAnalysis => {
  if (data.length < config.volumeLookback + 10) {
    return {
      cycle: "unknown",
      currentPhase: null,
      tradingRange: null,
      climaxes: [],
      events: [],
      phases: [],
      effortResults: [],
    };
  }

  const climaxes: Climax[] = [];
  const events: WyckoffEvent[] = [];
  const effortResults: EffortResult[] = [];

  for (let i = config.volumeLookback; i < data.length; i++) {
    const sc = detectSellingClimax(data, i, config);
    if (sc) climaxes.push(sc);

    const bc = detectBuyingClimax(data, i, config);
    if (bc) climaxes.push(bc);

    const er = calculateEffortResult(data, i, 5);
    if (er && er.divergence !== "neutral") {
      effortResults.push(er);
    }
  }

  if (climaxes.length === 0) {
    return {
      cycle: "unknown",
      currentPhase: null,
      tradingRange: null,
      climaxes: [],
      events: [],
      phases: [],
      effortResults: effortResults.slice(-10),
    };
  }

  const lastClimax = climaxes[climaxes.length - 1];
  const isAccumulation = lastClimax.type === "SC";

  const rangeStart = lastClimax.index;
  const rangeEnd = data.length - 1;
  const tradingRange = detectTradingRange(data, rangeStart, rangeEnd);

  if (tradingRange) {
    for (let i = rangeStart + 1; i < data.length; i++) {
      const st = detectSecondaryTest(
        data,
        i,
        lastClimax.price,
        lastClimax.index,
        isAccumulation,
        config
      );
      if (st) events.push(st);

      if (isAccumulation) {
        const spring = detectSpring(data, i, tradingRange.low, config);
        if (spring) events.push(spring);

        const lps = detectLPS(data, i, tradingRange.low, config);
        if (lps) events.push(lps);

        const sos = detectSOS(data, i, tradingRange.high, config);
        if (sos) events.push(sos);
      } else {
        const upthrust = detectUpthrust(data, i, tradingRange.high, config);
        if (upthrust) events.push(upthrust);

        const lpsy = detectLPSY(data, i, tradingRange.high, config);
        if (lpsy) events.push(lpsy);

        const sow = detectSOW(data, i, tradingRange.low, config);
        if (sow) events.push(sow);
      }
    }
  }

  const cycle = determineCycle(climaxes, data);
  const phases = determinePhase(events, climaxes);
  const phaseMarkers = buildPhaseMarkers(cycle, climaxes, events);

  return {
    cycle,
    currentPhase: phases,
    tradingRange,
    climaxes: climaxes.slice(-5),
    events: events.slice(-10),
    phases: phaseMarkers,
    effortResults: effortResults.slice(-10),
  };
};

export const generateWyckoffSignals = (
  analysis: WyckoffAnalysis,
  currentPrice: number
): TradingSignal[] => {
  const signals: TradingSignal[] = [];
  const { cycle, currentPhase, tradingRange, events, climaxes, effortResults } = analysis;

  if (cycle === "unknown" || !tradingRange) return signals;

  const lastClimax = climaxes[climaxes.length - 1];
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const lastDivergence = effortResults.length > 0 ? effortResults[effortResults.length - 1] : null;

  if (isInAccumulation(cycle)) {
    if (currentPhase === "C" || lastEvent?.type === "spring") {
      signals.push({
        type: "long",
        entry: currentPrice,
        stopLoss: tradingRange.low - (tradingRange.high - tradingRange.low) * 0.02,
        takeProfit: tradingRange.high + (tradingRange.high - tradingRange.low) * 1.5,
        reason: "Wyckoff Spring/Test in Accumulation",
        confidence: 80,
        timestamp: Date.now(),
      });
    }

    if (lastEvent?.type === "LPS" || lastEvent?.type === "SOS") {
      signals.push({
        type: "long",
        entry: currentPrice,
        stopLoss: tradingRange.low - (tradingRange.high - tradingRange.low) * 0.02,
        takeProfit: tradingRange.high + (tradingRange.high - tradingRange.low) * 2,
        reason: "Wyckoff LPS/SOS Signal",
        confidence: 85,
        timestamp: Date.now(),
      });
    }

    if (lastDivergence?.divergence === "bullish") {
      signals.push({
        type: "long",
        entry: currentPrice,
        stopLoss: tradingRange.low - (tradingRange.high - tradingRange.low) * 0.02,
        takeProfit: tradingRange.high + (tradingRange.high - tradingRange.low) * 1.5,
        reason: "Bullish Effort vs Result Divergence",
        confidence: 70,
        timestamp: Date.now(),
      });
    }
  }

  if (isInDistribution(cycle)) {
    if (currentPhase === "C" || lastEvent?.type === "upthrust") {
      signals.push({
        type: "short",
        entry: currentPrice,
        stopLoss: tradingRange.high + (tradingRange.high - tradingRange.low) * 0.02,
        takeProfit: tradingRange.low - (tradingRange.high - tradingRange.low) * 1.5,
        reason: "Wyckoff Upthrust in Distribution",
        confidence: 80,
        timestamp: Date.now(),
      });
    }

    if (lastEvent?.type === "LPSY" || lastEvent?.type === "SOW") {
      signals.push({
        type: "short",
        entry: currentPrice,
        stopLoss: tradingRange.high + (tradingRange.high - tradingRange.low) * 0.02,
        takeProfit: tradingRange.low - (tradingRange.high - tradingRange.low) * 2,
        reason: "Wyckoff LPSY/SOW Signal",
        confidence: 85,
        timestamp: Date.now(),
      });
    }

    if (lastDivergence?.divergence === "bearish") {
      signals.push({
        type: "short",
        entry: currentPrice,
        stopLoss: tradingRange.high + (tradingRange.high - tradingRange.low) * 0.02,
        takeProfit: tradingRange.low - (tradingRange.high - tradingRange.low) * 1.5,
        reason: "Bearish Effort vs Result Divergence",
        confidence: 70,
        timestamp: Date.now(),
      });
    }
  }

  return signals;
};

export const analyzeWyckoffWithSignals = (
  candles: ChartDataPoint[],
  config: WyckoffConfig
): PatternAnalysis => {
  const analysis = analyzeWyckoff(candles, config);
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const signals = generateWyckoffSignals(analysis, currentPrice);

  return {
    signals,
    metadata: {
      cycle: analysis.cycle,
      phase: analysis.currentPhase,
      hasTradingRange: analysis.tradingRange !== null,
      climaxCount: analysis.climaxes.length,
      eventCount: analysis.events.length,
      divergenceCount: analysis.effortResults.length,
    },
  };
};

export {
  detectSellingClimax,
  detectBuyingClimax,
  detectTradingRange,
  determineCycle,
  determinePhase,
} from "./phases";
export {
  detectSpring,
  detectUpthrust,
  detectSecondaryTest,
  detectLPS,
  detectLPSY,
  detectSOS,
  detectSOW,
} from "./events";
export { calculateEffortResult } from "./effort-result";
export { isInAccumulation, isInDistribution } from "./cycles";
