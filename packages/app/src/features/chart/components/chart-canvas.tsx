import type { RefObject } from "react";
import type { ActiveIndicator, ChartDataPoint, IndicatorConfig } from "@0xsignal/shared";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { EmptyState } from "@/components/empty-state";
import { ChartHeader } from "./chart-header";
import { ChartControls } from "./chart-controls";
import { IndicatorChips } from "./indicator-chips";
import { ChartOhlcOverlay } from "./chart-ohlc-overlay";
import { TradeMarkersOverlay } from "./trade-markers-overlay";
import type { LogicalTradeMarker } from "@/features/trade/utils/trade-markers";

interface ChartCanvasProps {
  chart: IChartApi | null;
  candlestickSeries: ISeriesApi<"Candlestick"> | null;
  candles: ChartDataPoint[];
  isLoading?: boolean;
  loadError: boolean;
  markers: readonly LogicalTradeMarker[];
  interval: string;
  onIntervalChange: (interval: string) => void;
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (config: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (id: string) => void;
  onResetAll: () => void;
  hasActiveOverlays: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  chartContainerRef: RefObject<HTMLDivElement | null>;
}

export function ChartCanvas({
  chart,
  candlestickSeries,
  candles,
  isLoading = false,
  loadError,
  markers,
  interval,
  onIntervalChange,
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onResetAll,
  hasActiveOverlays,
  isFullscreen,
  onToggleFullscreen,
  chartContainerRef,
}: ChartCanvasProps) {
  const hasCandles = candles.length > 0;

  return (
    <>
      <ChartHeader interval={interval} onIntervalChange={onIntervalChange}>
        <ChartControls
          activeIndicators={activeIndicators}
          onAddIndicator={onAddIndicator}
          onRemoveIndicator={onRemoveIndicator}
          hasActiveOverlays={hasActiveOverlays}
          onResetAll={onResetAll}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
        />
      </ChartHeader>

      <div className="flex-1 relative overflow-hidden rounded-panel">
        <div
          ref={chartContainerRef}
          className={`absolute inset-0${hasCandles ? "" : " invisible"}`}
        />
        {hasCandles ? (
          <>
            <TradeMarkersOverlay
              chart={chart}
              series={candlestickSeries}
              markers={markers}
              candles={candles}
            />
            <IndicatorChips indicators={activeIndicators} />
            <ChartOhlcOverlay data={candles} />
          </>
        ) : isLoading ? (
          <output
            aria-label="Loading chart data"
            className="absolute inset-0 flex flex-col gap-3 p-2"
          >
            <span className="h-5 w-1/3 rounded-full bg-muted/50 animate-pulse" />
            <span className="flex-1 rounded-panel bg-muted/30 animate-pulse" />
          </output>
        ) : loadError ? (
          <EmptyState
            variant="chart"
            title="Couldn't load chart"
            description="The history request failed. Check your connection and try again."
            className="absolute inset-0 pointer-events-none"
          />
        ) : (
          <EmptyState
            variant="chart"
            title="No recent data"
            className="absolute inset-0 pointer-events-none"
          />
        )}
      </div>
    </>
  );
}
