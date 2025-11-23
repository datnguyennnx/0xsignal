import { useParams } from "react-router-dom";
import { Effect, Exit, pipe } from "effect";
import { getTopAnalysis, getChartData } from "@/core/api/queries";
import { useEffect_ } from "@/core/runtime/use-effect";
import { cn } from "@/core/utils/cn";
import { StrategyCard } from "@/features/dashboard/components/strategy-card";
import { CrashAlert } from "../components/crash-alert";
import { BullEntryCard } from "../components/bull-entry-card";
import { ActionableInsights } from "../components/actionable-insights";
import { StrategyMetrics } from "@/features/dashboard/components/strategy-metrics";
import { TradingChart } from "@/features/chart/components/trading-chart";
import { CryptoIcon } from "@/components/crypto-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import { Info } from "lucide-react";
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

        const quant = asset.quantAnalysis;
        const strategy = asset.strategyAnalysis;
        const price = asset.price;

        return (
          <div className="max-w-6xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Alerts */}
            {strategy?.crashSignal && (
              <CrashAlert
                isCrashing={strategy.crashSignal.isCrashing}
                severity={strategy.crashSignal.severity}
                recommendation={strategy.crashSignal.recommendation}
              />
            )}

            {/* Header with Metrics - All in one line */}
            <div className="space-y-4">
              {/* Title and Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                {/* Asset Title */}
                <div className="col-span-2 sm:col-span-3 lg:col-span-1 space-y-1">
                  <div className="flex items-center gap-3">
                    <CryptoIcon symbol={asset.symbol} size={40} />
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                      {asset.symbol.toUpperCase()}
                    </h1>
                  </div>
                </div>
                {/* Price */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="text-lg sm:text-xl font-semibold tabular-nums">
                    $
                    {price?.price >= 1
                      ? price?.price.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : price?.price.toFixed(6)}
                  </div>
                </div>

                {/* 24h Change */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">24h Change</div>
                  <div
                    className={cn(
                      "text-lg sm:text-xl font-semibold tabular-nums",
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

                {/* Volume */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Volume 24h</div>
                  <div className="text-lg sm:text-xl font-semibold tabular-nums">
                    {(price?.volume24h || 0) >= 1_000_000_000
                      ? `${((price?.volume24h || 0) / 1_000_000_000).toFixed(2)}B`
                      : `${((price?.volume24h || 0) / 1_000_000).toFixed(0)}M`}
                  </div>
                </div>

                {/* Signal */}
                <div className="space-y-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                        Signal
                        <Info className="w-3 h-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="text-xs font-medium">
                          {strategy?.confidence || quant?.confidence || 0}% confidence
                        </p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                          Trading signal based on quantitative analysis and strategy indicators.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <div className="text-lg sm:text-xl font-semibold">
                    {strategy?.overallSignal || quant?.overallSignal || "HOLD"}
                  </div>
                </div>

                {/* Risk Score */}
                <div className="space-y-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                        Risk Score
                        <Info className="w-3 h-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="text-xs font-medium">
                          {asset.riskScore > 70
                            ? "High risk"
                            : asset.riskScore < 30
                              ? "Low risk"
                              : "Moderate risk"}
                        </p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                          Quantitative risk assessment based on volatility, market conditions, and
                          technical indicators.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <div className="text-lg sm:text-xl font-semibold tabular-nums">
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

            {/* Strategy Section */}
            {strategy && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  {/* Momentum */}
                  {quant.compositeScores.momentum && (
                    <div className="space-y-4 p-4 sm:p-6 rounded-lg border border-border/50">
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
                    <div className="space-y-4 p-4 sm:p-6 rounded-lg border border-border/50">
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
                    <div className="space-y-4 p-4 sm:p-6 rounded-lg border border-border/50">
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
          </div>
        );
      },
    })
  );
}
