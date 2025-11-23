import { Effect, Schedule, Duration } from "effect";
import { MarketAnalysisServiceTag } from "../../domain/services/market-analysis";
import { Logger } from "../../infrastructure/logging/logger.service";
import type { AppConfig } from "../../infrastructure/config/app.config";

// Workflow for continuous monitoring with quant analysis
export const runMonitoring = (config: AppConfig) =>
  Effect.gen(function* () {
    const logger = yield* Logger;
    const service = yield* MarketAnalysisServiceTag;

    yield* logger.info("Starting Continuous Quantitative Monitoring");
    yield* logger.info(
      `Config: interval=${config.monitoringInterval}min, limit=${config.symbolsLimit}`
    );

    // Create monitoring cycle
    const monitoringCycle = Effect.gen(function* () {
      const overview = yield* service.getMarketOverview();

      yield* logger.info(
        `Market: ${overview.totalAnalyzed} analyzed, ${overview.bubblesDetected} bubbles, ${overview.highRiskAssets.length} high-risk, avg risk=${overview.averageRiskScore}`
      );

      // Get high confidence signals
      const signals = yield* service.getHighConfidenceSignals(70);
      if (signals.length > 0) {
        yield* logger.info(`High confidence signals: ${signals.length}`);

        const buySignals = signals.filter(
          (s) => s.recommendation === "STRONG_BUY" || s.recommendation === "BUY"
        );
        const sellSignals = signals.filter(
          (s) => s.recommendation === "STRONG_SELL" || s.recommendation === "SELL"
        );

        if (buySignals.length > 0) {
          yield* logger.info(`Buy opportunities: ${buySignals.map((s) => s.symbol).join(", ")}`);
        }
        if (sellSignals.length > 0) {
          yield* logger.warn(`Sell warnings: ${sellSignals.map((s) => s.symbol).join(", ")}`);
        }
      }
    });

    // Run on schedule
    const schedule = Schedule.fixed(Duration.minutes(config.monitoringInterval));

    yield* monitoringCycle.pipe(
      Effect.repeat(schedule),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* logger.error(`Monitoring error: ${error}`);
          return yield* Effect.void;
        })
      )
    );

    return {
      status: "monitoring",
      message: "Continuous monitoring started",
    };
  });
