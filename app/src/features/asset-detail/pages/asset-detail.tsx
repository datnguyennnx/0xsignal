import { useParams } from "react-router-dom";
import { Effect, Exit, pipe } from "effect";
import type { AssetAnalysis, ChartDataPoint } from "@0xsignal/shared";
import { getTopAnalysis, getChartData } from "@/core/api/queries";
import { useEffect_ } from "@/core/runtime/use-effect";
import { cn } from "@/core/utils/cn";
import { TradingChart } from "@/features/chart/components/trading-chart";
import { CryptoIcon } from "@/components/crypto-icon";
import { ActionableInsights } from "../components/actionable-insights";
import { BullEntryCard } from "../components/bull-entry-card";
import { StrategyMetrics } from "../components/strategy-metrics";
import { useState, useEffect } from "react";

const fetchAssetData = (symbol: string) =>
  Effect.gen(function* () {
    const data = yield* getTopAnalysis(100);
    return data.find((a) => a.symbol.toLowerCase() === symbol.toLowerCase());
  });

const fetchChartData = (symbol: string, interval: string, timeframe: string) =>
  getChartData(symbol, interval, timeframe);

const INTERVAL_TIMEFRAMES: Record<string, string> = {
  "15m": "24h",
  "1h": "7d",
  "4h": "1M",
  "1d": "1M",
  "1w": "1y",
};

function AssetContent({ asset, symbol }: { asset: AssetAnalysis; symbol: string }) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [interval, setInterval] = useState("1h");

  const binanceSymbol = `${symbol.toUpperCase()}USDT`;

  const chartExit = useEffect_(() => {
    const timeframe = INTERVAL_TIMEFRAMES[interval] || "7d";
    return fetchChartData(binanceSymbol, interval, timeframe);
  }, [binanceSymbol, interval]);

  useEffect(() => {
    if (chartExit && Exit.isSuccess(chartExit)) {
      setChartData(Exit.getOrElse(chartExit, () => []));
    } else if (chartExit && Exit.isFailure(chartExit)) {
      setChartData([]);
    }
  }, [chartExit]);

  const handleIntervalChange = (newInterval: string) => {
    setInterval(newInterval);
  };

  const strategy = asset.strategyResult;
  const entry = asset.entrySignal;
  const price = asset.price;

  return (
    <div className="max-w-6xl mx-auto space-y-4 px-4 sm:px-6 lg:px-8 py-6">
      {/* Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
          <CryptoIcon symbol={asset.symbol} size={28} />
          <h1 className="text-lg font-medium">{asset.symbol.toUpperCase()}</h1>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Price</div>
          <div className="text-sm font-medium tabular-nums">
            ${price?.price >= 1 ? price?.price.toFixed(2) : price?.price.toFixed(6)}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">24h</div>
          <div
            className={cn(
              "text-sm font-medium tabular-nums",
              (price?.change24h || 0) > 0
                ? "text-gain"
                : (price?.change24h || 0) < 0
                  ? "text-loss"
                  : ""
            )}
          >
            {(price?.change24h || 0) > 0 ? "+" : ""}
            {(price?.change24h || 0).toFixed(2)}%
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Volume</div>
          <div className="text-sm font-medium tabular-nums">
            {(price?.volume24h || 0) >= 1_000_000_000
              ? `${((price?.volume24h || 0) / 1_000_000_000).toFixed(2)}B`
              : `${((price?.volume24h || 0) / 1_000_000).toFixed(0)}M`}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Signal</div>
          <div className="text-sm font-medium">{asset.overallSignal || "HOLD"}</div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Confidence</div>
          <div className="text-sm font-medium tabular-nums">{asset.confidence || 0}%</div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Risk</div>
          <div
            className={cn(
              "text-sm font-medium tabular-nums",
              asset.riskScore > 70 ? "text-loss" : asset.riskScore > 40 ? "text-warn" : "text-gain"
            )}
          >
            {asset.riskScore}/100
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <TradingChart
          data={chartData}
          symbol={binanceSymbol}
          interval={interval}
          onIntervalChange={handleIntervalChange}
        />
      )}

      {chartData.length === 0 && chartExit && (
        <div className="rounded border border-border/50 bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Chart data not available for this asset.</p>
        </div>
      )}

      {/* Analysis Section */}
      {strategy && (
        <ActionableInsights
          signal={asset.overallSignal}
          confidence={asset.confidence}
          riskScore={asset.riskScore}
          strategy={strategy.primarySignal.strategy}
          regime={strategy.regime}
          actionableInsight={asset.recommendation}
        />
      )}

      {/* Entry Setup */}
      {entry && (
        <BullEntryCard
          isOptimalEntry={entry.isOptimalEntry}
          strength={entry.strength}
          entryPrice={entry.entryPrice}
          targetPrice={entry.targetPrice}
          stopLoss={entry.stopLoss}
          confidence={entry.confidence}
        />
      )}

      {/* Strategy Metrics */}
      {strategy?.primarySignal.metrics && (
        <StrategyMetrics metrics={strategy.primarySignal.metrics} />
      )}
    </div>
  );
}

export function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const exit = useEffect_(() => fetchAssetData(symbol || ""), [symbol]);

  if (!exit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return pipe(
    exit,
    Exit.match({
      onFailure: () => (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-sm text-muted-foreground">Unable to load data</div>
        </div>
      ),
      onSuccess: (asset) => {
        if (!asset) {
          return (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="text-sm text-muted-foreground">Asset not found</div>
            </div>
          );
        }
        return <AssetContent asset={asset} symbol={symbol || ""} />;
      },
    })
  );
}
