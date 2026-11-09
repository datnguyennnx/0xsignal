import type { TickSizeOption } from "../hooks/use-hyperliquid-orderbook";

export interface OrderbookToolbarProps {
  symbol: string;
  pairFocus: string;
  onPairFocusChange: (focus: string) => void;
  currentNSigFigs: number | null;
  onNSigFigsChange: (nSigFigs: number) => void;
  scalingOptions: TickSizeOption[];
}

export function areOrderbookToolbarPropsEqual(
  prev: OrderbookToolbarProps,
  next: OrderbookToolbarProps,
): boolean {
  return (
    prev.symbol === next.symbol &&
    prev.pairFocus === next.pairFocus &&
    prev.onPairFocusChange === next.onPairFocusChange &&
    prev.currentNSigFigs === next.currentNSigFigs &&
    prev.onNSigFigsChange === next.onNSigFigsChange &&
    prev.scalingOptions === next.scalingOptions
  );
}
