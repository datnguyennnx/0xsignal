import { useParams } from "react-router-dom";
import { Effect, Exit, pipe } from "effect";
import type { AssetAnalysis, ChartDataPoint } from "@0xsignal/shared";
import { getTopAnalysis, getChartData } from "@/core/api/queries";
import { useEffect_ } from "@/core/runtime/use-effect";
import { cn } from "@/core/utils/cn";
import { TradingChart } from "@/features/chart/components/trading-chart";
import { CryptoIcon } from "@/components/crypto-icon";
import { SignalAnalysis } from "../components/signal-analysis";
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

  const price = asset.price;
  const change24h = price?.change24h || 0;
  const strategy = asset.strategyResult;
  const entry = asset.entrySignal;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
      {/* Header - Mobile: stacked, Desktop: inline */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <CryptoIcon symbol={asset.symbol} size={24} className="sm:w-7 sm:h-7" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-medium">{asset.symbol.toUpperCase()}</span>
              <span className="text-base sm:text-lg tabular-nums">
                ${price?.price >= 1 ? price?.price.toFixed(2) : price?.price.toFixed(6)}
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
                {change24h > 0 ? "+" : ""}
                {change24h.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Secondary stats - hidden on mobile, visible on sm+ */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Vol $
            {(price?.volume24h || 0) >= 1e9
              ? `${((price?.volume24h || 0) / 1e9).toFixed(1)}B`
              : `${((price?.volume24h || 0) / 1e6).toFixed(0)}M`}
          </span>
          <span>H ${price?.high24h?.toFixed(price?.high24h >= 1 ? 2 : 4) || "-"}</span>
          <span>L ${price?.low24h?.toFixed(price?.low24h >= 1 ? 2 : 4) || "-"}</span>
        </div>
      </div>

      {/* Mobile-only secondary stats */}
      <div className="flex sm:hidden items-center gap-3 text-[10px] text-muted-foreground">
        <span>
          Vol $
          {(price?.volume24h || 0) >= 1e9
            ? `${((price?.volume24h || 0) / 1e9).toFixed(1)}B`
            : `${((price?.volume24h || 0) / 1e6).toFixed(0)}M`}
        </span>
        <span>H ${price?.high24h?.toFixed(price?.high24h >= 1 ? 2 : 4) || "-"}</span>
        <span>L ${price?.low24h?.toFixed(price?.low24h >= 1 ? 2 : 4) || "-"}</span>
      </div>

      {/* Signal Analysis */}
      {strategy && (
        <SignalAnalysis
          signal={asset.overallSignal}
          confidence={asset.confidence}
          riskScore={asset.riskScore}
          noise={asset.noise}
          strategyResult={strategy}
        />
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <TradingChart
          data={chartData}
          symbol={binanceSymbol}
          interval={interval}
          onIntervalChange={setInterval}
        />
      )}

      {chartData.length === 0 && chartExit && (
        <div className="rounded border border-border/50 p-6 sm:p-8 text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">Chart data unavailable</p>
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
    <div className="rounded border border-border/50">
      {/* Mobile: 2 cols, Tablet: 3 cols, Desktop: 6 cols */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border/30">
        <div className="bg-background p-2 sm:p-3">
          <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1">
            Entry
          </div>
          <div className="text-xs sm:text-sm font-medium tabular-nums">
            ${entryPrice.toLocaleString()}
          </div>
        </div>
        <div className="bg-background p-2 sm:p-3">
          <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1">
            Target
          </div>
          <div className="text-xs sm:text-sm font-medium tabular-nums text-gain">
            ${targetPrice.toLocaleString()}
          </div>
          <div className="text-[9px] sm:text-[10px] text-gain">+{upside}%</div>
        </div>
        <div className="bg-background p-2 sm:p-3">
          <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1">
            Stop
          </div>
          <div className="text-xs sm:text-sm font-medium tabular-nums text-loss">
            ${stopLoss.toLocaleString()}
          </div>
          <div className="text-[9px] sm:text-[10px] text-loss">-{downside}%</div>
        </div>
        <div className="bg-background p-2 sm:p-3">
          <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1">
            R:R
          </div>
          <div className="text-xs sm:text-sm font-medium tabular-nums">{rr}:1</div>
        </div>
        <div className="bg-background p-2 sm:p-3">
          <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1">
            Strength
          </div>
          <div
            className={cn(
              "text-xs sm:text-sm font-medium",
              strength === "VERY_STRONG" || strength === "STRONG" ? "text-gain" : ""
            )}
          >
            {strength.replace("_", " ")}
          </div>
        </div>
        <div className="bg-background p-2 sm:p-3">
          <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1">
            Conf
          </div>
          <div className="text-xs sm:text-sm font-medium tabular-nums">{confidence}%</div>
        </div>
      </div>
    </div>
  );
}

export function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const exit = useEffect_(() => fetchAssetData(symbol || ""), [symbol]);

  if (!exit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-xs sm:text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return pipe(
    exit,
    Exit.match({
      onFailure: () => (
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="text-xs sm:text-sm text-muted-foreground">Unable to load data</div>
        </div>
      ),
      onSuccess: (asset) => {
        if (!asset) {
          return (
            <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
              <div className="text-xs sm:text-sm text-muted-foreground">Asset not found</div>
            </div>
          );
        }
        return <AssetContent asset={asset} symbol={symbol || ""} />;
      },
    })
  );
}
