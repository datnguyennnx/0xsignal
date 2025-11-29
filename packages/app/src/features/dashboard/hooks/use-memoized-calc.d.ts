import type { AssetAnalysis } from "@0xsignal/shared";
export interface SignalStats {
  readonly buySignals: AssetAnalysis[];
  readonly sellSignals: AssetAnalysis[];
  readonly holdSignals: AssetAnalysis[];
}
export declare const useMemoizedSignals: (analyses: AssetAnalysis[]) => SignalStats;
//# sourceMappingURL=use-memoized-calc.d.ts.map
