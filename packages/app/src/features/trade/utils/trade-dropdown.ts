import type { AggregatedMarket } from "@0xsignal/shared";

export interface TradeDropdownProps {
  currentSymbol: string;
  logoUrl?: string | undefined;
  displaySymbol?: string | undefined;
  currentDisplayName?: string;
  onPrefetchMarkets?: () => void;
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

type TradeAsset = AggregatedMarket;

const TRADFI_CATEGORIES = new Set(["stocks", "forex", "commodities", "indices"]);
const SEARCH_SEPARATORS = /[\s/:_-]+/g;

/** The API categorises pre-launch markets as "preipo"; the tab id stays "prelaunch". */
const API_CATEGORY_BY_TAB: Partial<Record<CategoryTab, string>> = { prelaunch: "preipo" };

/** Separators carry no meaning to a searching user: "PURR USDC" must find "PURR/USDC". */
export const normalizeSearch = (value: string): string =>
  value.toLowerCase().replace(SEARCH_SEPARATORS, "");

export function matchesCategoryTab(
  asset: Pick<TradeAsset, "marketType" | "isHip3" | "category">,
  tab: CategoryTab,
): boolean {
  if (tab === "all" || tab === "trending") return true;
  if (tab === "perps") return asset.marketType === "perp";
  if (tab === "spot") return asset.marketType === "spot";
  if (tab === "tradfi") return TRADFI_CATEGORIES.has(asset.category);
  if (tab === "hip3") return asset.isHip3;
  return asset.category === (API_CATEGORY_BY_TAB[tab] ?? tab);
}
