import { useParams } from "react-router-dom";
import { Effect, Exit, pipe } from "effect";
import { getTopAnalysis, getChartData } from "@/core/api/queries";
import { useEffect_ } from "@/core/runtime/use-effect";
import { cn } from "@/core/utils/cn";
import { TradingChart } from "@/features/chart/components/trading-chart";
import { CryptoIcon } from "@/components/crypto-icon";
import { useState, useEffect } from "react";
import type { ChartDataPoint } from "@/domain/chart/types";

const fetchAssetData = (symbol: string) =>
  Effect.gen(function* () {
    const data = yield* getTopAnalysis(100);
    return data.find((a: any) => a.symbol.toLowerCase() === symbol.toLowerCase());
  });

const fetchChartData = (symbol: string, interval: string, timeframe: string) =>
  getChartData(symbol, interval, timeframe);

// Timeframe mapping for intervals
const INTERVAL_TIMEFRAMES: Record<string, string> = {
  "15m": "24h",
  "1h": "7d",
  "4h": "1M",
  "1d": "1M",
  "1w": "1y",
};

export function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const exit = useEffect_(() => fetchAssetData(symbol || ""), [symbol]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [interval, setInterval] = useState("1h");

  // Convert symbol to Binance format (e.g., "btc" -> "BTCUSDT")
  const binanceSymbol = symbol ? `${symbol.toUpperCase()}USDT` : "";

  // Fetch chart data from backend
  const chartExit = useEffect_(() => {
    const timeframe = INTERVAL_TIMEFRAMES[interval] || "7d";
    return fetchChartData(binanceSymbol, interval, timeframe);
  }, [binanceSymbol, interval]);

  const handleIntervalChange = (newInterval: string) => {
    setInterval(newInterval);
  };

  useEffect(() => {
    if (chartExit && Exit.isSuccess(chartExit)) {
      setChartData(Exit.getOrElse(chartExit, () => []));
    } else if (chartExit && Exit.isFailure(chartExit)) {
      setChartData([]);
    }
  }, [chartExit]);

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
        <div className="max-w-6xl mx-auto">
          <div className="text-sm text-muted-foreground">Unable to load data</div>
        </div>
      ),
      onSuccess: (asset) => {
        if (!asset) {
          return (
            <div className="max-w-6xl mx-auto">
              <div className="text-sm text-muted-foreground">Asset not found</div>
            </div>
          );
        }

        const strategy = asset.strategyResult;
        const entry = asset.entrySignal;
        const price = asset.price;

        return (
          <div className="max-w-6xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Overview */}
            <div className="flex items-center gap-6 pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <CryptoIcon symbol={asset.symbol} size={32} />
                <h1 className="text-xl font-medium">{asset.symbol.toUpperCase()}</h1>
              </div>

              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
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
                        ? "text-green-500"
                        : (price?.change24h || 0) < 0
                          ? "text-red-500"
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
                      ? `$${((price?.volume24h || 0) / 1_000_000_000).toFixed(2)}B`
                      : `$${((price?.volume24h || 0) / 1_000_000).toFixed(0)}M`}
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
                      asset.riskScore > 70
                        ? "text-red-500"
                        : asset.riskScore > 40
                          ? "text-orange-500"
                          : "text-green-500"
                    )}
                  >
                    {asset.riskScore}/100
                  </div>
                </div>
              </div>
            </div>

            {/* Chart with integrated controls - Only show if data exists */}
            {chartData.length > 0 && (
              <TradingChart
                data={chartData}
                symbol={binanceSymbol}
                interval={interval}
                onIntervalChange={handleIntervalChange}
              />
            )}

            {/* No Chart Data Message */}
            {chartData.length === 0 && chartExit && (
              <div className="rounded-lg border border-border/50 bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Chart data not available for this asset. Showing analysis data only.
                </p>
              </div>
            )}

            {/* Strategy Analysis */}
            {strategy && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Strategy Info */}
                <div className="rounded border border-border/50 p-4">
                  <div className="text-xs text-muted-foreground mb-3">Active Strategy</div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Type</div>
                      <div className="text-sm font-medium">{strategy.primarySignal.strategy}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Regime</div>
                      <div className="text-sm font-medium">
                        {strategy.regime.replace(/_/g, " ")}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Signal</div>
                      <div
                        className={cn(
                          "text-sm font-medium",
                          strategy.primarySignal.signal.includes("BUY")
                            ? "text-green-500"
                            : strategy.primarySignal.signal.includes("SELL")
                              ? "text-red-500"
                              : ""
                        )}
                      >
                        {strategy.primarySignal.signal}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trading Action */}
                <div className="lg:col-span-2 rounded border border-border/50 p-4">
                  <div className="text-xs text-muted-foreground mb-3">Analysis</div>
                  <div className="text-sm leading-relaxed">{asset.recommendation}</div>
                </div>
              </div>
            )}

            {/* Entry Setup */}
            {entry?.isOptimalEntry && (
              <div className="rounded border border-green-500/30 bg-green-500/5 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs text-muted-foreground">Entry Setup</div>
                  <div className="text-xs text-green-500">{entry.strength}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Entry</div>
                    <div className="font-medium tabular-nums">${entry.entryPrice.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Target</div>
                    <div className="font-medium tabular-nums text-green-500">
                      ${entry.targetPrice.toFixed(2)}
                    </div>
                    <div className="text-xs text-green-500">
                      +
                      {(((entry.targetPrice - entry.entryPrice) / entry.entryPrice) * 100).toFixed(
                        1
                      )}
                      %
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Stop</div>
                    <div className="font-medium tabular-nums text-red-500">
                      ${entry.stopLoss.toFixed(2)}
                    </div>
                    <div className="text-xs text-red-500">
                      -{(((entry.entryPrice - entry.stopLoss) / entry.entryPrice) * 100).toFixed(1)}
                      %
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    R:R{" "}
                    {(
                      (entry.targetPrice - entry.entryPrice) /
                      (entry.entryPrice - entry.stopLoss)
                    ).toFixed(2)}
                    :1
                  </span>
                  <span className="text-muted-foreground">Confidence {entry.confidence}%</span>
                </div>
              </div>
            )}

            {/* Strategy Metrics */}
            {strategy?.primarySignal.metrics &&
              Object.keys(strategy.primarySignal.metrics).length > 0 && (
                <div className="rounded border border-border/50 p-4">
                  <div className="text-xs text-muted-foreground mb-3">Strategy Metrics</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {Object.entries(strategy.primarySignal.metrics).map(([key, value]) => (
                      <div key={key}>
                        <div className="text-xs text-muted-foreground mb-1">
                          {key.replace(/_/g, " ")}
                        </div>
                        <div className="text-sm font-medium tabular-nums">
                          {typeof value === "number" ? value.toFixed(2) : value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        );
      },
    })
  );
}
