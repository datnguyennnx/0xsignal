/** Signals Routes */

import { Effect } from "effect";
import { AnalysisServiceTag } from "../../../services/analysis";

const toSignal = (a: any) => ({
  symbol: a.symbol,
  signal: a.overallSignal,
  confidence: a.confidence,
  riskScore: a.riskScore,
  regime: a.strategyResult.regime,
  recommendation: a.recommendation,
  timestamp: a.timestamp,
});

const handleError = (e: { message: string }) => Effect.fail({ status: 500, message: e.message });

export const tradingSignalsRoute = () =>
  Effect.flatMap(AnalysisServiceTag, (s) => s.analyzeTopAssets(20)).pipe(
    Effect.map((analyses) => analyses.map(toSignal)),
    Effect.catchTag("AnalysisError", handleError)
  );

export const highConfidenceSignalsRoute = (minConfidence: number) =>
  Effect.flatMap(AnalysisServiceTag, (s) => s.getHighConfidenceSignals(minConfidence)).pipe(
    Effect.map((analyses) => analyses.map(toSignal)),
    Effect.catchTag("AnalysisError", handleError)
  );
