import type { AggregatedMarket } from "@0xsignal/shared";
import { calculatePxDecimals } from "@/features/trade/utils/trade-formatters";
import {
  matchesCategoryTab,
  normalizeSearch,
  type CategoryTab,
} from "@/features/trade/utils/trade-dropdown";

/**
 * One market rendered as flat primitives. The panel and the row component read
 * these fields directly so no object is unboxed or coerced outside the window.
 */
export interface MarketRowData {
  readonly key: string;
  readonly coin: string;
  readonly rawCoin: string;
  readonly displaySymbol: string;
  readonly name: string;
  readonly midKey: string;
  readonly markPx: number;
  readonly prevDayPx: number;
  readonly changePct: number | null;
  readonly volumeUsd: number;
  readonly openInterest: number;
  readonly funding: number;
  readonly marketCapUsd: number;
  readonly pxDecimals: number;
  readonly marketType: "perp" | "spot";
  readonly maxLeverage: number;
  readonly dexPrefix: string | null;
  readonly isHip3: boolean;
  readonly category: string;
  readonly isLive: boolean;
}

export interface MarketRows {
  readonly rows: MarketRowData[];
  /** Parallel to `rows`; the normalized haystack for the row at the same index. */
  readonly searchKeys: string[];
}

const SEARCH_FIELDS = ["coin", "rawCoin", "displaySymbol", "name"] as const;

const toSearchKey = (asset: AggregatedMarket): string => {
  const normalized = SEARCH_FIELDS.map((field) => normalizeSearch(asset[field]));
  // The alias is the separator-stripped pair a user types: BTCUSDT for BTC-USDT.
  const alias = normalizeSearch(`${asset.displaySymbol}${asset.rawCoin}`);
  return `${normalized.join("\u0000")}\u0000${alias}`;
};

export function buildMarketRows(assets: readonly AggregatedMarket[]): MarketRows {
  const rows: MarketRowData[] = [];
  const searchKeys: string[] = [];

  for (const asset of assets) {
    const markPx = Number(asset.markPx);
    const prevDayPx = Number(asset.prevDayPx);
    const volumeUsd = Number(asset.dayNtlVlm);
    const openInterest = Number(asset.openInterest);
    const funding = Number(asset.funding);
    const circulatingSupply = Number(asset.circulatingSupply ?? 0);
    const marketCapUsd =
      asset.marketType === "spot" ? (Number.isFinite(markPx) ? markPx : 0) * circulatingSupply : 0;

    rows.push({
      key: `${asset.marketType}:${asset.rawCoin}`,
      coin: asset.coin,
      rawCoin: asset.rawCoin,
      displaySymbol: asset.displaySymbol,
      name: asset.name,
      midKey: asset.marketType === "spot" ? asset.name : asset.rawCoin,
      markPx,
      prevDayPx,
      changePct: prevDayPx > 0 && markPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : null,
      volumeUsd,
      openInterest,
      funding,
      marketCapUsd,
      pxDecimals: calculatePxDecimals(asset.szDecimals ?? 4),
      marketType: asset.marketType,
      maxLeverage: asset.maxLeverage,
      dexPrefix: asset.dexPrefix,
      isHip3: asset.isHip3,
      category: asset.category,
      isLive: Number.isFinite(volumeUsd) && volumeUsd > 0,
    });
    searchKeys.push(toSearchKey(asset));
  }

  return { rows, searchKeys };
}

/** Nulls sort last in both directions so a missing price never tops the list. */
export function sortMarketRows(
  rows: readonly MarketRowData[],
  sortBy: "name" | "change",
  sortDesc: boolean,
): MarketRowData[] {
  if (sortBy === "name") {
    return rows.toSorted((a, b) =>
      sortDesc ? b.coin.localeCompare(a.coin) : a.coin.localeCompare(b.coin),
    );
  }

  return rows.toSorted((a, b) => {
    if (a.changePct === null && b.changePct === null) {
      return a.coin.localeCompare(b.coin);
    }
    if (a.changePct === null) return 1;
    if (b.changePct === null) return -1;
    return sortDesc ? b.changePct - a.changePct : a.changePct - b.changePct;
  });
}

/**
 * Applies the dropdown's live filter, tab, trending cap, search and sort in one
 * pass over the precomputed rows. Query normalization happens once per call.
 */
export function selectMarketRows(
  marketRows: MarketRows,
  category: CategoryTab,
  query: string,
  sortBy: "name" | "change",
  sortDesc: boolean,
): MarketRowData[] {
  const { rows, searchKeys } = marketRows;
  const candidates: number[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.isLive || !matchesCategoryTab(row, category)) continue;
    candidates.push(index);
  }

  let selected = candidates;
  if (category === "trending") {
    selected = candidates.toSorted((a, b) => rows[b].volumeUsd - rows[a].volumeUsd).slice(0, 10);
  }

  const needle = normalizeSearch(query);
  if (needle !== "") {
    selected = selected.filter((index) => searchKeys[index].includes(needle));
  }

  return sortMarketRows(
    selected.map((index) => rows[index]),
    sortBy,
    sortDesc,
  );
}
