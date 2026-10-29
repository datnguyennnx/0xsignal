import type { WhalePositionSort, WhaleSide } from "@0xsignal/shared";

export type SideFilter = "all" | WhaleSide;

export interface WhalePositionFilters {
  symbol: string;
  side: SideFilter;
  sort: WhalePositionSort;
}

export const DEFAULT_WHALE_FILTERS: WhalePositionFilters = {
  symbol: "",
  side: "all",
  sort: "notional",
};
