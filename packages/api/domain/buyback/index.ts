/** Buyback Domain Logic - Pure functions for buyback calculations */

import { Match, Option, Array as Arr, pipe, Record, Order } from "effect";
import type {
  BuybackSignal,
  BuybackOverview,
  BuybackStrength,
  CategoryBuybackStats,
  ProtocolBuyback,
} from "@0xsignal/shared";

// Classify buyback strength using Match
export const classifyStrength = Match.type<number>().pipe(
  Match.when(
    (r) => r <= 0,
    () => "NONE" as BuybackStrength
  ),
  Match.when(
    (r) => r < 1,
    () => "LOW" as BuybackStrength
  ),
  Match.when(
    (r) => r < 5,
    () => "MODERATE" as BuybackStrength
  ),
  Match.when(
    (r) => r < 15,
    () => "HIGH" as BuybackStrength
  ),
  Match.orElse(() => "VERY_HIGH" as BuybackStrength)
);

// Safe division helper
const safeDivide = (numerator: number, denominator: number, fallback = 0): number =>
  denominator > 0 ? numerator / denominator : fallback;

// Calculate buyback rate
export const calcBuybackRate = (revenue: number, mcap: number): number =>
  safeDivide(revenue, mcap) * 100;

// Create buyback signal from protocol and market data
export const createBuybackSignal = (
  protocol: ProtocolBuyback,
  marketCap: number,
  price: number
): BuybackSignal => {
  const rate24h = calcBuybackRate(protocol.revenue24h, marketCap);
  const rate7d = calcBuybackRate(protocol.revenue7d, marketCap);
  const rate30d = calcBuybackRate(protocol.revenue30d, marketCap);
  const annualized = rate30d * 12;
  const annualizedRev = protocol.revenue30d * 12;
  const avgDaily7d = protocol.revenue7d / 7;

  return {
    protocol: protocol.protocol,
    symbol: protocol.symbol,
    geckoId: protocol.geckoId,
    marketCap,
    price,
    revenue24h: protocol.revenue24h,
    revenue7d: protocol.revenue7d,
    revenue30d: protocol.revenue30d,
    buybackRate24h: rate24h,
    buybackRate7d: rate7d,
    buybackRate30d: rate30d,
    annualizedBuybackRate: annualized,
    category: protocol.category,
    chains: protocol.chains,
    logo: protocol.logo,
    url: protocol.url,
    signal: classifyStrength(annualized),
    timestamp: new Date(),
    revenueToMcap: safeDivide(annualizedRev, marketCap),
    annualizedRevenue: annualizedRev,
    impliedPE: safeDivide(marketCap, annualizedRev),
    revenueGrowth7d: safeDivide(protocol.revenue24h - avgDaily7d, avgDaily7d) * 100,
  };
};

// Create single category stats
const createSingleCategoryStats = (
  category: string,
  signals: readonly BuybackSignal[]
): CategoryBuybackStats => ({
  category,
  protocolCount: signals.length,
  totalRevenue24h: Arr.reduce(signals, 0, (sum, s) => sum + s.revenue24h),
  averageBuybackRate: safeDivide(
    Arr.reduce(signals, 0, (sum, s) => sum + s.annualizedBuybackRate),
    signals.length
  ),
});

// Create category stats from signals using functional approach
export const createCategoryStats = (
  signals: readonly BuybackSignal[]
): Record<string, CategoryBuybackStats> =>
  pipe(
    signals,
    Arr.groupBy((s) => s.category),
    Record.map((sigs, cat) => createSingleCategoryStats(cat, sigs))
  );

// Create buyback overview from signals
// Default shows top 50 protocols to match DEFAULT_LIMITS.BUYBACK_SIGNALS
export const createBuybackOverview = (
  signals: readonly BuybackSignal[],
  limit = 50
): BuybackOverview => ({
  totalProtocols: signals.length,
  totalRevenue24h: Arr.reduce(signals, 0, (sum, s) => sum + s.revenue24h),
  totalRevenue7d: Arr.reduce(signals, 0, (sum, s) => sum + s.revenue7d),
  averageBuybackRate: safeDivide(
    Arr.reduce(signals, 0, (sum, s) => sum + s.annualizedBuybackRate),
    signals.length
  ),
  topBuybackProtocols: Arr.take(signals, limit),
  byCategory: createCategoryStats(signals),
  timestamp: new Date(),
});

// Build price map from cryptos
export const buildPriceMap = (
  cryptos: readonly { id?: string; symbol: string; marketCap: number; price: number }[]
): Map<string, { marketCap: number; price: number; symbol: string }> => {
  const entries = pipe(
    cryptos,
    Arr.filterMap((c) =>
      c.id && c.marketCap > 0
        ? Option.some([c.id, { marketCap: c.marketCap, price: c.price, symbol: c.symbol }] as const)
        : Option.none()
    )
  );
  return new Map(entries);
};

// Order for sorting by annualized buyback rate descending
const byBuybackRateDesc = Order.mapInput(
  Order.reverse(Order.number),
  (s: BuybackSignal) => s.annualizedBuybackRate
);

// Compute signals from protocols and prices using functional approach
export const computeBuybackSignals = (
  protocols: readonly ProtocolBuyback[],
  priceMap: Map<string, { marketCap: number; price: number; symbol: string }>,
  limit: number
): BuybackSignal[] =>
  pipe(
    protocols,
    Arr.filterMap((p) => {
      const findBySymbol = () => {
        const target = p.symbol.toUpperCase();
        for (const data of priceMap.values()) {
          if (data.symbol.toUpperCase() === target) return Option.some(data);
        }
        return Option.none();
      };

      return pipe(
        Option.fromNullable(p.geckoId),
        Option.flatMap((geckoId) => Option.fromNullable(priceMap.get(geckoId))),
        Option.orElse(() => findBySymbol()),
        Option.map((data) => createBuybackSignal(p, data.marketCap, data.price)),
        Option.filter((signal) => signal.annualizedBuybackRate > 0)
      );
    }),
    Arr.sortBy(byBuybackRateDesc),
    Arr.take(limit)
  );
