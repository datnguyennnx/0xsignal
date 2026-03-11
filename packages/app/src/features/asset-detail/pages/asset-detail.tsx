import { useState, lazy, Suspense, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@/core/types";
import { getHydratedAnalysis } from "@/core/cache/analysis-store";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatCurrency, formatPercentChange } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";
import { AIChatPanel } from "@/features/ai-copilot/components/ai-chat-panel";
import { useAI } from "@/hooks/use-ai";
import { useModels } from "@/hooks/ai";
import type { ModelSelection } from "@/services/ai";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useHyperliquidCandles } from "@/hooks/use-hyperliquid-candles";
import { queryKeys } from "@/lib/query/query-keys";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AssetDetailTabs, type AssetDetailTab } from "@/components/asset-detail-tabs";
import { OrderbookWidget } from "@/features/asset-detail/components/orderbook-widget";
import { TradesWidget } from "@/features/asset-detail/components/trades-widget";

const TradingChart = lazy(() =>
  import("@/features/chart/components/trading-chart").then((m) => ({ default: m.TradingChart }))
);

const ChartSkeleton = () => (
  <div className="h-full w-full flex items-center justify-center bg-card border border-border/50 rounded-lg">
    <Skeleton className="h-full w-full rounded-lg" />
  </div>
);

const INTERVAL_TIMEFRAMES: Record<string, string> = {
  "15m": "24h",
  "1h": "7d",
  "4h": "1M",
  "1d": "1M",
  "1w": "1y",
};

interface AssetContentProps {
  readonly asset: AssetAnalysis & { fetchedAt?: Date };
  readonly symbol: string;
  readonly chartData: any[] | null;
  readonly chartLoading: boolean;
  readonly interval: string;
  readonly onIntervalChange: (interval: string) => void;
  readonly loadMore?: () => Promise<void>;
  readonly hasMore?: boolean;
}

function AssetContent({
  asset,
  symbol,
  chartData,
  chartLoading,
  interval,
  onIntervalChange,
  loadMore,
  hasMore,
}: AssetContentProps) {
  const navigate = useNavigate();
  const chartSymbol = symbol.toUpperCase();
  const price = asset.price;
  const change24h = price?.change24h || 0;

  const [selectedModel, setSelectedModel] = useState<ModelSelection | undefined>();
  const [activeTab, setActiveTab] = useState<AssetDetailTab>("orderbook");
  const { data: modelsData } = useModels();

  const { recommendation, loading, error, hasError, sendQuery, retry } = useAI({
    symbol,
    model: selectedModel,
  });

  return (
    <div className="container-fluid h-full flex flex-col py-3 sm:py-4 animate-in fade-in slide-in-from-bottom-1 duration-300 ease-premium overflow-y-auto lg:overflow-hidden">
      {/* Header */}
      <header className="mb-5 sm:mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(-1)}
            className="sm:hidden -ml-2 touch-target-44 shrink-0"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <CryptoIcon
              symbol={asset.symbol}
              image={asset.price?.image}
              size={32}
              className="shrink-0 sm:w-7 sm:h-7"
            />
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 flex-wrap min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-mono font-bold tracking-tight">
                  {asset.symbol.toUpperCase()}
                </span>
                <span className="text-lg sm:text-xl tabular-nums font-medium">
                  ${formatPrice(price?.price || 0)}
                </span>
                <span
                  className={cn(
                    "text-sm tabular-nums font-medium",
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
              <span className="text-xs text-muted-foreground font-mono">
                VOL ${formatCurrency(price?.volume24h || 0)}
                <span className="hidden lg:inline">
                  {" · "}H ${formatPrice(price?.high24h || 0)}
                  {" · "}L ${formatPrice(price?.low24h || 0)}
                </span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content: Chart + AI Copilot */}
      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-5">
        {/* Chart - Takes 2/3 on desktop */}
        <div className="lg:col-span-2 flex-1 min-h-[350px] lg:min-h-0 lg:h-full flex flex-col">
          {chartData && chartData.length > 0 ? (
            <Suspense fallback={<ChartSkeleton />}>
              <TradingChart
                data={chartData}
                symbol={chartSymbol}
                interval={interval}
                onIntervalChange={onIntervalChange}
                loadMore={loadMore}
                hasMore={hasMore}
              />
            </Suspense>
          ) : !chartLoading ? (
            <Card className="py-0 shadow-none h-full flex items-center justify-center border-dashed border-border/60">
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground font-mono">CHART DATA UNAVAILABLE</p>
              </CardContent>
            </Card>
          ) : (
            <Skeleton className="h-full w-full rounded-sm" />
          )}
        </div>

        {/* Side Panel: Orderbook + Trades + AI Copilot */}
        <div className="lg:col-span-1 min-h-[400px] lg:min-h-0 lg:h-full flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as AssetDetailTab)}
            className="h-full flex flex-col"
          >
            <div className="mb-3 shrink-0">
              <AssetDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            <TabsContent
              value="orderbook"
              className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
            >
              <OrderbookWidget symbol={symbol} />
            </TabsContent>

            <TabsContent
              value="trades"
              className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
            >
              <TradesWidget symbol={symbol} />
            </TabsContent>

            <TabsContent
              value="insight"
              className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
            >
              <AIChatPanel
                symbol={symbol}
                recommendation={recommendation}
                loading={loading}
                error={error}
                hasError={hasError}
                onSendQuery={sendQuery}
                onRetry={retry}
                providers={modelsData?.providers}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function AssetDetailSkeleton({ symbol }: { readonly symbol?: string }) {
  return (
    <div className="container-fluid h-full overflow-y-auto py-3 sm:py-6 space-y-5 sm:space-y-6">
      <header className="flex items-center gap-3">
        <Skeleton className="w-7 h-7 rounded-full" />
        <div>
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-4 w-48" />
        </div>
      </header>
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <Skeleton className="lg:col-span-2 h-80 lg:h-[500px] rounded-xl" />
        <Skeleton className="lg:col-span-1 h-80 lg:h-[500px] rounded-xl" />
      </div>
    </div>
  );
}

export function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const [interval, setInterval] = useState("1h");

  const normalizedSymbol = symbol?.toUpperCase() || "";
  const chartSymbol = normalizedSymbol.endsWith("USDT")
    ? normalizedSymbol
    : `${normalizedSymbol}USDT`;
  const timeframe = INTERVAL_TIMEFRAMES[interval] || "7d";

  const hydratedData = useMemo(() => (symbol ? getHydratedAnalysis(symbol) : null), [symbol]);

  // Fetch asset data với React Query - using query keys factory
  const {
    data: fetchedAsset,
    isLoading: assetLoading,
    error: assetError,
  } = useQuery({
    queryKey: queryKeys.asset.bySymbol(symbol || ""),
    queryFn: () => api.getCryptoPrice(symbol || ""),
    enabled: !!symbol,
    staleTime: 60 * 1000,
  });

  // Tạo mock AssetAnalysis từ price data
  const asset: AssetAnalysis | null = useMemo(() => {
    if (hydratedData) return hydratedData;
    if (!fetchedAsset) return null;
    return {
      symbol: fetchedAsset.symbol,
      overallSignal: "HOLD",
      confidence: 50,
      riskScore: 50,
      price: fetchedAsset,
      entrySignal: null,
    };
  }, [fetchedAsset, hydratedData]);

  const showSkeleton = !asset && assetLoading;

  // Fetch chart data using Hyperliquid streaming hook
  const {
    data: chartData,
    isLoading: chartLoading,
    loadMore: loadMoreCandles,
    hasMore: hasMoreCandles,
  } = useHyperliquidCandles({
    symbol: chartSymbol,
    interval,
    enabled: !!chartSymbol,
  });

  if (showSkeleton) return <AssetDetailSkeleton symbol={symbol} />;

  if (assetError || !asset) {
    return (
      <div className="container-fluid h-full overflow-y-auto py-6">
        <ErrorState
          title={assetError ? "Unable to load asset data" : `No data for ${symbol?.toUpperCase()}`}
          retryAction={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <AssetContent
      asset={asset}
      symbol={symbol || ""}
      chartData={chartData || null}
      chartLoading={chartLoading}
      interval={interval}
      onIntervalChange={setInterval}
      loadMore={loadMoreCandles}
      hasMore={hasMoreCandles}
    />
  );
}
