import { useMemo } from "react";
import type { AssetAnalysis } from "@0xsignal/shared";

interface SignalStats {
  readonly buySignals: AssetAnalysis[];
  readonly sellSignals: AssetAnalysis[];
  readonly holdSignals: AssetAnalysis[];
}

const isBuySignal = (analysis: AssetAnalysis): boolean =>
  analysis.overallSignal === "STRONG_BUY" || analysis.overallSignal === "BUY";

const isSellSignal = (analysis: AssetAnalysis): boolean =>
  analysis.overallSignal === "STRONG_SELL" || analysis.overallSignal === "SELL";

const isHoldSignal = (analysis: AssetAnalysis): boolean => analysis.overallSignal === "HOLD";

export const useMemoizedSignals = (analyses: AssetAnalysis[]): SignalStats =>
  useMemo(
    () => ({
      buySignals: analyses.filter(isBuySignal),
      sellSignals: analyses.filter(isSellSignal),
      holdSignals: analyses.filter(isHoldSignal),
    }),
    [analyses]
  );
