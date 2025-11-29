// Signal Categorization - pure function wrapper
// React 19.2 Compiler handles memoization automatically

import type { AssetAnalysis } from "@0xsignal/shared";
import { categorizeSignals } from "@/core/utils/effect-memoization";

export interface SignalStats {
  readonly buySignals: AssetAnalysis[];
  readonly sellSignals: AssetAnalysis[];
  readonly holdSignals: AssetAnalysis[];
}

// Pure function - React Compiler optimizes automatically
export const useMemoizedSignals = (analyses: AssetAnalysis[]): SignalStats =>
  categorizeSignals(analyses);
