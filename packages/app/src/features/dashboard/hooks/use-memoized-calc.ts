import type { AssetAnalysis } from "@0xsignal/shared";
import { categorizeSignals, categorizeAllSignals } from "@/core/utils/effect-memoization";

export interface SignalStats {
  readonly buySignals: AssetAnalysis[];
  readonly sellSignals: AssetAnalysis[];
  readonly holdSignals: AssetAnalysis[];
}

export interface AllSignalStats extends SignalStats {
  readonly crashWarnings: AssetAnalysis[];
  readonly longEntries: AssetAnalysis[];
  readonly shortEntries: AssetAnalysis[];
}

export const useMemoizedSignals = (analyses: AssetAnalysis[]): SignalStats =>
  categorizeSignals(analyses);

export const useMemoizedAllSignals = (analyses: AssetAnalysis[]): AllSignalStats =>
  categorizeAllSignals(analyses);
