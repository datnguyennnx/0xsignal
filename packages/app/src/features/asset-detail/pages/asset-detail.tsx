// Asset Detail Page - Mobile-first responsive design

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { cachedAnalysis, cachedChartData } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatCurrency, formatPercentChange } from "@/core/utils/formatters";
import { TradingChart } from "@/features/chart/components/trading-chart";
import { CryptoIcon } from "@/components/crypto-icon";
import { SignalAnalysis } from "../components/signal-analysis";
import { ChevronLeft } from "lucide-react";

// Direct single-asset fetch instead of filtering from all assets
const fetchAssetData = (symbol: string) => cachedAnalysis(symbol);

const INTERVAL_TIMEFRAMES: Record<string, string> = {
  "15m": "24h",
  "1h": "7d",
  "4h": "1M",
  "1d": "1M",
  "1w": "1y",
};

// Entry Setup Component - Compact for mobile
function EntrySetup({
  strength,
  entryPrice,
  targetPrice,
  stopLoss,
  confidence,
}: {
  strength: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number;
}) {
  const rr = ((targetPrice - entryPrice) / (entryPrice - stopLoss)).toFixed(1);
  const upside = (((targetPrice - entryPrice) / entryPrice) * 100).toFixed(1);
  const downside = (((entryPrice - stopLoss) / entryPrice) * 100).toFixed(1);

  return (
    <div className="rounded border border-border/50 overflow-hidden">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-border/30">
        <Cell label="Entry" value={`$${formatPrice(entryPrice)}`} />
        <Cell
          label="Target"
          value={`$${formatPrice(targetPrice)}`}
          sub={`+${upside}%`}
          variant="gain"
        />
        <Cell
          label="Stop"
          value={`$${formatPrice(stopLoss)}`}
          sub={`-${downside}%`}
          variant="loss"
        />
        <Cell label="R:R" value={`${rr}:1`} className="hidden sm:block" />
        <Cell
          label="Strength"
          value={strength.replace("_", " ")}
          variant={strength === "VERY_STRONG" || strength === "STRONG" ? "gain" : undefined}
          className="hidden sm:block"
        />
        <Cell label="Conf" value={`${confidence}%`} className="hidden sm:block" />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  variant,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "gain" | "loss";
  className?: string;
}) {
  return (
    <div className={cn("bg-background p-2 sm:p-3", className)}>
      <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div
        className={cn(
          "text-xs sm:text-sm font-medium tabular-nums",
          variant === "gain" && "text-gain",
          variant === "loss" && "text-loss"
        )}
      >
        {value}
      </div>
      {sub && (
        <div
          className={cn(
            "text-[9px] sm:text-[10px]",
            variant === "gain" && "text-gain",
            variant === "loss" && "text-loss"
          )}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

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
  const strategy = asset.strategyResult;
  const entry = asset.entrySignal;

  return (
    <div className="px-3 sm:px-6 py-3 sm:py-6 max-w-6xl mx-auto space-y-3 sm:space-y-4">
      {/* Header with back button on mobile */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="sm:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CryptoIcon symbol={asset.symbol} size={24} className="shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
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
            {/* Secondary stats - Single line on mobile */}
            <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
              <span>Vol ${formatCurrency(price?.volume24h || 0)}</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">H ${formatPrice(price?.high24h || 0)}</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">L ${formatPrice(price?.low24h || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signal Analysis - Scrollable on mobile */}
      {strategy && (
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <SignalAnalysis
            signal={asset.overallSignal}
            confidence={asset.confidence}
            riskScore={asset.riskScore}
            noise={asset.noise}
            strategyResult={strategy}
          />
        </div>
      )}

      {/* Chart */}
      {chartData && chartData.length > 0 && (
        <TradingChart
          data={chartData}
          symbol={binanceSymbol}
          interval={interval}
          onIntervalChange={setInterval}
        />
      )}

      {!chartLoading && (!chartData || chartData.length === 0) && (
        <div className="rounded border border-border/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">Chart data unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">
            Price history for {symbol.toUpperCase()} may not be available on this timeframe
          </p>
        </div>
      )}

      {/* Entry Setup */}
      {entry?.isOptimalEntry && (
        <EntrySetup
          strength={entry.strength}
          entryPrice={entry.entryPrice}
          targetPrice={entry.targetPrice}
          stopLoss={entry.stopLoss}
          confidence={entry.confidence}
        />
      )}
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
          <div className="h-6 w-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading {symbol?.toUpperCase()} analysis</p>
        </div>
      </div>
    );
  }

  if (isError || !asset) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <h1 className="text-lg font-semibold mb-4">{symbol?.toUpperCase() || "Asset"}</h1>
        <div className="rounded-lg border border-border bg-muted/30 p-6">
          <p className="text-sm text-muted-foreground mb-4">
            {isError
              ? "Unable to fetch asset data. Check your connection and try again."
              : `No analysis available for ${symbol?.toUpperCase()}. This asset may not be tracked.`}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded hover:bg-foreground/90 transition-colors"
          >
            {isError ? "Retry" : "Go Back"}
          </button>
        </div>
      </div>
    );
  }

  return <AssetContent asset={asset} symbol={symbol || ""} />;
}
