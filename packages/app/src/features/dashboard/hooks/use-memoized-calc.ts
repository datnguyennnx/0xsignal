import { useMemo } from "react";
import type { AssetAnalysis } from "@0xsignal/shared";
import { categorizeSignals, categorizeAllSignals } from "@/core/utils/effect-memoization";

export interface SignalStats {
  readonly buySignals: AssetAnalysis[];
  readonly sellSignals: AssetAnalysis[];
  readonly holdSignals: AssetAnalysis[];
}

export interface AllSignalStats extends SignalStats {
  readonly longEntries: AssetAnalysis[];
  readonly shortEntries: AssetAnalysis[];
}

export const useMemoizedSignals = (analyses: AssetAnalysis[]): SignalStats =>
  useMemo(() => categorizeSignals(analyses), [analyses]);

export const useMemoizedAllSignals = (analyses: AssetAnalysis[]): AllSignalStats =>
  useMemo(() => categorizeAllSignals(analyses), [analyses]);
