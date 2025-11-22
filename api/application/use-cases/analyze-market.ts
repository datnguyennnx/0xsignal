import { Effect } from "effect";
import { MarketAnalysisServiceTag } from "../../domain/services/market-analysis";
import { Logger } from "../../infrastructure/logging/logger.service";
import type { AppConfig } from "../../infrastructure/config/app.config";

// Workflow for single analysis run with enhanced quant metrics
export const runAnalysis = (config: AppConfig) =>
  Effect.gen(function* () {
    const logger = yield* Logger;
    
    yield* logger.info("Starting 0xSignal - Quantitative Crypto Analysis");

    // Run enhanced analysis
    const service = yield* MarketAnalysisServiceTag;
    const analyses = yield* service.analyzeTopCryptos(config.symbolsLimit);

    // Display results
    const bubblesDetected = analyses.filter((a) => a.bubbleAnalysis.isBubble);
    const highRisk = analyses.filter((a) => a.combinedRiskScore > 70);
    const strongBuySignals = analyses.filter((a) => a.recommendation === "STRONG_BUY");
    const strongSellSignals = analyses.filter((a) => a.recommendation === "STRONG_SELL");

    yield* logger.info(
      `Results: ${analyses.length} analyzed, ${bubblesDetected.length} bubbles, ${highRisk.length} high-risk`
    );

    yield* logger.info(
      `Signals: ${strongBuySignals.length} STRONG_BUY, ${strongSellSignals.length} STRONG_SELL`
    );

    if (highRisk.length > 0) {
      const topHighRisk = highRisk.slice(0, 5);
      for (const asset of topHighRisk) {
        yield* logger.warn(
          `HIGH RISK ${asset.symbol.toUpperCase()}: risk=${asset.combinedRiskScore} rec=${asset.recommendation}`
        );
      }
    }

    if (strongBuySignals.length > 0) {
      const topBuys = strongBuySignals.slice(0, 3);
      for (const asset of topBuys) {
        yield* logger.info(
          `STRONG BUY ${asset.symbol.toUpperCase()}: confidence=${asset.quantAnalysis.confidence}% risk=${asset.combinedRiskScore}`
        );
      }
    }

    yield* logger.info("Analysis completed");

    return {
      status: "success",
      totalAnalyzed: analyses.length,
      bubblesDetected: bubblesDetected.length,
      highRiskCount: highRisk.length,
      strongBuyCount: strongBuySignals.length,
      strongSellCount: strongSellSignals.length,
      analyses,
    };
  });
