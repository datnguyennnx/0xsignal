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
import {
  WYCKOFF_TYPES,
  SIGNAL_TYPE,
  DETECTION_THRESHOLDS,
  CONFIDENCE,
  TRADE_PARAMS,
} from "../constants";

export { DEFAULT_WYCKOFF_CONFIG };

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
      cycle: WYCKOFF_TYPES.CYCLE.UNKNOWN,
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

    const er = calculateEffortResult(data, i, DETECTION_THRESHOLDS.EFFORT_LOOKBACK);
    if (er && er.divergence !== WYCKOFF_TYPES.DIVERGENCE.NEUTRAL) {
      effortResults.push(er);
    }
  }

  if (climaxes.length === 0) {
    return {
      cycle: WYCKOFF_TYPES.CYCLE.UNKNOWN,
      currentPhase: null,
      tradingRange: null,
      climaxes: [],
      events: [],
      phases: [],
      effortResults: effortResults.slice(-10),
    };
  }

  const lastClimax = climaxes[climaxes.length - 1];
  const isAccumulation = lastClimax.type === WYCKOFF_TYPES.CLIMAX.SC;

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
  const { cycle, currentPhase, tradingRange, events, effortResults } = analysis;

  if (cycle === WYCKOFF_TYPES.CYCLE.UNKNOWN || !tradingRange) return signals;

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const lastDivergence = effortResults.length > 0 ? effortResults[effortResults.length - 1] : null;

  if (isInAccumulation(cycle)) {
    if (currentPhase === WYCKOFF_TYPES.PHASE.C || lastEvent?.type === WYCKOFF_TYPES.EVENT.SPRING) {
      signals.push({
        type: SIGNAL_TYPE.LONG,
        entry: currentPrice,
        stopLoss:
          tradingRange.low -
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.STOP_LOSS_PERCENT,
        takeProfit:
          tradingRange.high +
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.TAKE_PROFIT_MULTIPLIER_LOW,
        reason: "Wyckoff Spring/Test in Accumulation",
        confidence: CONFIDENCE.MEDIUM,
        timestamp: Date.now(),
      });
    }

    if (
      lastEvent?.type === WYCKOFF_TYPES.EVENT.LPS ||
      lastEvent?.type === WYCKOFF_TYPES.EVENT.SOS
    ) {
      signals.push({
        type: SIGNAL_TYPE.LONG,
        entry: currentPrice,
        stopLoss:
          tradingRange.low -
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.STOP_LOSS_PERCENT,
        takeProfit:
          tradingRange.high +
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.TAKE_PROFIT_MULTIPLIER_HIGH,
        reason: "Wyckoff LPS/SOS Signal",
        confidence: CONFIDENCE.HIGH,
        timestamp: Date.now(),
      });
    }

    if (lastDivergence?.divergence === WYCKOFF_TYPES.DIVERGENCE.BULLISH) {
      signals.push({
        type: SIGNAL_TYPE.LONG,
        entry: currentPrice,
        stopLoss:
          tradingRange.low -
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.STOP_LOSS_PERCENT,
        takeProfit:
          tradingRange.high +
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.TAKE_PROFIT_MULTIPLIER_LOW,
        reason: "Bullish Effort vs Result Divergence",
        confidence: CONFIDENCE.MEDIUM,
        timestamp: Date.now(),
      });
    }
  }

  if (isInDistribution(cycle)) {
    if (
      currentPhase === WYCKOFF_TYPES.PHASE.C ||
      lastEvent?.type === WYCKOFF_TYPES.EVENT.UPTHRUST
    ) {
      signals.push({
        type: SIGNAL_TYPE.SHORT,
        entry: currentPrice,
        stopLoss:
          tradingRange.high +
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.STOP_LOSS_PERCENT,
        takeProfit:
          tradingRange.low -
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.TAKE_PROFIT_MULTIPLIER_LOW,
        reason: "Wyckoff Upthrust in Distribution",
        confidence: CONFIDENCE.MEDIUM,
        timestamp: Date.now(),
      });
    }

    if (
      lastEvent?.type === WYCKOFF_TYPES.EVENT.LPSY ||
      lastEvent?.type === WYCKOFF_TYPES.EVENT.SOW
    ) {
      signals.push({
        type: SIGNAL_TYPE.SHORT,
        entry: currentPrice,
        stopLoss:
          tradingRange.high +
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.STOP_LOSS_PERCENT,
        takeProfit:
          tradingRange.low -
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.TAKE_PROFIT_MULTIPLIER_HIGH,
        reason: "Wyckoff LPSY/SOW Signal",
        confidence: CONFIDENCE.HIGH,
        timestamp: Date.now(),
      });
    }

    if (lastDivergence?.divergence === WYCKOFF_TYPES.DIVERGENCE.BEARISH) {
      signals.push({
        type: SIGNAL_TYPE.SHORT,
        entry: currentPrice,
        stopLoss:
          tradingRange.high +
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.STOP_LOSS_PERCENT,
        takeProfit:
          tradingRange.low -
          (tradingRange.high - tradingRange.low) * TRADE_PARAMS.TAKE_PROFIT_MULTIPLIER_LOW,
        reason: "Bearish Effort vs Result Divergence",
        confidence: CONFIDENCE.MEDIUM,
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
