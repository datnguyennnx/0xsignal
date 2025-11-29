/** Analysis Routes */

import { Effect } from "effect";
import { AnalysisServiceTag } from "../../../services/analysis";

const handleError = (e: { message: string; symbol?: string }) =>
  Effect.fail({ status: e.symbol ? 404 : 500, message: e.message });

export const topAnalysisRoute = (limit: number) =>
  Effect.flatMap(AnalysisServiceTag, (s) => s.analyzeTopAssets(limit)).pipe(
    Effect.catchTag("AnalysisError", handleError)
  );

export const symbolAnalysisRoute = (symbol: string) =>
  Effect.flatMap(AnalysisServiceTag, (s) => s.analyzeSymbol(symbol)).pipe(
    Effect.catchTag("AnalysisError", handleError)
  );

export const marketOverviewRoute = () =>
  Effect.flatMap(AnalysisServiceTag, (s) => s.getMarketOverview()).pipe(
    Effect.catchTag("AnalysisError", handleError)
  );
