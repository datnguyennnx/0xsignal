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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
    <div className="px-3 sm:px-6 py-3 sm:py-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(-1)}
          className="sm:hidden -ml-2"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <CryptoIcon symbol={asset.symbol} size={28} className="shrink-0" />
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="text-lg sm:text-xl font-semibold tracking-tight">
              {asset.symbol.toUpperCase()}
            </span>
            <span className="text-lg sm:text-xl tabular-nums">
              ${formatPrice(price?.price || 0)}
            </span>
            <span
              className={cn(
                "text-sm tabular-nums font-medium",
                change24h > 0 ? "text-gain" : change24h < 0 ? "text-loss" : "text-muted-foreground"
              )}
            >
              {formatPercentChange(change24h)}
            </span>
            <span className="text-xs text-muted-foreground">
              Vol ${formatCurrency(price?.volume24h || 0)}
              <span className="hidden sm:inline">
                {" · "}H ${formatPrice(price?.high24h || 0)}
                {" · "}L ${formatPrice(price?.low24h || 0)}
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* Unified Signal Card */}
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
        <Card className="py-0 shadow-none">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Chart data unavailable</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// Loading skeleton
function AssetDetailSkeleton({ symbol }: { symbol?: string }) {
  return (
    <div className="px-3 sm:px-6 py-3 sm:py-6 max-w-6xl mx-auto space-y-5 sm:space-y-6">
      <header className="flex items-center gap-3">
        <Skeleton className="w-7 h-7 rounded-full" />
        <div>
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-4 w-48" />
        </div>
      </header>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
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
    return <AssetDetailSkeleton symbol={symbol} />;
  }

  if (isError || !asset) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <Card className="py-0">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {isError ? "Unable to load data." : `No data for ${symbol?.toUpperCase()}.`}
            </p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AssetContent asset={asset} symbol={symbol || ""} />;
}
