import { WYCKOFF_TYPES, DETECTION_THRESHOLDS } from "../constants";
import type { SignificanceLevel } from "../constants";

export type WyckoffPhase = (typeof WYCKOFF_TYPES.PHASE)[keyof typeof WYCKOFF_TYPES.PHASE];
export type WyckoffCycle = (typeof WYCKOFF_TYPES.CYCLE)[keyof typeof WYCKOFF_TYPES.CYCLE];
export type ClimaxType = (typeof WYCKOFF_TYPES.CLIMAX)[keyof typeof WYCKOFF_TYPES.CLIMAX];
export type TestType = (typeof WYCKOFF_TYPES.EVENT)[keyof typeof WYCKOFF_TYPES.EVENT];

export interface TradingRange {
  readonly startTime: number;
  readonly endTime: number;
  readonly high: number;
  readonly low: number;
  readonly midpoint: number;
}

export interface Climax {
  readonly type: ClimaxType;
  readonly time: number;
  readonly price: number;
  readonly volume: number;
  readonly index: number;
}

export interface WyckoffEvent {
  readonly type: TestType;
  readonly time: number;
  readonly price: number;
  readonly index: number;
  readonly significance: SignificanceLevel;
}

export interface PhaseMarker {
  readonly phase: WyckoffPhase;
  readonly cycle: WyckoffCycle;
  readonly startTime: number;
  readonly endTime: number;
  readonly startIndex: number;
  readonly endIndex: number;
}

export interface EffortResult {
  readonly time: number;
  readonly effort: number;
  readonly result: number;
  readonly divergence: (typeof WYCKOFF_TYPES.DIVERGENCE)[keyof typeof WYCKOFF_TYPES.DIVERGENCE];
  readonly index: number;
}

export interface WyckoffAnalysis {
  readonly cycle: WyckoffCycle;
  readonly currentPhase: WyckoffPhase | null;
  readonly tradingRange: TradingRange | null;
  readonly climaxes: Climax[];
  readonly events: WyckoffEvent[];
  readonly phases: PhaseMarker[];
  readonly effortResults: EffortResult[];
}

export interface WyckoffConfig {
  volumeLookback: number;
  volumeClimaxMultiplier: number;
  spreadClimaxMultiplier: number;
  springVolThreshold: number;
  minRangeLength: number;
  atrPeriod: number;
}

export const DEFAULT_WYCKOFF_CONFIG: WyckoffConfig = {
  volumeLookback: 20,
  volumeClimaxMultiplier: DETECTION_THRESHOLDS.VOLUME_CLIMAX_MULTIPLIER,
  spreadClimaxMultiplier: DETECTION_THRESHOLDS.SPREAD_CLIMAX_MULTIPLIER,
  springVolThreshold: DETECTION_THRESHOLDS.SPRING_VOL_THRESHOLD,
  minRangeLength: 5,
  atrPeriod: 14,
};
