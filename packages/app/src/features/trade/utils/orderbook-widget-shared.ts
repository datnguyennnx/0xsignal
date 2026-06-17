import type { CSSProperties } from "react";

interface ScalingOptionLike {
  value: number;
}

export interface PriceScalingState {
  symbol: string;
  value: number;
}

export function shouldApplyInitialPrecisionSync({
  symbol,
  userPriceScaling,
  hasSyncedForSymbol,
  userInteracted,
}: {
  symbol: string;
  userPriceScaling: PriceScalingState | null;
  hasSyncedForSymbol: boolean;
  userInteracted: boolean;
}): boolean {
  if (hasSyncedForSymbol || userInteracted) {
    return false;
  }

  return userPriceScaling?.symbol !== symbol;
}

export function getEffectivePriceScaling(
  userPriceScaling: PriceScalingState | null,
  symbol: string,
  scalingOptions: ScalingOptionLike[],
): number {
  if (userPriceScaling?.symbol === symbol) {
    return userPriceScaling.value;
  }
  return scalingOptions.length > 0 ? scalingOptions[0].value : 0;
}

// Module-level depth style cache to avoid object allocation per row per tick
const depthStyleCache = new Map<string, CSSProperties>();

export function getDepthStyle(percent: number, side: "bid" | "ask"): CSSProperties {
  const key = `${percent.toFixed(1)}-${side}`;
  let style = depthStyleCache.get(key);
  if (!style) {
    style = {
      width: "100%",
      transform: `scaleX(${Math.min(percent, 100) / 100})`,
      transformOrigin: "right center",
    };
    // Evict oldest entry if cache grows large (prevents memory leak over hours)
    if (depthStyleCache.size > 200) {
      const firstKey = depthStyleCache.keys().next().value;
      if (firstKey !== undefined) depthStyleCache.delete(firstKey);
    }
    depthStyleCache.set(key, style);
  }
  return style;
}
