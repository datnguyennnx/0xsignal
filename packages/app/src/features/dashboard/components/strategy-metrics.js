import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/core/utils/cn";
export function StrategyMetrics({ metrics, className }) {
  const formatMetricName = (key) => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };
  const formatMetricValue = (value) => {
    if (Math.abs(value) < 0.01) return value.toFixed(4);
    if (Math.abs(value) < 1) return value.toFixed(3);
    if (Math.abs(value) < 100) return value.toFixed(2);
    return value.toFixed(0);
  };
  const entries = Object.entries(metrics);
  if (entries.length === 0) return null;
  return _jsx(Card, {
    className: cn("border-border/50", className),
    children: _jsxs(CardHeader, {
      className: "p-4 sm:p-6",
      children: [
        _jsx(CardTitle, { className: "text-sm font-medium mb-4", children: "Strategy Metrics" }),
        _jsx("div", {
          className: "grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm",
          children: entries.map(([key, value]) =>
            _jsxs(
              "div",
              {
                className: "space-y-1",
                children: [
                  _jsx("div", {
                    className: "text-xs text-muted-foreground",
                    children: formatMetricName(key),
                  }),
                  _jsx("div", {
                    className: "font-medium tabular-nums",
                    children: formatMetricValue(value),
                  }),
                ],
              },
              key
            )
          ),
        }),
      ],
    }),
  });
}
//# sourceMappingURL=strategy-metrics.js.map
