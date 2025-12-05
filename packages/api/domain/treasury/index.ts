/** Treasury Domain - Aggregation and analysis functions */

import { Effect, Array as Arr, pipe, Option, Order } from "effect";
import type {
  TreasuryHolding,
  TreasuryTx,
  TreasurySummary,
  TreasuryChartPoint,
  CoinId,
  EntityId,
  TransactionType,
} from "./types";

/** Transform raw API company to domain TreasuryHolding */
export const toHolding = (raw: {
  name: string;
  symbol: string;
  country: string;
  total_holdings: number;
  total_entry_value_usd: number;
  total_current_value_usd: number;
  percentage_of_total_supply: number;
}): TreasuryHolding => {
  const unrealizedPnlUsd = raw.total_current_value_usd - raw.total_entry_value_usd;
  const unrealizedPnlPercent =
    raw.total_entry_value_usd > 0 ? (unrealizedPnlUsd / raw.total_entry_value_usd) * 100 : 0;

  return {
    entityId: raw.symbol.toLowerCase() as EntityId,
    entityName: raw.name,
    symbol: raw.symbol,
    country: raw.country,
    totalHoldings: raw.total_holdings,
    entryValueUsd: raw.total_entry_value_usd,
    currentValueUsd: raw.total_current_value_usd,
    percentOfSupply: raw.percentage_of_total_supply,
    unrealizedPnlUsd,
    unrealizedPnlPercent,
  };
};

/** Transform raw API transaction to domain TreasuryTx */
export const toTransaction = (raw: {
  date: number;
  coin_id: string;
  type: string;
  holding_net_change: number;
  transaction_value_usd: number;
  holding_balance: number;
  average_entry_value_usd: number;
  source_url: string | null;
}): TreasuryTx => ({
  date: new Date(raw.date),
  coinId: raw.coin_id as CoinId,
  type: raw.type as TransactionType,
  holdingNetChange: raw.holding_net_change,
  txValueUsd: raw.transaction_value_usd,
  holdingBalance: raw.holding_balance,
  avgEntryUsd: raw.average_entry_value_usd,
  sourceUrl: raw.source_url,
});

/** Calculate net change from transactions in last N days */
export const calcNetChange = (
  txs: readonly TreasuryTx[],
  days: number
): { netChange: number; netChangePercent: number } => {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = Arr.filter(txs, (tx) => tx.date.getTime() >= cutoff);

  if (recent.length === 0) return { netChange: 0, netChangePercent: 0 };

  const netChange = Arr.reduce(recent, 0, (acc, tx) =>
    tx.type === "buy" ? acc + tx.holdingNetChange : acc - Math.abs(tx.holdingNetChange)
  );

  const firstBalance = pipe(
    Arr.head(recent),
    Option.map((tx) => tx.holdingBalance - tx.holdingNetChange),
    Option.getOrElse(() => 0)
  );

  const netChangePercent = firstBalance > 0 ? (netChange / firstBalance) * 100 : 0;

  return { netChange, netChangePercent };
};

// Order comparators for sorting
const byHoldingsDesc = Order.mapInput(
  Order.reverse(Order.number),
  (h: TreasuryHolding) => h.totalHoldings
);

const byDateDesc = Order.mapInput(Order.reverse(Order.number), (tx: TreasuryTx) =>
  tx.date.getTime()
);

/** Build TreasurySummary from holdings and transactions */
export const buildSummary = (
  coinId: CoinId,
  holdings: readonly TreasuryHolding[],
  transactions: readonly TreasuryTx[],
  totalHoldings: number,
  totalValueUsd: number,
  marketCapDominance: number
): TreasurySummary => {
  const { netChange, netChangePercent } = calcNetChange(transactions, 30);
  const topHolders = pipe(holdings, Arr.sortBy(byHoldingsDesc), Arr.take(10));
  const recentTransactions = pipe(transactions, Arr.sortBy(byDateDesc), Arr.take(20));

  return {
    coinId,
    totalHoldings,
    totalValueUsd,
    marketCapDominance,
    entityCount: holdings.length,
    netChange30d: netChange,
    netChangePercent30d: netChangePercent,
    topHolders,
    recentTransactions,
    lastUpdated: new Date(),
  };
};

/** Transform historical chart data */
export const toChartPoints = (
  holdings: ReadonlyArray<readonly [number, number]>,
  values: ReadonlyArray<readonly [number, number]>
): readonly TreasuryChartPoint[] => {
  const valueMap = new Map(values.map(([k, v]) => [k, v] as const));
  return Arr.map(holdings, ([timestamp, amount]) => ({
    timestamp,
    holdings: amount,
    valueUsd: valueMap.get(timestamp) ?? 0,
  }));
};

/** Get accumulation signal from recent activity */
export type AccumulationSignal = "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";

export const getAccumulationSignal = (netChangePercent30d: number): AccumulationSignal => {
  if (netChangePercent30d >= 5) return "strong_buy";
  if (netChangePercent30d >= 1) return "buy";
  if (netChangePercent30d <= -5) return "strong_sell";
  if (netChangePercent30d <= -1) return "sell";
  return "neutral";
};
