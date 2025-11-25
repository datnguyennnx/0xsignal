import { Effect } from "effect";
import type { AssetAnalysis, MarketOverview } from "@0xsignal/shared";
import { getTopAnalysis, getOverview } from "@/core/api/queries";
import { useEffect_ } from "@/core/runtime/use-effect";

export interface DashboardData {
  readonly analyses: AssetAnalysis[];
  readonly overview: MarketOverview;
}

const fetchConcurrentData = () =>
  Effect.gen(function* () {
    const [analyses, overview] = yield* Effect.all([getTopAnalysis(50), getOverview()], {
      concurrency: "unbounded",
    });

    return { analyses, overview };
  });

export const useConcurrentDashboardData = () => useEffect_(fetchConcurrentData, []);
