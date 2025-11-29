import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Buyback Signals Page - Mobile-first responsive design
import { useState } from "react";
import { cachedBuybackOverview } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { BuybackStats } from "@/features/buyback/components/buyback-stats";
import { BuybackList } from "@/features/buyback/components/buyback-list";
import { CategoryBreakdown } from "@/features/buyback/components/category-breakdown";
import { ProtocolDetailDialog } from "@/features/buyback/components/protocol-detail-dialog";
const fetchBuybackData = () => cachedBuybackOverview();
function BuybackContent({ overview }) {
  const signals = overview.topBuybackProtocols;
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const handleSelectProtocol = (signal) => {
    setSelectedSignal(signal);
    setDialogOpen(true);
  };
  return _jsxs("div", {
    className: "max-w-6xl mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6",
    children: [
      _jsxs("header", {
        children: [
          _jsx("h1", {
            className: "text-lg sm:text-xl font-semibold",
            children: "Protocol Buybacks",
          }),
          _jsx("p", {
            className: "text-[10px] sm:text-xs text-muted-foreground mt-0.5",
            children:
              "Annualized revenue yield relative to market cap \u00B7 Higher yield = stronger buyback potential",
          }),
        ],
      }),
      _jsx(BuybackStats, { overview: overview }),
      _jsxs("div", {
        className: "flex flex-col lg:flex-row gap-4 lg:gap-6",
        children: [
          _jsxs("section", {
            className: "flex-1 min-w-0 lg:max-w-3xl",
            children: [
              _jsxs("div", {
                className: "flex items-baseline justify-between mb-2 sm:mb-3",
                children: [
                  _jsx("h2", { className: "text-sm font-medium", children: "Protocols" }),
                  _jsx("span", {
                    className: "text-[10px] sm:text-xs text-muted-foreground tabular-nums",
                    children: signals.length,
                  }),
                ],
              }),
              signals.length === 0
                ? _jsxs("div", {
                    className: "py-12 text-center border border-dashed rounded-lg",
                    children: [
                      _jsx("p", {
                        className: "text-sm text-muted-foreground",
                        children: "No protocols with buyback data",
                      }),
                      _jsx("p", {
                        className: "text-xs text-muted-foreground mt-1",
                        children: "Revenue data may be temporarily unavailable",
                      }),
                    ],
                  })
                : _jsx(BuybackList, { signals: signals, onSelect: handleSelectProtocol }),
            ],
          }),
          _jsxs("aside", {
            className: "w-full lg:w-64 shrink-0 space-y-4",
            children: [
              _jsx(CategoryBreakdown, { categories: overview.byCategory }),
              _jsxs("div", {
                className: "hidden sm:block p-3 rounded-lg border border-border/40 space-y-2",
                children: [
                  _jsx("h3", { className: "text-xs font-medium", children: "Metrics" }),
                  _jsxs("dl", {
                    className: "text-[10px] text-muted-foreground space-y-1",
                    children: [
                      _jsxs("div", {
                        children: [
                          _jsx("dt", {
                            className: "inline font-medium text-foreground",
                            children: "Yield",
                          }),
                          _jsx("dd", {
                            className: "inline",
                            children: " = (30d Rev \u00D7 12) / MCap",
                          }),
                        ],
                      }),
                      _jsxs("div", {
                        children: [
                          _jsx("dt", {
                            className: "inline font-medium text-foreground",
                            children: "P/Rev",
                          }),
                          _jsx("dd", { className: "inline", children: " = MCap / Annual Rev" }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      _jsx(ProtocolDetailDialog, {
        signal: selectedSignal,
        open: dialogOpen,
        onOpenChange: setDialogOpen,
      }),
    ],
  });
}
export function BuybackSignalsPage() {
  const { data, isLoading, isError } = useEffectQuery(fetchBuybackData, []);
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
            children: "Loading protocol revenue data",
          }),
        ],
      }),
    });
  }
  if (isError || !data) {
    return _jsxs("div", {
      className: "px-4 py-6 max-w-6xl mx-auto",
      children: [
        _jsx("h1", { className: "text-lg font-semibold mb-4", children: "Protocol Buybacks" }),
        _jsxs("div", {
          className: "rounded-lg border border-border bg-muted/30 p-6",
          children: [
            _jsx("p", {
              className: "text-sm text-muted-foreground mb-4",
              children:
                "Unable to fetch protocol revenue data. Check your connection and try again.",
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
  return _jsx(BuybackContent, { overview: data });
}
//# sourceMappingURL=buyback-signals.js.map
