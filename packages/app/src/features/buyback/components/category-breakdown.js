import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/core/utils/cn";
export function CategoryBreakdown({ categories }) {
  const sorted = Object.values(categories)
    .filter((c) => c.averageBuybackRate > 0.1)
    .sort((a, b) => b.averageBuybackRate - a.averageBuybackRate)
    .slice(0, 6);
  if (sorted.length === 0) return null;
  const maxRate = Math.max(...sorted.map((c) => c.averageBuybackRate));
  const highYieldCategories = sorted.filter((c) => c.averageBuybackRate >= 10).length;
  return _jsxs("div", {
    className: "space-y-3",
    children: [
      _jsxs("div", {
        className: "flex items-baseline justify-between",
        children: [
          _jsx("h3", { className: "text-sm font-medium", children: "By Category" }),
          _jsxs("span", {
            className: "text-[10px] text-muted-foreground",
            children: [highYieldCategories, " high yield"],
          }),
        ],
      }),
      _jsx("div", {
        className: "space-y-2.5",
        children: sorted.map((cat) => {
          const width = (cat.averageBuybackRate / maxRate) * 100;
          const isHighYield = cat.averageBuybackRate >= 10;
          return _jsxs(
            "div",
            {
              className: "space-y-1",
              children: [
                _jsxs("div", {
                  className: "flex items-center justify-between text-xs",
                  children: [
                    _jsx("span", {
                      className: "text-muted-foreground truncate max-w-[140px]",
                      children: cat.category,
                    }),
                    _jsxs("span", {
                      className: cn("tabular-nums font-medium", isHighYield && "text-gain"),
                      children: [cat.averageBuybackRate.toFixed(1), "%"],
                    }),
                  ],
                }),
                _jsx("div", {
                  className: "h-1 bg-muted rounded-full overflow-hidden",
                  children: _jsx("div", {
                    className: cn(
                      "h-full rounded-full transition-all",
                      isHighYield ? "bg-gain" : "bg-foreground/40"
                    ),
                    style: { width: `${width}%` },
                  }),
                }),
              ],
            },
            cat.category
          );
        }),
      }),
      _jsx("p", {
        className: "text-[10px] text-muted-foreground pt-1",
        children: "Average annualized yield by protocol category",
      }),
    ],
  });
}
//# sourceMappingURL=category-breakdown.js.map
