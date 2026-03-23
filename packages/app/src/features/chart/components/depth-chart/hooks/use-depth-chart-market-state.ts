import { useMemo } from "react";

interface UseDepthChartMarketStateOptions {
  bestBid: number;
  bestAsk: number;
  fallbackMidPrice: number | null;
  stableCenterPrice: number | null;
  halfSpan: number | null;
  tickSize: number;
}

export interface DepthChartMarketState {
  liveMidPrice: number | null;
  shouldReconcileCenter: boolean;
  nextStableCenterPrice: number | null;
}

interface CenterRampParams {
  deadband: number;
  maxStepPerUpdate: number;
}

export function computeLiveMidPrice(
  bestBid: number,
  bestAsk: number,
  fallbackMidPrice: number | null
): number | null {
  if (bestBid > 0 && bestAsk > 0) {
    return (bestBid + bestAsk) / 2;
  }

  if (fallbackMidPrice && Number.isFinite(fallbackMidPrice) && fallbackMidPrice > 0) {
    return fallbackMidPrice;
  }

  return null;
}

export function shouldReconcileCenter(
  stableCenterPrice: number | null,
  liveMidPrice: number | null,
  halfSpan: number | null,
  tickSize: number
): boolean {
  if (!liveMidPrice || !Number.isFinite(liveMidPrice)) {
    return false;
  }

  if (!stableCenterPrice || !Number.isFinite(stableCenterPrice)) {
    return true;
  }

  const params = resolveCenterRampParams(halfSpan, tickSize);
  return Math.abs(liveMidPrice - stableCenterPrice) >= params.deadband;
}

function resolveCenterRampParams(halfSpan: number | null, tickSize: number): CenterRampParams {
  const safeSpan = Math.max(halfSpan ?? tickSize, tickSize, 0.00000001);
  return {
    // Deadband avoids micro price jitter from re-centering every frame.
    deadband: Math.max(tickSize * 1.5, safeSpan * 0.01),
    // Slew-rate cap controls how quickly center can move per update.
    maxStepPerUpdate: Math.max(tickSize * 4, safeSpan * 0.12),
  };
}

export function reconcileStableCenterPrice(
  stableCenterPrice: number | null,
  liveMidPrice: number | null,
  halfSpan: number | null,
  tickSize: number
): number | null {
  if (!liveMidPrice || !Number.isFinite(liveMidPrice)) {
    return stableCenterPrice;
  }

  if (!stableCenterPrice || !Number.isFinite(stableCenterPrice)) {
    return liveMidPrice;
  }

  const params = resolveCenterRampParams(halfSpan, tickSize);
  const delta = liveMidPrice - stableCenterPrice;
  if (Math.abs(delta) < params.deadband) {
    return stableCenterPrice;
  }

  const clampedStep = Math.sign(delta) * Math.min(Math.abs(delta), params.maxStepPerUpdate);
  return stableCenterPrice + clampedStep;
}

export function useDepthChartMarketState({
  bestBid,
  bestAsk,
  fallbackMidPrice,
  stableCenterPrice,
  halfSpan,
  tickSize,
}: UseDepthChartMarketStateOptions): DepthChartMarketState {
  return useMemo(() => {
    const liveMidPrice = computeLiveMidPrice(bestBid, bestAsk, fallbackMidPrice);
    const nextStableCenterPrice = reconcileStableCenterPrice(
      stableCenterPrice,
      liveMidPrice,
      halfSpan,
      tickSize
    );

    return {
      liveMidPrice,
      shouldReconcileCenter: shouldReconcileCenter(
        stableCenterPrice,
        liveMidPrice,
        halfSpan,
        tickSize
      ),
      nextStableCenterPrice,
    };
  }, [bestAsk, bestBid, fallbackMidPrice, halfSpan, stableCenterPrice, tickSize]);
}
