import { Effect } from "effect";
import { AnalysisServiceTag } from "../../../services/analysis";

export const tradingSignalsRoute = () =>
  Effect.gen(function* () {
    const service = yield* AnalysisServiceTag;
    const analyses = yield* service.analyzeTopAssets(20);

    return analyses.map((analysis) => ({
      symbol: analysis.symbol,
      signal: analysis.overallSignal,
      confidence: analysis.confidence,
      riskScore: analysis.riskScore,
      regime: analysis.strategyResult.regime,
      recommendation: analysis.recommendation,
      timestamp: analysis.timestamp,
    }));
  }).pipe(
    Effect.catchTag("AnalysisError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

export const highConfidenceSignalsRoute = (minConfidence: number) =>
  Effect.gen(function* () {
    const service = yield* AnalysisServiceTag;
    const analyses = yield* service.getHighConfidenceSignals(minConfidence);

    return analyses.map((analysis) => ({
      symbol: analysis.symbol,
      signal: analysis.overallSignal,
      confidence: analysis.confidence,
      riskScore: analysis.riskScore,
      regime: analysis.strategyResult.regime,
      recommendation: analysis.recommendation,
      timestamp: analysis.timestamp,
    }));
  }).pipe(
    Effect.catchTag("AnalysisError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );
