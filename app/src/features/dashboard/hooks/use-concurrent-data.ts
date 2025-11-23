import { Effect } from "effect";
import { getTopAnalysis, getOverview } from "@/core/api/queries";
import { useEffect_ } from "@/core/runtime/use-effect";
import type { EnhancedAnalysis } from "@0xsignal/shared";

interface DashboardData {
  analyses: EnhancedAnalysis[];
  overview: any;
}

const fetchConcurrentData = () =>
  Effect.gen(function* () {
    const [analyses, overview] = yield* Effect.all([getTopAnalysis(50), getOverview()], {
      concurrency: "unbounded",
    });

    return { analyses, overview };
  });

export const useConcurrentDashboardData = () => {
  return useEffect_<DashboardData>(fetchConcurrentData, []);
};
