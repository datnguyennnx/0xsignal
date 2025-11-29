// Signal Categorization - pure function wrapper
// React 19.2 Compiler handles memoization automatically

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

// Pure function - React Compiler optimizes automatically
export const useMemoizedSignals = (analyses: AssetAnalysis[]): SignalStats =>
  categorizeSignals(analyses);

// Extended version with crash and entry signals
export const useMemoizedAllSignals = (analyses: AssetAnalysis[]): AllSignalStats =>
  categorizeAllSignals(analyses);
