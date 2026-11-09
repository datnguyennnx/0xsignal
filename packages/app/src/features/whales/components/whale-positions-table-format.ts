import type { WhalePosition } from "@0xsignal/shared";

/** Formatter instances are immutable: build them once, reuse them for every cell and frame. */
export const ENTRY_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const HIGH_PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MID_PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const LOW_PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 5,
});

/** Same threshold ladder as `formatPrice`, with the Intl instances hoisted. */
export const formatWhalePrice = (price: number): string => {
  if (price >= 1000) return HIGH_PRICE_FORMATTER.format(price);
  if (price >= 1) return MID_PRICE_FORMATTER.format(price);
  return LOW_PRICE_FORMATTER.format(price);
};

export function formatEntryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return ENTRY_TIME_FORMATTER.format(date);
}

export interface WhalePositionRowProps {
  position: WhalePosition;
  index: number;
  onSelectWallet: (address: string) => void;
  onOpenCoin: (coin: string) => void;
}

/**
 * A refetch hands every row a fresh `position` object. Compare the scalars the
 * row prints (plus its rank and callbacks) so unchanged rows skip the re-render.
 */
export function areWhaleRowPropsEqual(
  prev: WhalePositionRowProps,
  next: WhalePositionRowProps,
): boolean {
  if (
    prev.index !== next.index ||
    prev.onSelectWallet !== next.onSelectWallet ||
    prev.onOpenCoin !== next.onOpenCoin
  ) {
    return false;
  }

  const a = prev.position;
  const b = next.position;
  return (
    a.userAddress === b.userAddress &&
    a.coin === b.coin &&
    a.side === b.side &&
    a.size === b.size &&
    a.notionalUsd === b.notionalUsd &&
    a.entryPx === b.entryPx &&
    a.liquidationPx === b.liquidationPx &&
    a.markPrice === b.markPrice &&
    a.marginUsd === b.marginUsd &&
    a.leverageType === b.leverageType &&
    a.fundingFee === b.fundingFee &&
    a.unrealizedPnl === b.unrealizedPnl &&
    a.unrealizedPnlPct === b.unrealizedPnlPct &&
    a.entryTime === b.entryTime
  );
}
