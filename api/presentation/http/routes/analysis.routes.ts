import { Effect } from "effect";
import { AnalysisServiceTag } from "../../../services/analysis";

export const topAnalysisRoute = (limit: number) =>
  Effect.gen(function* () {
    const service = yield* AnalysisServiceTag;
    return yield* service.analyzeTopAssets(limit);
  }).pipe(
    Effect.catchTag("AnalysisError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

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

export const marketOverviewRoute = () =>
  Effect.gen(function* () {
    const service = yield* AnalysisServiceTag;
    return yield* service.getMarketOverview();
  }).pipe(
    Effect.catchTag("AnalysisError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );
