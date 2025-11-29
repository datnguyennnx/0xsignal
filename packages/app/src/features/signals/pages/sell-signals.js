import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Sell Signals Page - Effect-TS cached queries + pure filtering
import { cachedTopAnalysis } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { getSellSignals } from "@/core/utils/effect-memoization";
import { QueryLoading, QueryError, QueryEmpty } from "@/components/ui/query-state";
import { SignalTable } from "../components/signal-table";
export function AllSellSignals() {
  const { data, isLoading, isError } = useEffectQuery(() => cachedTopAnalysis(100), []);
  if (isLoading)
    return _jsx(QueryLoading, {
      message: "Loading sell signals",
      context: "Analyzing bearish setups",
    });
  if (isError || !data) return _jsx(QueryError, { title: "Short Positions" });
  const sellSignals = getSellSignals(data);
  const strongCount = sellSignals.filter((s) => s.overallSignal === "STRONG_SELL").length;
  return _jsxs("div", {
    className: "max-w-7xl mx-auto space-y-4 sm:space-y-6 px-4 py-4 sm:px-6 sm:py-6",
    children: [
      _jsxs("header", {
        children: [
          _jsx("h1", {
            className: "text-lg sm:text-xl font-semibold",
            children: "Short Positions",
          }),
          _jsxs("p", {
            className: "text-xs sm:text-sm text-muted-foreground mt-0.5",
            children: [
              sellSignals.length,
              " sell signals \u00B7 ",
              strongCount,
              " strong conviction",
            ],
          }),
        ],
      }),
      sellSignals.length === 0
        ? _jsx(QueryEmpty, {
            message: "No bearish setups detected. Market may be in a risk-on phase.",
          })
        : _jsx(SignalTable, { signals: sellSignals, type: "sell" }),
    ],
  });
}
//# sourceMappingURL=sell-signals.js.map
