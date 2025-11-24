import { useMemo } from "react";
import type { EnhancedAnalysis } from "@0xsignal/shared";

interface SignalStats {
  buySignals: EnhancedAnalysis[];
  sellSignals: EnhancedAnalysis[];
}

const isBuySignal = (analysis: EnhancedAnalysis): boolean => {
  return analysis.overallSignal === "STRONG_BUY" || analysis.overallSignal === "BUY";
};

const isSellSignal = (analysis: EnhancedAnalysis): boolean => {
  return analysis.overallSignal === "STRONG_SELL" || analysis.overallSignal === "SELL";
};

export const useMemoizedSignals = (analyses: EnhancedAnalysis[]): SignalStats => {
  return useMemo(() => {
    const buySignals = analyses.filter(isBuySignal);
    const sellSignals = analyses.filter(isSellSignal);

    return {
      buySignals,
      sellSignals,
    };
  }, [analyses]);
};
