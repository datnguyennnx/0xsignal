import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/core/utils/cn";
export function BullEntryCard({
  isOptimalEntry,
  strength,
  entryPrice,
  targetPrice,
  stopLoss,
  confidence,
  className,
}) {
  if (!isOptimalEntry) return null;
  const riskReward = ((targetPrice - entryPrice) / (entryPrice - stopLoss)).toFixed(2);
  const upside = (((targetPrice - entryPrice) / entryPrice) * 100).toFixed(1);
  const downside = (((entryPrice - stopLoss) / entryPrice) * 100).toFixed(1);
  const strengthColor =
    strength === "VERY_STRONG" || strength === "STRONG"
      ? "text-gain"
      : strength === "MODERATE"
        ? "text-warn"
        : "text-muted-foreground";
  return _jsxs("div", {
    className: cn("rounded border border-border/50 p-4", className),
    children: [
      _jsxs("div", {
        className: "flex items-center justify-between mb-4 pb-3 border-b border-border/50",
        children: [
          _jsx("span", { className: "text-xs text-muted-foreground", children: "Entry Setup" }),
          _jsx("span", {
            className: cn("text-xs font-medium", strengthColor),
            children: strength.replace(/_/g, " "),
          }),
        ],
      }),
      _jsxs("div", {
        className: "grid grid-cols-3 gap-4 mb-4",
        children: [
          _jsxs("div", {
            children: [
              _jsx("div", { className: "text-xs text-muted-foreground mb-1", children: "Entry" }),
              _jsxs("div", {
                className: "text-sm font-medium tabular-nums",
                children: ["$", entryPrice.toLocaleString()],
              }),
            ],
          }),
          _jsxs("div", {
            children: [
              _jsx("div", { className: "text-xs text-muted-foreground mb-1", children: "Target" }),
              _jsxs("div", {
                className: "text-sm font-medium tabular-nums text-gain",
                children: ["$", targetPrice.toLocaleString()],
              }),
              _jsxs("div", { className: "text-xs text-gain", children: ["+", upside, "%"] }),
            ],
          }),
          _jsxs("div", {
            children: [
              _jsx("div", { className: "text-xs text-muted-foreground mb-1", children: "Stop" }),
              _jsxs("div", {
                className: "text-sm font-medium tabular-nums text-loss",
                children: ["$", stopLoss.toLocaleString()],
              }),
              _jsxs("div", { className: "text-xs text-loss", children: ["-", downside, "%"] }),
            ],
          }),
        ],
      }),
      _jsxs("div", {
        className: "flex items-center justify-between pt-3 border-t border-border/50 text-xs",
        children: [
          _jsxs("span", {
            className: "text-muted-foreground",
            children: ["R:R ", riskReward, ":1"],
          }),
          _jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              _jsx("div", {
                className: "h-1 w-16 bg-muted rounded-full overflow-hidden",
                children: _jsx("div", {
                  className: "h-full bg-gain transition-all",
                  style: { width: `${confidence}%` },
                }),
              }),
              _jsxs("span", {
                className: "text-muted-foreground tabular-nums",
                children: [confidence, "%"],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
//# sourceMappingURL=bull-entry-card.js.map
