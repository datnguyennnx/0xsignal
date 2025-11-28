/**
 * Buyback Domain Logic
 * Pure functions for buyback calculations and transformations
 */

import type {
  BuybackSignal,
  BuybackOverview,
  BuybackStrength,
  CategoryBuybackStats,
  ProtocolBuyback,
} from "@0xsignal/shared";

// Pure: classify buyback strength
export const classifyStrength = (rate: number): BuybackStrength => {
  if (rate <= 0) return "NONE";
  if (rate < 1) return "LOW";
  if (rate < 5) return "MODERATE";
  if (rate < 15) return "HIGH";
  return "VERY_HIGH";
};

// Pure: calculate buyback rate
export const calcBuybackRate = (revenue: number, mcap: number): number =>
  mcap > 0 ? (revenue / mcap) * 100 : 0;

// Pure: create buyback signal from protocol and market data
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
    revenueToMcap: marketCap > 0 ? annualizedRev / marketCap : 0,
    annualizedRevenue: annualizedRev,
    impliedPE: annualizedRev > 0 ? marketCap / annualizedRev : 0,
    revenueGrowth7d: avgDaily7d > 0 ? ((protocol.revenue24h - avgDaily7d) / avgDaily7d) * 100 : 0,
  };
};

// Pure: create category stats from signals
export const createCategoryStats = (
  signals: readonly BuybackSignal[]
): Record<string, CategoryBuybackStats> => {
  const map = new Map<string, BuybackSignal[]>();
  for (const s of signals) {
    const arr = map.get(s.category) ?? [];
    arr.push(s);
    map.set(s.category, arr);
  }

  const result: Record<string, CategoryBuybackStats> = {};
  for (const [cat, sigs] of map) {
    result[cat] = {
      category: cat,
      protocolCount: sigs.length,
      totalRevenue24h: sigs.reduce((s, x) => s + x.revenue24h, 0),
      averageBuybackRate: sigs.reduce((s, x) => s + x.annualizedBuybackRate, 0) / sigs.length,
    };
  }
  return result;
};

// Pure: create buyback overview from signals
export const createBuybackOverview = (signals: readonly BuybackSignal[]): BuybackOverview => ({
  totalProtocols: signals.length,
  totalRevenue24h: signals.reduce((s, x) => s + x.revenue24h, 0),
  totalRevenue7d: signals.reduce((s, x) => s + x.revenue7d, 0),
  averageBuybackRate:
    signals.length > 0
      ? signals.reduce((s, x) => s + x.annualizedBuybackRate, 0) / signals.length
      : 0,
  topBuybackProtocols: signals.slice(0, 10),
  byCategory: createCategoryStats(signals),
  timestamp: new Date(),
});

// Pure: build price map from cryptos
export const buildPriceMap = (
  cryptos: readonly { id?: string; marketCap: number; price: number }[]
): Map<string, { marketCap: number; price: number }> =>
  new Map(
    cryptos
      .filter((c) => c.id && c.marketCap > 0)
      .map((c) => [c.id!, { marketCap: c.marketCap, price: c.price }])
  );

// Pure: compute signals from protocols and prices
export const computeBuybackSignals = (
  protocols: readonly ProtocolBuyback[],
  priceMap: Map<string, { marketCap: number; price: number }>,
  limit: number
): BuybackSignal[] => {
  const signals: BuybackSignal[] = [];
  for (const p of protocols) {
    if (!p.geckoId) continue;
    const data = priceMap.get(p.geckoId);
    if (!data) continue;
    const signal = createBuybackSignal(p, data.marketCap, data.price);
    if (signal.annualizedBuybackRate > 0) signals.push(signal);
  }
  return signals.sort((a, b) => b.annualizedBuybackRate - a.annualizedBuybackRate).slice(0, limit);
};
