import type { NoiseScore, StrategyResult } from "@0xsignal/shared";
interface SignalAnalysisProps {
  signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  confidence: number;
  riskScore: number;
  noise: NoiseScore;
  strategyResult: StrategyResult;
  className?: string;
}
export declare function SignalAnalysis({
  signal,
  confidence,
  riskScore,
  noise,
  strategyResult,
  className,
}: SignalAnalysisProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=signal-analysis.d.ts.map
