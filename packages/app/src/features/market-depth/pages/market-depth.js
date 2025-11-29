import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Market Depth Page - Mobile-first responsive design
import { useState } from "react";
import { cachedHeatmap, cachedLiquidationHeatmap } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { MarketHeatmapComponent } from "../components/market-heatmap";
import { LiquidationHeatmapComponent } from "../components/liquidation-heatmap";
import { cn } from "@/core/utils/cn";
const DISPLAY_LIMIT = 20;
export function MarketDepthPage() {
  const [activeTab, setActiveTab] = useState("heatmap");
  const [selectedSymbol, setSelectedSymbol] = useState("btc");
  const [showSymbolList, setShowSymbolList] = useState(false);
  // Always fetch heatmap (needed for symbol list in liquidation tab)
  const { data: heatmapData, isLoading } = useEffectQuery(() => cachedHeatmap(100), []);
  // Only fetch liquidation data when tab is active (lazy loading)
  const { data: liquidationData, isLoading: isLiquidationLoading } = useEffectQuery(
    () => cachedLiquidationHeatmap(selectedSymbol),
    [selectedSymbol, activeTab === "liquidation"] // Re-fetch when tab becomes active
  );
  const availableSymbols = heatmapData?.cells
    ? heatmapData.cells.slice(0, DISPLAY_LIMIT).map((cell) => cell.symbol.toLowerCase())
    : [];
  return _jsxs("div", {
    className: "max-w-5xl mx-auto px-4 sm:px-6",
    children: [
      _jsx("header", {
        className: "py-3 border-b border-border/40",
        children: _jsxs("div", {
          className: "flex items-center justify-between",
          children: [
            _jsxs("div", {
              children: [
                _jsx("h1", {
                  className: "text-lg sm:text-xl font-semibold",
                  children: "Market Depth",
                }),
                _jsx("p", {
                  className: "text-[10px] sm:text-xs text-muted-foreground mt-0.5",
                  children:
                    activeTab === "heatmap"
                      ? "Market cap weighted performance by 24h change"
                      : `Liquidation levels for ${selectedSymbol.toUpperCase()} · Long (red) vs Short (green)`,
                }),
              ],
            }),
            _jsxs("div", {
              className: "flex items-center gap-1",
              children: [
                _jsx("button", {
                  onClick: () => setActiveTab("heatmap"),
                  className: cn(
                    "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                    activeTab === "heatmap"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  ),
                  children: "Heatmap",
                }),
                _jsx("button", {
                  onClick: () => setActiveTab("liquidation"),
                  className: cn(
                    "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                    activeTab === "liquidation"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  ),
                  children: "Liquidations",
                }),
              ],
            }),
          ],
        }),
      }),
      _jsx("div", {
        className: "sm:hidden py-2",
        children:
          activeTab === "liquidation" &&
          _jsxs("div", {
            className: "relative",
            children: [
              _jsxs("button", {
                onClick: () => setShowSymbolList(!showSymbolList),
                className:
                  "px-3 py-1.5 text-sm font-medium bg-muted rounded flex items-center gap-1",
                children: [
                  selectedSymbol.toUpperCase(),
                  _jsx("svg", {
                    className: "w-3 h-3",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: _jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M19 9l-7 7-7-7",
                    }),
                  }),
                ],
              }),
              showSymbolList &&
                _jsxs(_Fragment, {
                  children: [
                    _jsx("div", {
                      className: "fixed inset-0 z-40",
                      onClick: () => setShowSymbolList(false),
                    }),
                    _jsx("div", {
                      className:
                        "absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden w-32 max-h-60 overflow-y-auto",
                      children: availableSymbols.map((symbol) =>
                        _jsx(
                          "button",
                          {
                            onClick: () => {
                              setSelectedSymbol(symbol);
                              setShowSymbolList(false);
                            },
                            className: cn(
                              "w-full px-3 py-2 text-left text-sm transition-colors",
                              selectedSymbol === symbol
                                ? "bg-muted font-medium"
                                : "hover:bg-muted/50"
                            ),
                            children: symbol.toUpperCase(),
                          },
                          symbol
                        )
                      ),
                    }),
                  ],
                }),
            ],
          }),
      }),
      _jsx("div", {
        className: "h-[calc(100vh-16rem)] sm:h-[calc(100vh-13rem)] mt-4",
        children:
          activeTab === "heatmap"
            ? _jsx("div", {
                className: "h-full w-full rounded-lg border border-border/40 overflow-hidden",
                children: _jsx(MarketHeatmapComponent, { data: heatmapData, isLoading: isLoading }),
              })
            : _jsxs("div", {
                className: "flex h-full gap-4",
                children: [
                  _jsxs("div", {
                    className:
                      "hidden sm:block w-40 shrink-0 border border-border/40 rounded-lg overflow-y-auto p-3",
                    children: [
                      _jsxs("div", {
                        className:
                          "text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider",
                        children: ["Assets (", availableSymbols.length, ")"],
                      }),
                      _jsx("div", {
                        className: "space-y-0.5",
                        children: availableSymbols.map((symbol) =>
                          _jsx(
                            "button",
                            {
                              onClick: () => setSelectedSymbol(symbol),
                              className: cn(
                                "w-full px-2.5 py-1.5 text-left text-sm rounded transition-colors",
                                selectedSymbol === symbol
                                  ? "bg-foreground text-background font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              ),
                              children: symbol.toUpperCase(),
                            },
                            symbol
                          )
                        ),
                      }),
                    ],
                  }),
                  _jsx("div", {
                    className:
                      "flex-1 h-full min-w-0 rounded-lg border border-border/40 overflow-hidden",
                    children: _jsx(LiquidationHeatmapComponent, {
                      data: liquidationData,
                      isLoading: isLiquidationLoading,
                    }),
                  }),
                ],
              }),
      }),
    ],
  });
}
//# sourceMappingURL=market-depth.js.map
