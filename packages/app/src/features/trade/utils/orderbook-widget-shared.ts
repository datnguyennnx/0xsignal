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
