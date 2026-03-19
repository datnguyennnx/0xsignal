import { SIGNAL_TYPE } from "../constants";

export interface PatternAnalysis {
  signals: TradingSignal[];
  metadata: Record<string, unknown>;
}

export interface TradingSignal {
  type: (typeof SIGNAL_TYPE)[keyof typeof SIGNAL_TYPE];
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
  confidence: number;
  timestamp: number;
}

export type PatternName = "ict" | "wyckoff";

export interface PatternConfig {
  enabled: boolean;
}

export interface ICTConfigInput {
  swingLookback?: number;
  fvgMinSize?: number;
  obLookback?: number;
  liquidityTolerance?: number;
  atrPeriod?: number;
}

export interface WyckoffConfigInput {
  volumeLookback?: number;
  volumeClimaxMultiplier?: number;
  spreadClimaxMultiplier?: number;
  springVolThreshold?: number;
  minRangeLength?: number;
  atrPeriod?: number;
}
