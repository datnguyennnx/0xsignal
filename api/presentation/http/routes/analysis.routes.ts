import { Effect } from "effect";
import { AnalysisServiceTag } from "../../../services/analysis";
import { AnalysisError } from "../../../domain/types/errors";

/**
 * @openapi
 * /analysis/top:
 *   get:
 *     tags:
 *       - Analysis
 *     summary: Get top cryptocurrency analysis
 *     description: Returns quantitative analysis for top cryptocurrencies by market cap
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of cryptocurrencies to analyze
 *     responses:
 *       200:
 *         description: Successful analysis
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EnhancedAnalysis'
 */
export const topAnalysisRoute = (limit: number) =>
  Effect.gen(function* () {
    const service = yield* AnalysisServiceTag;
    return yield* service.analyzeTopAssets(limit);
  }).pipe(
    Effect.catchTag("AnalysisError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

/**
 * @openapi
 * /analysis/{symbol}:
 *   get:
 *     tags:
 *       - Analysis
 *     summary: Get analysis for specific cryptocurrency
 *     description: Returns detailed quantitative analysis for a single cryptocurrency
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Cryptocurrency symbol (e.g., bitcoin, ethereum)
 *     responses:
 *       200:
 *         description: Cryptocurrency analysis
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnhancedAnalysis'
 *       404:
 *         description: Symbol not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const symbolAnalysisRoute = (symbol: string) =>
  Effect.gen(function* () {
    const service = yield* AnalysisServiceTag;
    return yield* service.analyzeSymbol(symbol);
  }).pipe(
    Effect.catchTag("AnalysisError", (error) =>
      Effect.fail({
        status: error.symbol ? 404 : 500,
        message: error.message,
      })
    )
  );

/**
 * @openapi
 * /overview:
 *   get:
 *     tags:
 *       - Analysis
 *     summary: Get market overview
 *     description: Returns aggregated market statistics and risk metrics
 *     responses:
 *       200:
 *         description: Market overview data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarketOverview'
 */
export const marketOverviewRoute = () =>
  Effect.gen(function* () {
    const service = yield* AnalysisServiceTag;
    return yield* service.getMarketOverview();
  }).pipe(
    Effect.catchTag("AnalysisError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );
