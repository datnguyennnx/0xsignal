import { useMemo } from "react";
import type { EnhancedAnalysis } from "@0xsignal/shared";

interface SignalStats {
  buySignals: EnhancedAnalysis[];
  sellSignals: EnhancedAnalysis[];
  crashAlerts: EnhancedAnalysis[];
  topBuy: EnhancedAnalysis[];
  topSell: EnhancedAnalysis[];
}

const isBuySignal = (analysis: EnhancedAnalysis): boolean => {
  const signal = analysis.strategyAnalysis?.overallSignal || analysis.quantAnalysis?.overallSignal;
  return signal === "STRONG_BUY" || signal === "BUY";
};

const isSellSignal = (analysis: EnhancedAnalysis): boolean => {
  const signal = analysis.strategyAnalysis?.overallSignal || analysis.quantAnalysis?.overallSignal;
  return signal === "STRONG_SELL" || signal === "SELL";
};

const isCrashAlert = (analysis: EnhancedAnalysis): boolean => {
  return analysis.strategyAnalysis?.crashSignal?.isCrashing ?? false;
};

export const useMemoizedSignals = (analyses: EnhancedAnalysis[]): SignalStats => {
  return useMemo(() => {
    const buySignals = analyses.filter(isBuySignal);
    const sellSignals = analyses.filter(isSellSignal);
    const crashAlerts = analyses.filter(isCrashAlert);

    return {
      buySignals,
      sellSignals,
      crashAlerts,
      topBuy: buySignals.slice(0, 10),
      topSell: sellSignals.slice(0, 10),
    };
  }, [analyses]);
};
