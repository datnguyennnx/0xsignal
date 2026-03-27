/**
 * @overview Depth Chart Widget (Canvas)
 *
 * Renders a high-performance market depth (L2) visualization using HTML5 Canvas.
 * Supports interactive zooming, real-time mid-price reconciliation, and cumulative volume tooltips.
 *
 * @mechanism
 * - Dual-canvas system: base canvas for static depth area, overlay canvas for dynamic tooltips/crosshair.
 * - Logic is split into specialized hooks (canonical-frame, engine, market-state).
 */
import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/core/utils/cn";
import { useTheme } from "@/core/providers/theme-provider";
import { useDepthChartCanonicalFrame } from "./hooks/use-depth-chart-canonical-frame";
import { useDepthChartEngine } from "./hooks/use-depth-chart-engine";
import { useDepthChartMarketState } from "./hooks/use-depth-chart-market-state";
import { useDepthChartOverlayEngine } from "./hooks/use-depth-chart-overlay-engine";
import { useDepthChartTooltip } from "./hooks/use-depth-chart-tooltip";
import { useDepthChartZoomController } from "./hooks/use-depth-chart-zoom-controller";

interface DepthChartWidgetProps {
  symbol: string;
  className?: string;
}

function formatDepthMetric(value: number, maxDecimals: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

export const DepthChartWidget = memo(function DepthChartWidget({
  symbol,
  className,
}: DepthChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [viewportWidth, setViewportWidth] = useState(0);
  const [stableCenterPrice, setStableCenterPrice] = useState<number | null>(null);
  const [committedHalfSpan, setCommittedHalfSpan] = useState<number | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [zoomConstraints, setZoomConstraints] = useState<{
    minHalfSpan: number | null;
    maxHalfSpan: number | null;
    defaultHalfSpan: number | null;
  }>({
    minHalfSpan: null,
    maxHalfSpan: null,
    defaultHalfSpan: null,
  });
  const [freezeVisibleRange, setFreezeVisibleRange] = useState(true);

  // 0. Symbol Reset
  const [prevSymbol, setPrevSymbol] = useState(symbol);
  if (symbol !== prevSymbol) {
    setPrevSymbol(symbol);
    setStableCenterPrice(null);
    setCommittedHalfSpan(null);
    setIsInteracting(false);
  }

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) {
        return;
      }
      setViewportWidth(entries[0].contentRect.width);
    });

    resizeObserver.observe(container);
    requestAnimationFrame(() => setViewportWidth(container.clientWidth || 0));

    return () => resizeObserver.disconnect();
  }, []);

  const zoomController = useDepthChartZoomController({
    containerRef,
    freezeVisibleRange,
    symbol,
    minHalfSpan: zoomConstraints.minHalfSpan,
    maxHalfSpan: zoomConstraints.maxHalfSpan,
    defaultHalfSpan: zoomConstraints.defaultHalfSpan,
    committedHalfSpan,
    onInteractionChange: setIsInteracting,
  });
  const { desiredHalfSpan, seedHalfSpan, commitHalfSpan } = zoomController;

  const frame = useDepthChartCanonicalFrame({
    symbol,
    enabled: true,
    stableCenterPrice,
    desiredHalfSpan,
    committedHalfSpan,
    viewportWidth,
  });

  const marketState = useDepthChartMarketState({
    bestBid: frame.bestBid,
    bestAsk: frame.bestAsk,
    fallbackMidPrice: frame.liveMidPrice,
    stableCenterPrice,
    halfSpan: frame.actualRenderableHalfSpan,
    tickSize: frame.tickSize,
  });

  const { updateDepthData } = useDepthChartEngine({
    containerRef,
    canvasRef: baseCanvasRef,
    isDark,
    tickSize: frame.tickSize,
    visibleRangeResetKey: symbol,
  });
  const tooltip = useDepthChartTooltip({
    containerRef,
    frame,
  });
  useDepthChartOverlayEngine({
    containerRef,
    overlayCanvasRef,
    frame,
    tooltip,
    isDark,
  });

  // Derive zoom constraints and freeze state synchronously from frame
  // These are cheap assignments — no need for rAF batching that was causing multi-render waterfalls
  const nextZoomConstraints = {
    minHalfSpan: frame.minHalfSpan,
    maxHalfSpan: frame.maxHalfSpan,
    defaultHalfSpan: frame.defaultHalfSpan,
  };
  if (
    nextZoomConstraints.minHalfSpan !== zoomConstraints.minHalfSpan ||
    nextZoomConstraints.maxHalfSpan !== zoomConstraints.maxHalfSpan ||
    nextZoomConstraints.defaultHalfSpan !== zoomConstraints.defaultHalfSpan
  ) {
    setZoomConstraints(nextZoomConstraints);
  }

  const nextFreezeVisibleRange = !frame.hasRenderableFrame;
  if (nextFreezeVisibleRange !== freezeVisibleRange) {
    setFreezeVisibleRange(nextFreezeVisibleRange);
  }

  // Center price sync — render-phase state transitions (React 19 declarative sync)
  // These derive state from incoming hook data, not from external events
  if (marketState.liveMidPrice && stableCenterPrice === null) {
    setStableCenterPrice(marketState.liveMidPrice);
  } else if (
    !freezeVisibleRange &&
    !isInteracting &&
    marketState.shouldReconcileCenter &&
    stableCenterPrice !== null
  ) {
    setStableCenterPrice(marketState.nextStableCenterPrice);
  }

  // Span sync — render-phase setState + effect for external side effects
  if (frame.actualRenderableHalfSpan !== null && committedHalfSpan === null) {
    setCommittedHalfSpan(frame.actualRenderableHalfSpan);
  } else if (
    frame.canCommitDesiredSpan &&
    frame.actualRenderableHalfSpan !== null &&
    committedHalfSpan !== frame.actualRenderableHalfSpan
  ) {
    setCommittedHalfSpan(frame.actualRenderableHalfSpan);
  }

  // External side effects for zoom controller (not state derivation — must stay in effect)
  useEffect(() => {
    if (frame.actualRenderableHalfSpan === null) return;
    if (committedHalfSpan === null) return;

    if (committedHalfSpan === frame.actualRenderableHalfSpan) {
      if (frame.canCommitDesiredSpan) {
        commitHalfSpan(frame.actualRenderableHalfSpan);
      } else {
        seedHalfSpan(frame.actualRenderableHalfSpan);
      }
    }
  }, [
    committedHalfSpan,
    frame.actualRenderableHalfSpan,
    frame.canCommitDesiredSpan,
    seedHalfSpan,
    commitHalfSpan,
  ]);

  useEffect(() => {
    if (frame.hasRenderableFrame && frame.bids.length > 0 && frame.asks.length > 0) {
      updateDepthData(frame.bids, frame.asks, frame.bounds, frame.maxTotal);
    }
  }, [
    frame.asks,
    frame.bids,
    frame.bounds,
    frame.hasRenderableFrame,
    frame.maxTotal,
    updateDepthData,
  ]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex-1 min-h-[200px] relative">
        <div ref={containerRef} className="absolute inset-0">
          <canvas ref={baseCanvasRef} className="absolute inset-0 h-full w-full" />
          <canvas
            ref={overlayCanvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        </div>
        {!frame.hasRenderableFrame && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="rounded-lg border border-border/60 bg-card/90 px-4 py-3 text-center shadow-sm">
              <p className="text-sm font-medium text-foreground">Loading depth around spread</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Waiting for both bid and ask sides before drawing the book.
              </p>
            </div>
          </div>
        )}
        {tooltip && (
          <>
            <div
              className="pointer-events-none absolute z-30 w-[180px] rounded-md border border-slate-500/40 bg-slate-500/10 px-2 py-1.5 text-[11px] text-foreground shadow-lg backdrop-blur-sm"
              style={{ left: tooltip.position.left, top: tooltip.position.top }}
            >
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wide opacity-80">
                  {tooltip.hover.isInSpreadGap ? "spread gap" : tooltip.hover.side}
                </span>
                <span>{formatDepthMetric(tooltip.hover.distanceToCenter, 6)}</span>
              </div>
              {tooltip.hover.isInSpreadGap ? (
                <>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="opacity-70">Best Bid</span>
                    <span>{formatDepthMetric(frame.bestBid, 6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-70">Best Ask</span>
                    <span>{formatDepthMetric(frame.bestAsk, 6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-70">Spread</span>
                    <span>{formatDepthMetric(frame.spread, 6)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="opacity-70">Price</span>
                    <span>{formatDepthMetric(tooltip.hover.price, 6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-70">Amount</span>
                    <span>{formatDepthMetric(tooltip.hover.amount ?? 0, 4)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-70">Total</span>
                    <span>{formatDepthMetric(tooltip.hover.cumulative ?? 0, 4)}</span>
                  </div>
                </>
              )}
            </div>
            {tooltip.mirror && tooltip.mirrorPosition && !tooltip.hover.isInSpreadGap && (
              <div
                className="pointer-events-none absolute z-30 w-[180px] rounded-md border border-slate-500/40 bg-slate-500/10 px-2 py-1.5 text-[11px] text-foreground shadow-lg backdrop-blur-sm"
                style={{ left: tooltip.mirrorPosition.left, top: tooltip.mirrorPosition.top }}
              >
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-wide opacity-80">{tooltip.mirror.side}</span>
                  <span>
                    {formatDepthMetric(
                      tooltip.mirror.price - (frame.bounds?.centerPrice ?? tooltip.mirror.price),
                      6
                    )}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="opacity-70">Price</span>
                  <span>{formatDepthMetric(tooltip.mirror.price, 6)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="opacity-70">Amount</span>
                  <span>{formatDepthMetric(tooltip.mirror.amount, 4)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="opacity-70">Total</span>
                  <span>{formatDepthMetric(tooltip.mirror.cumulative, 4)}</span>
                </div>
              </div>
            )}
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
          <div className="rounded-md bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
            <span className="mr-2 text-foreground">Spread</span>
            {formatDepthMetric(frame.spread, 6)} ({formatDepthMetric(frame.spreadPercent, 4)}%)
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            {(frame.isStale || frame.isInitialLoading || frame.isCoveragePending) && (
              <div className="rounded-md bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
                {frame.hasRenderableFrame
                  ? frame.isCoveragePending
                    ? "Loading more depth..."
                    : "Updating depth..."
                  : "Building initial frame..."}
              </div>
            )}
            <div className="rounded-md bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
              nSigFigs (HL L2): {frame.activeSigFigs}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
