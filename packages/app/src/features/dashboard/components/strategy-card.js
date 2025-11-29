import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Strategy Card - pure component
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RegimeBadge } from "./regime-badge";
import { cn } from "@/core/utils/cn";
export function StrategyCard({ strategy, regime, signal, confidence, reasoning, className }) {
  const signalColor =
    signal === "STRONG_BUY" || signal === "BUY"
      ? "text-gain"
      : signal === "STRONG_SELL" || signal === "SELL"
        ? "text-loss"
        : "text-muted-foreground";
  return _jsx(Card, {
    className: cn("border-border/50", className),
    children: _jsxs(CardHeader, {
      className: "p-4 sm:p-6",
      children: [
        _jsxs("div", {
          className: "flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4",
          children: [
            _jsx(CardTitle, { className: "text-sm font-medium", children: "Active Strategy" }),
            _jsx(RegimeBadge, { regime: regime }),
          ],
        }),
        _jsxs("div", {
          className: "space-y-4",
          children: [
            _jsxs("div", {
              className: "flex items-baseline justify-between",
              children: [
                _jsx("span", { className: "text-lg font-semibold", children: strategy }),
                _jsx("span", {
                  className: cn("text-sm font-medium", signalColor),
                  children: signal,
                }),
              ],
            }),
            _jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                _jsx("div", {
                  className: "flex-1 h-1.5 bg-muted rounded-full overflow-hidden",
                  children: _jsx("div", {
                    className: "h-full bg-primary transition-all",
                    style: { width: `${confidence}%` },
                  }),
                }),
                _jsxs("span", {
                  className: "text-xs text-muted-foreground tabular-nums",
                  children: [confidence, "%"],
                }),
              ],
            }),
            _jsx(CardDescription, { className: "text-xs leading-relaxed", children: reasoning }),
          ],
        }),
      ],
    }),
  });
}
//# sourceMappingURL=strategy-card.js.map
