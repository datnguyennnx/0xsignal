import type { AssetAnalysis } from "@/core/types";

const analysisStore = new Map<string, { data: AssetAnalysis; timestamp: number }>();
const STORE_TTL = 10 * 60 * 1000; // 10 minutes

export const hydrateAnalysisFromList = (analyses: AssetAnalysis[]) => {
  const now = Date.now();
  analyses.forEach((analysis) => {
    analysisStore.set(analysis.symbol.toLowerCase(), { data: analysis, timestamp: now });
  });
};

export const getHydratedAnalysis = (symbol: string): AssetAnalysis | null => {
  const entry = analysisStore.get(symbol.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > STORE_TTL) {
    analysisStore.delete(symbol.toLowerCase());
    return null;
  }
  return entry.data;
};

export const clearAnalysisStore = () => {
  analysisStore.clear();
};
