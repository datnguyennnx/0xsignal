import { useParams } from "react-router-dom";
import { Effect, Exit, pipe } from "effect";
import { getTopAnalysis, getChartData } from "../lib/api";
import { useEffect_ } from "../lib/runtime";
import { cn } from "@/lib/utils";
import { StrategyCard } from "@/components/StrategyCard";
import { CrashAlert } from "@/components/CrashAlert";
import { BullEntryCard } from "@/components/BullEntryCard";
import { ActionableInsights } from "@/components/ActionableInsights";
import { StrategyMetrics } from "@/components/StrategyMetrics";
import { TradingChart } from "@/features/chart";
import { useState, useEffect } from "react";
import type { ChartDataPoint } from "../types/chart";

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

        const quant = asset.quantAnalysis;
        const strategy = asset.strategyAnalysis;
        const price = asset.price;

        return (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold tracking-tight">{asset.symbol.toUpperCase()}</h1>
            </div>

            {/* Alerts */}
            {strategy?.crashSignal && (
              <CrashAlert
                isCrashing={strategy.crashSignal.isCrashing}
                severity={strategy.crashSignal.severity}
                recommendation={strategy.crashSignal.recommendation}
              />
            )}

            {/* Chart with integrated controls */}
            <TradingChart
              data={chartData}
              symbol={binanceSymbol}
              interval={interval}
              onIntervalChange={handleIntervalChange}
            />

            {/* Overview Grid */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Price</div>
                <div className="text-xl font-semibold tabular-nums">
                  $
                  {price?.price >= 1
                    ? price?.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : price?.price.toFixed(6)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">24h Change</div>
                <div
                  className={cn(
                    "text-xl font-semibold tabular-nums",
                    (price?.change24h || 0) > 0
                      ? "text-green-500"
                      : (price?.change24h || 0) < 0
                        ? "text-red-500"
                        : "text-foreground"
                  )}
                >
                  {(price?.change24h || 0) > 0 ? "+" : ""}
                  {(price?.change24h || 0).toFixed(2)}%
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Volume 24h</div>
                <div className="text-xl font-semibold tabular-nums">
                  {(price?.volume24h || 0) >= 1_000_000_000
                    ? `${((price?.volume24h || 0) / 1_000_000_000).toFixed(2)}B`
                    : `${((price?.volume24h || 0) / 1_000_000).toFixed(0)}M`}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Signal</div>
                <div className="text-xl font-semibold">
                  {strategy?.overallSignal || quant?.overallSignal || "HOLD"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {strategy?.confidence || quant?.confidence || 0}% confidence
                </div>
              </div>
            </div>

            {/* Strategy Section */}
            {strategy && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <StrategyCard
                  strategy={strategy.strategyResult.primarySignal.strategy}
                  regime={strategy.strategyResult.regime}
                  signal={strategy.strategyResult.primarySignal.signal}
                  confidence={strategy.strategyResult.primarySignal.confidence}
                  reasoning={strategy.strategyResult.primarySignal.reasoning}
                />

                <ActionableInsights
                  signal={strategy.overallSignal}
                  confidence={strategy.confidence}
                  riskScore={strategy.riskScore}
                  strategy={strategy.strategyResult.primarySignal.strategy}
                  regime={strategy.strategyResult.regime}
                  actionableInsight={strategy.actionableInsight}
                />
              </div>
            )}

            {/* Bull Entry */}
            {strategy?.bullEntrySignal && (
              <BullEntryCard
                isOptimalEntry={strategy.bullEntrySignal.isOptimalEntry}
                strength={strategy.bullEntrySignal.strength}
                entryPrice={strategy.bullEntrySignal.entryPrice}
                targetPrice={strategy.bullEntrySignal.targetPrice}
                stopLoss={strategy.bullEntrySignal.stopLoss}
                confidence={strategy.bullEntrySignal.confidence}
              />
            )}

            {/* Strategy Metrics */}
            {strategy?.strategyResult.primarySignal.metrics && (
              <StrategyMetrics metrics={strategy.strategyResult.primarySignal.metrics} />
            )}

            {/* Composite Scores */}
            {quant?.compositeScores && (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-muted-foreground">Technical Analysis</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Momentum */}
                  {quant.compositeScores.momentum && (
                    <div className="space-y-3 p-4 rounded-lg border border-border/50">
                      <div className="text-xs font-medium text-muted-foreground">Momentum</div>
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">RSI</span>
                          <span className="text-sm font-medium tabular-nums">
                            {quant.compositeScores.momentum.rsi.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">Score</span>
                          <span className="text-sm font-medium tabular-nums">
                            {quant.compositeScores.momentum.score > 0 ? "+" : ""}
                            {quant.compositeScores.momentum.score}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                          {quant.compositeScores.momentum.insight}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Volatility */}
                  {quant.compositeScores.volatility && (
                    <div className="space-y-3 p-4 rounded-lg border border-border/50">
                      <div className="text-xs font-medium text-muted-foreground">Volatility</div>
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">Regime</span>
                          <span className="text-sm font-medium">
                            {quant.compositeScores.volatility.regime}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">Score</span>
                          <span className="text-sm font-medium tabular-nums">
                            {quant.compositeScores.volatility.score}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                          {quant.compositeScores.volatility.insight}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mean Reversion */}
                  {quant.compositeScores.meanReversion && (
                    <div className="space-y-3 p-4 rounded-lg border border-border/50">
                      <div className="text-xs font-medium text-muted-foreground">
                        Mean Reversion
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">Percent B</span>
                          <span className="text-sm font-medium tabular-nums">
                            {(quant.compositeScores.meanReversion.percentB * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">Signal</span>
                          <span className="text-sm font-medium">
                            {quant.compositeScores.meanReversion.signal}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                          {quant.compositeScores.meanReversion.insight}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Risk Assessment */}
            <div className="p-4 rounded-lg border border-border/50">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Risk Score</div>
                  <div className="text-xl font-semibold tabular-nums">
                    {asset.combinedRiskScore}/100
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {asset.combinedRiskScore > 70
                      ? "High risk"
                      : asset.combinedRiskScore < 30
                        ? "Low risk"
                        : "Moderate risk"}
                  </div>
                </div>
                <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      asset.combinedRiskScore > 70
                        ? "bg-red-500"
                        : asset.combinedRiskScore < 30
                          ? "bg-green-500"
                          : "bg-orange-500"
                    )}
                    style={{ width: `${asset.combinedRiskScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      },
    })
  );
}
