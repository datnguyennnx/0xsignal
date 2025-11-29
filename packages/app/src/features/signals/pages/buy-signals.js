import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Buy Signals Page - Effect-TS cached queries + pure filtering
import { cachedTopAnalysis } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { getBuySignals } from "@/core/utils/effect-memoization";
import { QueryLoading, QueryError, QueryEmpty } from "@/components/ui/query-state";
import { SignalTable } from "../components/signal-table";
export function AllBuySignals() {
  const { data, isLoading, isError } = useEffectQuery(() => cachedTopAnalysis(100), []);
  if (isLoading)
    return _jsx(QueryLoading, {
      message: "Loading buy signals",
      context: "Analyzing bullish setups",
    });
  if (isError || !data) return _jsx(QueryError, { title: "Long Positions" });
  const buySignals = getBuySignals(data);
  const strongCount = buySignals.filter((s) => s.overallSignal === "STRONG_BUY").length;
  return _jsxs("div", {
    className: "max-w-7xl mx-auto space-y-4 sm:space-y-6 px-4 py-4 sm:px-6 sm:py-6",
    children: [
      _jsxs("header", {
        children: [
          _jsx("h1", { className: "text-lg sm:text-xl font-semibold", children: "Long Positions" }),
          _jsxs("p", {
            className: "text-xs sm:text-sm text-muted-foreground mt-0.5",
            children: [
              buySignals.length,
              " buy signals \u00B7 ",
              strongCount,
              " strong conviction",
            ],
          }),
        ],
      }),
      buySignals.length === 0
        ? _jsx(QueryEmpty, {
            message: "No bullish setups detected. Market may be in a risk-off phase.",
          })
        : _jsx(SignalTable, { signals: buySignals, type: "buy" }),
    ],
  });
}
//# sourceMappingURL=buy-signals.js.map
