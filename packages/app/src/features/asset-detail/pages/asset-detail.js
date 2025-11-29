import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Asset Detail Page - Mobile-first responsive design
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cachedAnalysis, cachedChartData } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatCurrency, formatPercentChange } from "@/core/utils/formatters";
import { TradingChart } from "@/features/chart/components/trading-chart";
import { CryptoIcon } from "@/components/crypto-icon";
import { SignalAnalysis } from "../components/signal-analysis";
import { ChevronLeft } from "lucide-react";
// Direct single-asset fetch instead of filtering from all assets
const fetchAssetData = (symbol) => cachedAnalysis(symbol);
const INTERVAL_TIMEFRAMES = {
  "15m": "24h",
  "1h": "7d",
  "4h": "1M",
  "1d": "1M",
  "1w": "1y",
};
// Entry Setup Component - Compact for mobile
function EntrySetup({ strength, entryPrice, targetPrice, stopLoss, confidence }) {
  const rr = ((targetPrice - entryPrice) / (entryPrice - stopLoss)).toFixed(1);
  const upside = (((targetPrice - entryPrice) / entryPrice) * 100).toFixed(1);
  const downside = (((entryPrice - stopLoss) / entryPrice) * 100).toFixed(1);
  return _jsx("div", {
    className: "rounded border border-border/50 overflow-hidden",
    children: _jsxs("div", {
      className: "grid grid-cols-3 sm:grid-cols-6 gap-px bg-border/30",
      children: [
        _jsx(Cell, { label: "Entry", value: `$${formatPrice(entryPrice)}` }),
        _jsx(Cell, {
          label: "Target",
          value: `$${formatPrice(targetPrice)}`,
          sub: `+${upside}%`,
          variant: "gain",
        }),
        _jsx(Cell, {
          label: "Stop",
          value: `$${formatPrice(stopLoss)}`,
          sub: `-${downside}%`,
          variant: "loss",
        }),
        _jsx(Cell, { label: "R:R", value: `${rr}:1`, className: "hidden sm:block" }),
        _jsx(Cell, {
          label: "Strength",
          value: strength.replace("_", " "),
          variant: strength === "VERY_STRONG" || strength === "STRONG" ? "gain" : undefined,
          className: "hidden sm:block",
        }),
        _jsx(Cell, { label: "Conf", value: `${confidence}%`, className: "hidden sm:block" }),
      ],
    }),
  });
}
function Cell({ label, value, sub, variant, className }) {
  return _jsxs("div", {
    className: cn("bg-background p-2 sm:p-3", className),
    children: [
      _jsx("div", {
        className:
          "text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5",
        children: label,
      }),
      _jsx("div", {
        className: cn(
          "text-xs sm:text-sm font-medium tabular-nums",
          variant === "gain" && "text-gain",
          variant === "loss" && "text-loss"
        ),
        children: value,
      }),
      sub &&
        _jsx("div", {
          className: cn(
            "text-[9px] sm:text-[10px]",
            variant === "gain" && "text-gain",
            variant === "loss" && "text-loss"
          ),
          children: sub,
        }),
    ],
  });
}
function AssetContent({ asset, symbol }) {
  const navigate = useNavigate();
  const [interval, setInterval] = useState("1h");
  const binanceSymbol = `${symbol.toUpperCase()}USDT`;
  const timeframe = INTERVAL_TIMEFRAMES[interval] || "7d";
  const { data: chartData, isLoading: chartLoading } = useEffectQuery(
    () => cachedChartData(binanceSymbol, interval, timeframe),
    [binanceSymbol, interval, timeframe]
  );
  const price = asset.price;
  const change24h = price?.change24h || 0;
  const strategy = asset.strategyResult;
  const entry = asset.entrySignal;
  return _jsxs("div", {
    className: "px-3 sm:px-6 py-3 sm:py-6 max-w-6xl mx-auto space-y-3 sm:space-y-4",
    children: [
      _jsxs("div", {
        className: "flex items-center gap-3",
        children: [
          _jsx("button", {
            onClick: () => navigate(-1),
            className: "sm:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground",
            children: _jsx(ChevronLeft, { className: "w-5 h-5" }),
          }),
          _jsxs("div", {
            className: "flex items-center gap-2 flex-1 min-w-0",
            children: [
              _jsx(CryptoIcon, { symbol: asset.symbol, size: 24, className: "shrink-0" }),
              _jsxs("div", {
                className: "min-w-0",
                children: [
                  _jsxs("div", {
                    className: "flex items-center gap-2 flex-wrap",
                    children: [
                      _jsx("span", {
                        className: "text-base sm:text-lg font-medium",
                        children: asset.symbol.toUpperCase(),
                      }),
                      _jsxs("span", {
                        className: "text-base sm:text-lg tabular-nums",
                        children: ["$", formatPrice(price?.price || 0)],
                      }),
                      _jsx("span", {
                        className: cn(
                          "text-xs sm:text-sm tabular-nums",
                          change24h > 0
                            ? "text-gain"
                            : change24h < 0
                              ? "text-loss"
                              : "text-muted-foreground"
                        ),
                        children: formatPercentChange(change24h),
                      }),
                    ],
                  }),
                  _jsxs("div", {
                    className:
                      "flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground",
                    children: [
                      _jsxs("span", { children: ["Vol $", formatCurrency(price?.volume24h || 0)] }),
                      _jsx("span", { className: "hidden sm:inline", children: "\u00B7" }),
                      _jsxs("span", {
                        className: "hidden sm:inline",
                        children: ["H $", formatPrice(price?.high24h || 0)],
                      }),
                      _jsx("span", { className: "hidden sm:inline", children: "\u00B7" }),
                      _jsxs("span", {
                        className: "hidden sm:inline",
                        children: ["L $", formatPrice(price?.low24h || 0)],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      strategy &&
        _jsx("div", {
          className: "overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0",
          children: _jsx(SignalAnalysis, {
            signal: asset.overallSignal,
            confidence: asset.confidence,
            riskScore: asset.riskScore,
            noise: asset.noise,
            strategyResult: strategy,
          }),
        }),
      chartData &&
        chartData.length > 0 &&
        _jsx(TradingChart, {
          data: chartData,
          symbol: binanceSymbol,
          interval: interval,
          onIntervalChange: setInterval,
        }),
      !chartLoading &&
        (!chartData || chartData.length === 0) &&
        _jsxs("div", {
          className: "rounded border border-border/50 p-8 text-center",
          children: [
            _jsx("p", {
              className: "text-sm text-muted-foreground",
              children: "Chart data unavailable",
            }),
            _jsxs("p", {
              className: "text-xs text-muted-foreground mt-1",
              children: [
                "Price history for ",
                symbol.toUpperCase(),
                " may not be available on this timeframe",
              ],
            }),
          ],
        }),
      entry?.isOptimalEntry &&
        _jsx(EntrySetup, {
          strength: entry.strength,
          entryPrice: entry.entryPrice,
          targetPrice: entry.targetPrice,
          stopLoss: entry.stopLoss,
          confidence: entry.confidence,
        }),
    ],
  });
}
export function AssetDetail() {
  const { symbol } = useParams();
  const {
    data: asset,
    isLoading,
    isError,
  } = useEffectQuery(() => fetchAssetData(symbol || ""), [symbol]);
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
          _jsxs("p", {
            className: "text-sm text-muted-foreground",
            children: ["Loading ", symbol?.toUpperCase(), " analysis"],
          }),
        ],
      }),
    });
  }
  if (isError || !asset) {
    return _jsxs("div", {
      className: "px-4 py-6 max-w-6xl mx-auto",
      children: [
        _jsx("h1", {
          className: "text-lg font-semibold mb-4",
          children: symbol?.toUpperCase() || "Asset",
        }),
        _jsxs("div", {
          className: "rounded-lg border border-border bg-muted/30 p-6",
          children: [
            _jsx("p", {
              className: "text-sm text-muted-foreground mb-4",
              children: isError
                ? "Unable to fetch asset data. Check your connection and try again."
                : `No analysis available for ${symbol?.toUpperCase()}. This asset may not be tracked.`,
            }),
            _jsx("button", {
              onClick: () => window.location.reload(),
              className:
                "px-4 py-2 text-sm font-medium bg-foreground text-background rounded hover:bg-foreground/90 transition-colors",
              children: isError ? "Retry" : "Go Back",
            }),
          ],
        }),
      ],
    });
  }
  return _jsx(AssetContent, { asset: asset, symbol: symbol || "" });
}
//# sourceMappingURL=asset-detail.js.map
