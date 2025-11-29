import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/core/utils/cn";
export function StrategyMetrics({ metrics, className }) {
  if (!metrics || Object.keys(metrics).length === 0) return null;
  return _jsxs("div", {
    className: cn("rounded border border-border/50 p-4", className),
    children: [
      _jsx("div", {
        className: "text-xs text-muted-foreground mb-3 pb-3 border-b border-border/50",
        children: "Strategy Metrics",
      }),
      _jsx("div", {
        className: "grid grid-cols-2 sm:grid-cols-4 gap-4",
        children: Object.entries(metrics).map(([key, value]) =>
          _jsxs(
            "div",
            {
              children: [
                _jsx("div", {
                  className: "text-xs text-muted-foreground mb-1",
                  children: key.replace(/_/g, " "),
                }),
                _jsx("div", {
                  className: "text-sm font-medium tabular-nums",
                  children: typeof value === "number" ? value.toFixed(2) : value,
                }),
              ],
            },
            key
          )
        ),
      }),
    ],
  });
}
//# sourceMappingURL=strategy-metrics.js.map
