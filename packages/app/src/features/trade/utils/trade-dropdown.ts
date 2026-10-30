import type { ReactNode } from "react";
import type { AggregatedMarket } from "@0xsignal/shared";

export interface TradeDropdownProps {
  currentSymbol: string;
  logoUrl?: string | undefined;
  displaySymbol?: string | undefined;
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

type ColumnId = "symbol" | "price" | "change" | "funding" | "volume" | "oi" | "marketCap";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  align: "left" | "right";
  /** Fraction of available space (relative to other columns). */
  fr: number;
  render: (item: FormattedTrade) => ReactNode;
}

type TradeAsset = AggregatedMarket;

const TRADFI_CATEGORIES = new Set(["stocks", "forex", "commodities", "indices"]);
const SEARCH_SEPARATORS = /[\s/:_-]+/g;

/** The API categorises pre-launch markets as "preipo"; the tab id stays "prelaunch". */
const API_CATEGORY_BY_TAB: Partial<Record<CategoryTab, string>> = { prelaunch: "preipo" };

/** Separators carry no meaning to a searching user: "PURR USDC" must find "PURR/USDC". */
const normalizeSearch = (value: string): string =>
  value.toLowerCase().replace(SEARCH_SEPARATORS, "");

const matchesCategory = (asset: TradeAsset, tab: CategoryTab): boolean => {
  if (tab === "all" || tab === "trending") return true;
  if (tab === "perps") return asset.marketType === "perp";
  if (tab === "spot") return asset.marketType === "spot";
  if (tab === "tradfi") return TRADFI_CATEGORIES.has(asset.category);
  if (tab === "hip3") return asset.isHip3;
  return asset.category === (API_CATEGORY_BY_TAB[tab] ?? tab);
};

const matchesSearch = (asset: TradeAsset, needle: string): boolean =>
  [asset.coin, asset.rawCoin, asset.displaySymbol, asset.name].some((field) =>
    normalizeSearch(field).includes(needle),
  );

/** Wire values are decimal strings, so coerce before deciding; a dead market reports "0". */
export function isLiveMarket(asset: TradeAsset): boolean {
  const volume = Number(asset.dayNtlVlm);
  return Number.isFinite(volume) && volume > 0;
}

export function filterTradeAssets(
  assets: readonly TradeAsset[],
  category: CategoryTab,
  query: string,
): TradeAsset[] {
  let filtered = assets.filter((asset) => matchesCategory(asset, category));

  if (category === "trending") {
    filtered = filtered.toSorted((a, b) => Number(b.dayNtlVlm) - Number(a.dayNtlVlm)).slice(0, 10);
  }

  const needle = normalizeSearch(query);
  if (needle === "") return filtered;

  return filtered.filter((asset) => matchesSearch(asset, needle));
}
