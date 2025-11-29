import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatCurrency } from "@/core/utils/formatters";
import { cn } from "@/core/utils/cn";
export function BuybackStats({ overview }) {
  const signals = overview.topBuybackProtocols;
  const highYieldCount = signals.filter((s) => s.annualizedBuybackRate >= 15).length;
  const totalMcap = signals.reduce((sum, s) => sum + s.marketCap, 0);
  const avgYield = overview.averageBuybackRate;
  return _jsxs("div", {
    className: "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4",
    children: [
      _jsxs("div", {
        className: "p-3 rounded-lg border border-border/40 sm:p-4",
        children: [
          _jsx("div", { className: "text-xs text-muted-foreground", children: "24h Revenue" }),
          _jsxs("div", {
            className: "text-lg font-semibold tabular-nums mt-1 sm:text-xl",
            children: ["$", formatCurrency(overview.totalRevenue24h)],
          }),
          _jsx("div", {
            className: "text-[10px] text-muted-foreground mt-0.5",
            children: "Aggregate protocol fees",
          }),
        ],
      }),
      _jsxs("div", {
        className: "p-3 rounded-lg border border-border/40 sm:p-4",
        children: [
          _jsx("div", { className: "text-xs text-muted-foreground", children: "Avg Yield" }),
          _jsxs("div", {
            className: cn(
              "text-lg font-semibold tabular-nums mt-1 sm:text-xl",
              avgYield >= 10 && "text-gain"
            ),
            children: [avgYield.toFixed(1), "%"],
          }),
          _jsx("div", {
            className: "text-[10px] text-muted-foreground mt-0.5",
            children: "Annualized buyback rate",
          }),
        ],
      }),
      _jsxs("div", {
        className: "p-3 rounded-lg border border-border/40 sm:p-4",
        children: [
          _jsx("div", { className: "text-xs text-muted-foreground", children: "Protocols" }),
          _jsx("div", {
            className: "text-lg font-semibold tabular-nums mt-1 sm:text-xl",
            children: overview.totalProtocols,
          }),
          _jsxs("div", {
            className: "text-[10px] text-muted-foreground mt-0.5",
            children: [
              _jsx("span", { className: "text-gain", children: highYieldCount }),
              " with yield \u226515%",
            ],
          }),
        ],
      }),
      _jsxs("div", {
        className: "p-3 rounded-lg border border-border/40 sm:p-4",
        children: [
          _jsx("div", { className: "text-xs text-muted-foreground", children: "Total MCap" }),
          _jsxs("div", {
            className: "text-lg font-semibold tabular-nums mt-1 sm:text-xl",
            children: ["$", formatCurrency(totalMcap)],
          }),
          _jsx("div", {
            className: "text-[10px] text-muted-foreground mt-0.5",
            children: "Combined market cap",
          }),
        ],
      }),
    ],
  });
}
//# sourceMappingURL=buyback-stats.js.map
