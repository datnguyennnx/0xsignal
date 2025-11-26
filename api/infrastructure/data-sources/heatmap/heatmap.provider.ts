/**
 * Heatmap Provider
 * Generates market heatmap data from CoinGecko price data
 */

import { Effect, Context, Layer } from "effect";
import type { MarketHeatmap, HeatmapCell, HeatmapConfig, CryptoPrice } from "@0xsignal/shared";
import { CoinGeckoService } from "../coingecko";
import { Logger } from "../../logging/console.logger";
import { DataSourceError, type AdapterInfo } from "../types";

// ============================================================================
// Adapter Info
// ============================================================================

export const HEATMAP_INFO: AdapterInfo = {
  name: "Heatmap",
  version: "1.0.0",
  capabilities: {
    spotPrices: false,
    futuresPrices: false,
    liquidations: false,
    openInterest: false,
    fundingRates: false,
    heatmap: true,
    historicalData: false,
    realtime: false,
  },
  rateLimit: {
    requestsPerMinute: 60,
  },
};

// ============================================================================
// Category Mapping
// ============================================================================

const CRYPTO_CATEGORIES: Record<string, string> = {
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

const getCategory = (symbol: string): string => {
  return CRYPTO_CATEGORIES[symbol.toLowerCase()] || "Other";
};

// ============================================================================
// Helper Functions
// ============================================================================

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const priceToHeatmapCell = (price: CryptoPrice): HeatmapCell => ({
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

const SORT_COMPARATORS: Record<
  HeatmapConfig["sortBy"],
  (a: HeatmapCell, b: HeatmapCell) => number
> = {
  marketCap: (a, b) => b.marketCap - a.marketCap,
  volume: (a, b) => b.volume24h - a.volume24h,
  change: (a, b) => Math.abs(b.change24h) - Math.abs(a.change24h),
};

const sortCells = (cells: HeatmapCell[], sortBy: HeatmapConfig["sortBy"]): HeatmapCell[] =>
  [...cells].sort(SORT_COMPARATORS[sortBy] ?? SORT_COMPARATORS.marketCap);

// ============================================================================
// Heatmap Service Tag
// ============================================================================

export class HeatmapService extends Context.Tag("HeatmapService")<
  HeatmapService,
  {
    readonly info: AdapterInfo;
    readonly getMarketHeatmap: (
      config: HeatmapConfig
    ) => Effect.Effect<MarketHeatmap, DataSourceError>;
  }
>() {}

// ============================================================================
// Heatmap Service Implementation
// ============================================================================

export const HeatmapServiceLive = Layer.effect(
  HeatmapService,
  Effect.gen(function* () {
    const coinGecko = yield* CoinGeckoService;
    const logger = yield* Logger;

    const getMarketHeatmap = (
      config: HeatmapConfig
    ): Effect.Effect<MarketHeatmap, DataSourceError> =>
      Effect.gen(function* () {
        yield* logger.debug(`Generating heatmap with config: ${JSON.stringify(config)}`);

        const prices = yield* coinGecko.getTopCryptos(config.limit);

        let cells = prices.map(priceToHeatmapCell);

        if (config.category) {
          cells = cells.filter((cell) => cell.category === config.category);
        }

        cells = sortCells(cells, config.sortBy);

        const totalMarketCap = cells.reduce((sum, cell) => sum + cell.marketCap, 0);
        const totalVolume24h = cells.reduce((sum, cell) => sum + cell.volume24h, 0);

        const btcCell = cells.find((c) => c.symbol.toLowerCase() === "btc");
        const ethCell = cells.find((c) => c.symbol.toLowerCase() === "eth");
        const btcDominance = btcCell ? (btcCell.marketCap / totalMarketCap) * 100 : 0;
        const ethDominance = ethCell ? (ethCell.marketCap / totalMarketCap) * 100 : 0;

        const avgChange = cells.reduce((sum, cell) => sum + cell.change24h, 0) / cells.length;
        const fearGreedIndex = Math.max(0, Math.min(100, 50 + avgChange * 2));

        return {
          cells,
          totalMarketCap,
          totalVolume24h,
          btcDominance,
          ethDominance,
          fearGreedIndex,
          timestamp: new Date(),
        };
      });

    return {
      info: HEATMAP_INFO,
      getMarketHeatmap,
    };
  })
);
