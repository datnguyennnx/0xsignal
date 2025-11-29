/** Heatmap Domain Logic - Pure functions for heatmap transformations */

import { Option } from "effect";
import type { CryptoPrice, HeatmapCell, HeatmapConfig, MarketHeatmap } from "@0xsignal/shared";

// Category mapping for crypto assets
const CATEGORIES: Record<string, string> = {
  btc: "Layer 1",
  eth: "Layer 1",
  sol: "Layer 1",
  ada: "Layer 1",
  avax: "Layer 1",
  dot: "Layer 1",
  atom: "Layer 1",
  near: "Layer 1",
  apt: "Layer 1",
  sui: "Layer 1",
  link: "Oracle",
  uni: "DeFi",
  aave: "DeFi",
  mkr: "DeFi",
  crv: "DeFi",
  ldo: "DeFi",
  snx: "DeFi",
  comp: "DeFi",
  doge: "Meme",
  shib: "Meme",
  pepe: "Meme",
  floki: "Meme",
  bonk: "Meme",
  matic: "Layer 2",
  arb: "Layer 2",
  op: "Layer 2",
  imx: "Layer 2",
  bnb: "Exchange",
  okb: "Exchange",
  cro: "Exchange",
  xrp: "Payment",
  xlm: "Payment",
  algo: "Payment",
  fil: "Storage",
  ar: "Storage",
  rndr: "AI",
  fet: "AI",
  agix: "AI",
  ocean: "AI",
};

// Get category for symbol
export const getCategory = (symbol: string): string =>
  Option.fromNullable(CATEGORIES[symbol.toLowerCase()]).pipe(Option.getOrElse(() => "Other"));

// Clamp value to range
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Transform price to heatmap cell
export const toHeatmapCell = (price: CryptoPrice): HeatmapCell => ({
  symbol: price.symbol,
  name: price.symbol.toUpperCase(),
  price: price.price,
  change24h: price.change24h,
  change7d: 0,
  marketCap: price.marketCap,
  volume24h: price.volume24h,
  category: getCategory(price.symbol),
  intensity: clamp(price.change24h, -100, 100),
});

// Sort comparators
const SORT_FNS: Record<HeatmapConfig["sortBy"], (a: HeatmapCell, b: HeatmapCell) => number> = {
  marketCap: (a, b) => b.marketCap - a.marketCap,
  volume: (a, b) => b.volume24h - a.volume24h,
  change: (a, b) => Math.abs(b.change24h) - Math.abs(a.change24h),
};

// Filter cells by category
const filterByCategory = (cells: HeatmapCell[], category: string | undefined): HeatmapCell[] =>
  Option.fromNullable(category).pipe(
    Option.map((cat) => cells.filter((c) => c.category === cat)),
    Option.getOrElse(() => cells)
  );

// Calculate dominance safely
const calcDominance = (cell: HeatmapCell | undefined, total: number): number =>
  Option.fromNullable(cell).pipe(
    Option.filter(() => total > 0),
    Option.map((c) => (c.marketCap / total) * 100),
    Option.getOrElse(() => 0)
  );

// Calculate average change safely
const calcAvgChange = (cells: HeatmapCell[]): number =>
  cells.length > 0 ? cells.reduce((s, c) => s + c.change24h, 0) / cells.length : 0;

// Create market heatmap from prices
export const createMarketHeatmap = (
  prices: readonly CryptoPrice[],
  config: HeatmapConfig
): MarketHeatmap => {
  const allCells = prices.map(toHeatmapCell);
  const filteredCells = filterByCategory(allCells, config.category);
  const sortFn = SORT_FNS[config.sortBy] ?? SORT_FNS.marketCap;
  const cells = [...filteredCells].sort(sortFn);

  const totalMarketCap = cells.reduce((s, c) => s + c.marketCap, 0);
  const totalVolume24h = cells.reduce((s, c) => s + c.volume24h, 0);

  const btc = cells.find((c) => c.symbol.toLowerCase() === "btc");
  const eth = cells.find((c) => c.symbol.toLowerCase() === "eth");

  return {
    cells,
    totalMarketCap,
    totalVolume24h,
    btcDominance: calcDominance(btc, totalMarketCap),
    ethDominance: calcDominance(eth, totalMarketCap),
    fearGreedIndex: clamp(50 + calcAvgChange(cells) * 2, 0, 100),
    timestamp: new Date(),
  };
};
