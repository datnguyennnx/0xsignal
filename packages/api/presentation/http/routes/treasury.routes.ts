/** Treasury Routes - Institutional holdings API (Entity-centric) */

import { Effect } from "effect";
import { TreasuryService } from "../../../infrastructure/data-sources/coingecko/treasury.provider";
import { getAccumulationSignal } from "../../../domain/treasury";

const handleError = (e: { message: string }) => Effect.fail({ status: 500, message: e.message });

/** Entity holding for a specific coin */
export interface CoinHolding {
  coinId: string;
  coinSymbol: string;
  holdings: number;
  valueUsd: number;
  percentOfSupply: number;
}

/** Aggregated entity with all their crypto holdings */
export interface AggregatedEntity {
  entityName: string;
  symbol: string;
  country: string;
  totalValueUsd: number;
  entryValueUsd: number;
  unrealizedPnlPercent: number;
  holdings: CoinHolding[];
}

/** Get all entities with their holdings across all tracked coins */
export const treasuryEntitiesRoute = () =>
  Effect.gen(function* () {
    const service = yield* TreasuryService;
    const coins = yield* service.getSupportedCoins();

    // Fetch all coin data
    const allData = yield* Effect.forEach(
      coins,
      (coinId) =>
        service.getHoldingsByCoin(coinId).pipe(
          Effect.map((summary) => ({
            coinId,
            coinSymbol: coinId === "bitcoin" ? "BTC" : "ETH",
            holders: summary.topHolders,
          })),
          Effect.catchAll(() => Effect.succeed(null))
        ),
      { concurrency: 2 }
    );

    // Aggregate entities across all coins
    const entityMap = new Map<string, AggregatedEntity>();

    for (const coinData of allData) {
      if (!coinData) continue;

      for (const holder of coinData.holders) {
        const key = holder.entityName.toLowerCase();
        const existing = entityMap.get(key);

        const holding: CoinHolding = {
          coinId: coinData.coinId,
          coinSymbol: coinData.coinSymbol,
          holdings: holder.totalHoldings,
          valueUsd: holder.currentValueUsd,
          percentOfSupply: holder.percentOfSupply,
        };

        if (existing) {
          existing.holdings.push(holding);
          existing.totalValueUsd += holder.currentValueUsd;
          existing.entryValueUsd += holder.entryValueUsd;
        } else {
          entityMap.set(key, {
            entityName: holder.entityName,
            symbol: holder.symbol,
            country: holder.country,
            totalValueUsd: holder.currentValueUsd,
            entryValueUsd: holder.entryValueUsd,
            unrealizedPnlPercent: 0,
            holdings: [holding],
          });
        }
      }
    }

    // Calculate P&L for each entity
    const entities = Array.from(entityMap.values())
      .map((entity) => ({
        ...entity,
        unrealizedPnlPercent:
          entity.entryValueUsd > 0
            ? ((entity.totalValueUsd - entity.entryValueUsd) / entity.entryValueUsd) * 100
            : 0,
        hasKnownEntry: entity.entryValueUsd > 0,
      }))
      .sort((a, b) => b.totalValueUsd - a.totalValueUsd);

    // Calculate totals
    const totalValueUsd = entities.reduce((acc, e) => acc + e.totalValueUsd, 0);
    const entityCount = entities.length;

    return {
      entities,
      totalValueUsd,
      entityCount,
    };
  });

/** Get list of supported coins for treasury tracking */
export const treasurySupportedCoinsRoute = () =>
  Effect.flatMap(TreasuryService, (s) => s.getSupportedCoins());

/** Legacy: Get treasury holdings for a specific coin */
export const treasuryHoldingsRoute = (coinId: string) =>
  Effect.flatMap(TreasuryService, (s) => s.getHoldingsByCoin(coinId)).pipe(
    Effect.map((summary) => ({
      ...summary,
      signal: getAccumulationSignal(summary.netChangePercent30d),
    })),
    Effect.catchTag("TreasuryFetchError", handleError)
  );

/** Get historical chart data for an entity */
export const treasuryChartRoute = (entityId: string) =>
  Effect.flatMap(TreasuryService, (s) => s.getHistoricalChart(entityId)).pipe(
    Effect.catchTag("TreasuryFetchError", handleError)
  );
