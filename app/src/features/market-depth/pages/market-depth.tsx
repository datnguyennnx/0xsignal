import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Effect, Exit, pipe } from "effect";
import { ApiServiceTag, ApiServiceLive } from "@/core/api/client";
import { MarketHeatmapComponent } from "../components/market-heatmap";
import { LiquidationHeatmapComponent } from "../components/liquidation-heatmap";
import type { MarketHeatmap, LiquidationHeatmap } from "@0xsignal/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DISPLAY_LIMIT = 20;

export const MarketDepthPage: React.FC = () => {
  const [heatmapData, setHeatmapData] = useState<MarketHeatmap | null>(null);
  const [liquidationData, setLiquidationData] = useState<LiquidationHeatmap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiquidationLoading, setIsLiquidationLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("btc");

  // Derive available symbols from heatmap data (top by market cap)
  const availableSymbols = useMemo(() => {
    if (!heatmapData?.cells) return [];
    return heatmapData.cells.slice(0, DISPLAY_LIMIT).map((cell) => cell.symbol.toLowerCase());
  }, [heatmapData]);

  // Initial load - fetch heatmap only
  useEffect(() => {
    setIsLoading(true);

    const program = pipe(
      Effect.flatMap(ApiServiceTag, (api) => api.getHeatmap(100)),
      Effect.provide(ApiServiceLive),
      Effect.exit
    );

    Effect.runPromise(program).then((exit) => {
      if (Exit.isSuccess(exit)) {
        setHeatmapData(exit.value);
      } else {
        console.error("Failed to fetch heatmap:", exit.cause);
      }
      setIsLoading(false);
    });
  }, []);

  // Fetch liquidation data when symbol changes
  useEffect(() => {
    if (!selectedSymbol) return;
    setIsLiquidationLoading(true);

    const program = pipe(
      Effect.flatMap(ApiServiceTag, (api) => api.getLiquidationHeatmap(selectedSymbol)),
      Effect.provide(ApiServiceLive),
      Effect.exit
    );

    Effect.runPromise(program).then((exit) => {
      if (Exit.isSuccess(exit)) {
        setLiquidationData(exit.value);
      } else {
        console.error("Failed to fetch liquidation data:", exit.cause);
      }
      setIsLiquidationLoading(false);
    });
  }, [selectedSymbol]);

  const handleSymbolSelect = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
  }, []);

  return (
    <div className="h-[calc(100vh-13rem)] w-full bg-background text-foreground flex flex-col overflow-hidden">
      <Tabs defaultValue="heatmap" className="w-full h-full flex flex-col">
        <div className="w-full border-b border-border px-6 py-4 shrink-0 flex items-center justify-between">
          <TabsList className="bg-transparent p-0 h-auto space-x-8">
            <TabsTrigger
              value="heatmap"
              className="bg-transparent p-0 text-base font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-colors hover:text-foreground/80 rounded-none"
            >
              Market Heatmap
            </TabsTrigger>
            <TabsTrigger
              value="liquidation"
              className="bg-transparent p-0 text-base font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-colors hover:text-foreground/80 rounded-none"
            >
              Liquidation Levels
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="heatmap"
          className="flex-1 animate-in fade-in-50 duration-500 p-0 m-0 h-full"
        >
          <MarketHeatmapComponent data={heatmapData!} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="liquidation" className="flex-1 animate-in fade-in-50 duration-500">
          <div className="flex h-full">
            <div className="w-64 shrink-0 border-r border-border h-full overflow-y-auto p-4 bg-background">
              <div className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                Assets ({availableSymbols.length})
              </div>
              <div className="space-y-1">
                {availableSymbols.map((symbol) => (
                  <button
                    key={symbol}
                    onClick={() => handleSymbolSelect(symbol)}
                    className={`
                      w-full px-3 py-2 text-left text-sm font-medium rounded-md transition-all duration-200
                      ${
                        selectedSymbol === symbol
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }
                    `}
                  >
                    {symbol.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 h-full min-w-0 bg-background">
              <LiquidationHeatmapComponent
                data={liquidationData!}
                isLoading={isLiquidationLoading}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
