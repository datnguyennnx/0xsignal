import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cachedTopAnalysis } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { SignalCard } from "@/features/dashboard/components/signal-card";
import { HoldCard } from "@/features/dashboard/components/hold-card";
import { useMemoizedSignals } from "@/features/dashboard/hooks/use-memoized-calc";
const fetchDashboardData = () => cachedTopAnalysis(100);
function DashboardContent({ analyses }) {
  const { buySignals, sellSignals, holdSignals } = useMemoizedSignals(analyses);
  // Pre-compute stats once - React Compiler will optimize
  const stats = {
    total: buySignals.length + sellSignals.length,
    strongBuys: buySignals.filter((s) => s.overallSignal === "STRONG_BUY").length,
    strongSells: sellSignals.filter((s) => s.overallSignal === "STRONG_SELL").length,
  };
  return _jsxs("div", {
    className: "px-4 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto",
    children: [
      _jsxs("div", {
        className: "flex items-baseline justify-between mb-4 sm:mb-6",
        children: [
          _jsxs("div", {
            children: [
              _jsx("h1", {
                className: "text-base sm:text-lg font-medium",
                children: "Trading Signals",
              }),
              _jsxs("p", {
                className: "text-[10px] sm:text-xs text-muted-foreground mt-0.5",
                children: [
                  stats.total,
                  " active \u00B7 ",
                  stats.strongBuys + stats.strongSells,
                  " strong",
                ],
              }),
            ],
          }),
          _jsxs("div", {
            className: "text-[10px] sm:text-xs text-muted-foreground tabular-nums",
            children: [
              _jsxs("span", { className: "text-gain", children: [buySignals.length, " long"] }),
              _jsx("span", { className: "mx-1", children: "\u00B7" }),
              _jsxs("span", { className: "text-loss", children: [sellSignals.length, " short"] }),
            ],
          }),
        ],
      }),
      holdSignals.length > 0 &&
        _jsxs("div", {
          className: "pb-4 mb-4 sm:pb-6 sm:mb-6 border-b border-border/20",
          children: [
            _jsx("div", {
              className: "flex items-center gap-2 mb-2",
              children: _jsxs(Link, {
                to: "/hold",
                className:
                  "text-[10px] sm:text-xs text-muted-foreground/60 hover:text-muted-foreground",
                children: ["Hold (", holdSignals.length, ")"],
              }),
            }),
            _jsxs("div", {
              className:
                "flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide",
              children: [
                holdSignals
                  .slice(0, 20)
                  .map((signal) => _jsx(HoldCard, { signal: signal }, signal.symbol)),
                holdSignals.length > 20 &&
                  _jsxs(Link, {
                    to: "/hold",
                    className:
                      "flex items-center text-[10px] text-muted-foreground hover:text-foreground whitespace-nowrap px-2",
                    children: ["+", holdSignals.length - 20],
                  }),
              ],
            }),
          ],
        }),
      _jsxs("div", {
        className: "space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0",
        children: [
          _jsxs("section", {
            children: [
              _jsxs("div", {
                className: "flex items-center justify-between pb-2 mb-3 border-b border-border/50",
                children: [
                  _jsxs("div", {
                    className: "flex items-center gap-2",
                    children: [
                      _jsx("h2", { className: "text-sm font-medium", children: "Long" }),
                      _jsx("span", {
                        className: "text-[10px] sm:text-xs text-muted-foreground tabular-nums",
                        children: buySignals.length,
                      }),
                    ],
                  }),
                  buySignals.length > 5 &&
                    _jsxs(Link, {
                      to: "/buy",
                      className:
                        "flex items-center text-[10px] sm:text-xs text-muted-foreground hover:text-foreground",
                      children: ["All ", _jsx(ChevronRight, { className: "w-3 h-3" })],
                    }),
                ],
              }),
              buySignals.length === 0
                ? _jsx("div", {
                    className: "py-8 text-center text-xs text-muted-foreground",
                    children: "No buy signals detected in current market conditions",
                  })
                : _jsx("div", {
                    className: "space-y-1.5 sm:space-y-2",
                    children: buySignals
                      .slice(0, 8)
                      .map((signal, i) =>
                        _jsx(
                          "div",
                          {
                            className: i >= 5 ? "hidden sm:block" : "",
                            children: _jsx(SignalCard, { signal: signal, type: "buy" }),
                          },
                          signal.symbol
                        )
                      ),
                  }),
            ],
          }),
          _jsxs("section", {
            children: [
              _jsxs("div", {
                className: "flex items-center justify-between pb-2 mb-3 border-b border-border/50",
                children: [
                  _jsxs("div", {
                    className: "flex items-center gap-2",
                    children: [
                      _jsx("h2", { className: "text-sm font-medium", children: "Short" }),
                      _jsx("span", {
                        className: "text-[10px] sm:text-xs text-muted-foreground tabular-nums",
                        children: sellSignals.length,
                      }),
                    ],
                  }),
                  sellSignals.length > 5 &&
                    _jsxs(Link, {
                      to: "/sell",
                      className:
                        "flex items-center text-[10px] sm:text-xs text-muted-foreground hover:text-foreground",
                      children: ["All ", _jsx(ChevronRight, { className: "w-3 h-3" })],
                    }),
                ],
              }),
              sellSignals.length === 0
                ? _jsx("div", {
                    className: "py-8 text-center text-xs text-muted-foreground",
                    children: "No sell signals detected in current market conditions",
                  })
                : _jsx("div", {
                    className: "space-y-1.5 sm:space-y-2",
                    children: sellSignals
                      .slice(0, 8)
                      .map((signal, i) =>
                        _jsx(
                          "div",
                          {
                            className: i >= 5 ? "hidden sm:block" : "",
                            children: _jsx(SignalCard, { signal: signal, type: "sell" }),
                          },
                          signal.symbol
                        )
                      ),
                  }),
            ],
          }),
        ],
      }),
    ],
  });
}
export function MarketDashboard() {
  const { data, isLoading, isError } = useEffectQuery(fetchDashboardData, []);
  if (isLoading) {
    return _jsx("div", {
      className: "flex items-center justify-center min-h-[50vh]",
      children: _jsxs("div", {
        className: "text-center space-y-2",
        children: [
          _jsx("div", {
            className:
              "h-6 w-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto",
          }),
          _jsx("p", {
            className: "text-sm text-muted-foreground",
            children: "Analyzing market signals",
          }),
        ],
      }),
    });
  }
  if (isError || !data) {
    return _jsxs("div", {
      className: "px-4 py-6 max-w-7xl mx-auto",
      children: [
        _jsx("h1", { className: "text-base font-medium mb-4", children: "Trading Signals" }),
        _jsxs("div", {
          className: "rounded-lg border border-border bg-muted/30 p-6",
          children: [
            _jsx("p", {
              className: "text-sm text-muted-foreground mb-4",
              children: "Unable to fetch market data. Check your connection and try again.",
            }),
            _jsx("button", {
              onClick: () => window.location.reload(),
              className:
                "px-4 py-2 text-sm font-medium bg-foreground text-background rounded hover:bg-foreground/90 transition-colors",
              children: "Retry",
            }),
          ],
        }),
      ],
    });
  }
  return _jsx(DashboardContent, { analyses: data });
}
//# sourceMappingURL=market-dashboard.js.map
