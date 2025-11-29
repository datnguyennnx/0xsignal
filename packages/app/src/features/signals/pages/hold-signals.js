import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Hold Signals Page - Effect-TS cached queries + pure filtering
import { cachedTopAnalysis } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { getHoldSignals } from "@/core/utils/effect-memoization";
import { QueryLoading, QueryError, QueryEmpty } from "@/components/ui/query-state";
import { SignalTable } from "../components/signal-table";
export function AllHoldSignals() {
  const { data, isLoading, isError } = useEffectQuery(() => cachedTopAnalysis(100), []);
  if (isLoading)
    return _jsx(QueryLoading, {
      message: "Loading hold signals",
      context: "Analyzing neutral positions",
    });
  if (isError || !data) return _jsx(QueryError, { title: "Neutral Positions" });
  const holdSignals = getHoldSignals(data);
  const highNoiseCount = holdSignals.filter((s) => (s.noise?.value ?? 0) > 60).length;
  return _jsxs("div", {
    className: "max-w-7xl mx-auto space-y-4 sm:space-y-6 px-4 py-4 sm:px-6 sm:py-6",
    children: [
      _jsxs("header", {
        children: [
          _jsx("h1", {
            className: "text-lg sm:text-xl font-semibold text-muted-foreground",
            children: "Neutral Positions",
          }),
          _jsxs("p", {
            className: "text-xs sm:text-sm text-muted-foreground mt-0.5",
            children: [
              holdSignals.length,
              " assets with no clear directional bias \u00B7 ",
              highNoiseCount,
              " high noise",
            ],
          }),
        ],
      }),
      holdSignals.length === 0
        ? _jsx(QueryEmpty, {
            message: "All assets have directional signals. No neutral positions detected.",
          })
        : _jsx(SignalTable, { signals: holdSignals, type: "hold" }),
    ],
  });
}
//# sourceMappingURL=hold-signals.js.map
