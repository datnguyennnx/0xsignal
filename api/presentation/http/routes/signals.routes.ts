import { Effect } from "effect";
import { MarketAnalysisServiceTag } from "../../../domain/services/market-analysis";

/**
 * @openapi
 * /signals:
 *   get:
 *     tags:
 *       - Signals
 *     summary: Get trading signals
 *     description: Returns high confidence trading signals (confidence >= 60%)
 *     responses:
 *       200:
 *         description: List of trading signals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EnhancedAnalysis'
 */
export const tradingSignalsRoute = () =>
  Effect.gen(function* () {
    const service = yield* MarketAnalysisServiceTag;
    const analyses = yield* service.analyzeTopCryptos(50);
    // Return high confidence quant signals
    return analyses.filter((a: any) => a.quantAnalysis?.confidence >= 60);
  });

/**
 * @openapi
 * /signals/high-confidence:
 *   get:
 *     tags:
 *       - Signals
 *     summary: Get high confidence signals
 *     description: Returns trading signals filtered by minimum confidence level
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
 *                 $ref: '#/components/schemas/EnhancedAnalysis'
 */
export const highConfidenceSignalsRoute = (minConfidence: number) =>
  Effect.gen(function* () {
    const service = yield* MarketAnalysisServiceTag;
    return yield* service.getHighConfidenceSignals(minConfidence);
  });
