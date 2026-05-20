import type { ReactNode } from "react";

export interface TradeDropdownProps {
  currentSymbol: string;
  logoUrl?: string;
  displaySymbol?: string;
  currentDisplayName?: string;
  onPrefetchMarkets?: () => void;
}

export interface FormattedTrade {
  readonly coin: string;
  readonly rawCoin: string;
  readonly marketType: "perp" | "spot";
  readonly displaySymbol: string;
  readonly displayCategory: string;
  readonly markPx: string;
  readonly prevDayPx: string;
  readonly openInterest: string;
  readonly dayNtlVlm: string;
  readonly funding: string;
  readonly isHip3: boolean;
  readonly category: string;
  readonly dexPrefix: string | null;
  readonly changeValue: number;
  readonly changeFormatted: string;
  readonly oiFormatted: string;
  readonly volumeFormatted: string;
  readonly fundingFormatted: string;
  readonly marketCapFormatted: string;
  readonly isActive: boolean;
  readonly pxDecimals: number;
}

export const TAB_ORDER = [
  "All",
  "Perps",
  "Spot",
  "Crypto",
  "Tradfi",
  "HIP-3",
  "Trending",
  "Pre-launch",
] as const;

export type CategoryTab =
  | "all"
  | "perps"
  | "spot"
  | "crypto"
  | "tradfi"
  | "hip3"
  | "trending"
  | "prelaunch";

export const TAB_TO_CATEGORY: Record<string, CategoryTab> = {
  All: "all",
  Perps: "perps",
  Spot: "spot",
  Crypto: "crypto",
  Tradfi: "tradfi",
  "HIP-3": "hip3",
  Trending: "trending",
  "Pre-launch": "prelaunch",
};

export type ColumnId = "symbol" | "price" | "change" | "funding" | "volume" | "oi" | "marketCap";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  align: "left" | "right";
  /** Fraction of available space (relative to other columns). */
  fr: number;
  render: (item: FormattedTrade) => ReactNode;
}
