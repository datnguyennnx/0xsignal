import { Effect } from "effect";
import { AnalysisServiceTag } from "../../../services/analysis";

/**
 * @openapi
 * /signals:
 *   get:
 *     tags:
 *       - Signals
 *     summary: Get trading signals
 *     description: Returns trading signals for top cryptocurrencies
 *     responses:
 *       200:
 *         description: Trading signals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TradingSignal'
 */
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

/**
 * @openapi
 * /signals/high-confidence:
 *   get:
 *     tags:
 *       - Signals
 *     summary: Get high confidence trading signals
 *     description: Returns only signals with confidence above threshold
 *     parameters:
 *       - in: query
 *         name: confidence
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 100
 *           default: 70
 *         description: Minimum confidence threshold
 *     responses:
 *       200:
 *         description: High confidence signals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TradingSignal'
 */
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
