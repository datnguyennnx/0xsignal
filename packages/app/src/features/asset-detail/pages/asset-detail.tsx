/**
 * Asset Detail Page - Minimalist quant-focused design
 * Single unified signal card, clean layout, high signal density
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { cachedAnalysis, cachedChartData } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatCurrency, formatPercentChange } from "@/core/utils/formatters";
import { TradingChart } from "@/features/chart/components/trading-chart";
import { CryptoIcon } from "@/components/crypto-icon";
import { UnifiedSignalCard } from "../components/unified-signal-card";
import { ChevronLeft } from "lucide-react";

const fetchAssetData = (symbol: string) => cachedAnalysis(symbol);

const INTERVAL_TIMEFRAMES: Record<string, string> = {
  "15m": "24h",
  "1h": "7d",
  "4h": "1M",
  "1d": "1M",
  "1w": "1y",
};

function AssetContent({ asset, symbol }: { asset: AssetAnalysis; symbol: string }) {
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

  return (
    <div className="px-3 sm:px-6 py-3 sm:py-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header - Compact */}
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="sm:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CryptoIcon symbol={asset.symbol} size={24} className="shrink-0" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-medium">{asset.symbol.toUpperCase()}</span>
              <span className="text-base sm:text-lg tabular-nums">
                ${formatPrice(price?.price || 0)}
              </span>
              <span
                className={cn(
                  "text-xs sm:text-sm tabular-nums",
                  change24h > 0
                    ? "text-gain"
                    : change24h < 0
                      ? "text-loss"
                      : "text-muted-foreground"
                )}
              >
                {formatPercentChange(change24h)}
              </span>
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">
              Vol ${formatCurrency(price?.volume24h || 0)}
              <span className="hidden sm:inline">
                {" · "}H ${formatPrice(price?.high24h || 0)}
                {" · "}L ${formatPrice(price?.low24h || 0)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Unified Signal Card - Single component for all signal data */}
      <UnifiedSignalCard analysis={asset} />

      {/* Chart */}
      {chartData && chartData.length > 0 ? (
        <TradingChart
          data={chartData}
          symbol={binanceSymbol}
          interval={interval}
          onIntervalChange={setInterval}
        />
      ) : !chartLoading ? (
        <div className="rounded border border-border/50 p-6 sm:p-8 text-center">
          <p className="text-sm text-muted-foreground">Chart data unavailable</p>
        </div>
      ) : null}
    </div>
  );
}

export function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const {
    data: asset,
    isLoading,
    isError,
  } = useEffectQuery(() => fetchAssetData(symbol || ""), [symbol]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground">Loading {symbol?.toUpperCase()}</p>
        </div>
      </div>
    );
  }

  if (isError || !asset) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <div className="rounded border border-border/50 p-6">
          <p className="text-sm text-muted-foreground mb-4">
            {isError ? "Unable to load data." : `No data for ${symbol?.toUpperCase()}.`}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded hover:bg-foreground/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <AssetContent asset={asset} symbol={symbol || ""} />;
}
