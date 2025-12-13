import { Effect, Cache, Duration } from "effect";
import { TreasuryService } from "../../../infrastructure/data-sources/coingecko/treasury.provider";
import { getAccumulationSignal } from "../../../domain/treasury";

const handleError = (e: { message: string }) => Effect.fail({ status: 500, message: e.message });

export interface CoinHolding {
  coinId: string;
  coinSymbol: string;
  holdings: number;
  valueUsd: number;
  percentOfSupply: number;
}

export interface AggregatedEntity {
  entityName: string;
  symbol: string;
  country: string;
  totalValueUsd: number;
  entryValueUsd: number;
  unrealizedPnlPercent: number;
  holdings: CoinHolding[];
}

export interface TreasuryEntitiesResponse {
  entities: AggregatedEntity[];
  totalValueUsd: number;
  entityCount: number;
}

const entitiesCache = Cache.make({
  capacity: 1,
  timeToLive: Duration.minutes(30),
  lookup: (_: "all") =>
    Effect.gen(function* () {
      const service = yield* TreasuryService;
      const coins = yield* service.getSupportedCoins();

      const allData = yield* Effect.forEach(
        coins,
        (coinId) =>
          service.getHoldingsByCoin(coinId).pipe(
            Effect.map((summary) => ({
              coinId,
              coinSymbol: coinId === "bitcoin" ? "BTC" : "ETH",
              holders: summary.topHolders,
            })),
            Effect.timeout(Duration.seconds(15)),
            Effect.catchAll(() => Effect.succeed(null))
          ),
        { concurrency: 2 }
      );

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

      const totalValueUsd = entities.reduce((acc, e) => acc + e.totalValueUsd, 0);
      const entityCount = entities.length;

      return {
        entities,
        totalValueUsd,
        entityCount,
      } as TreasuryEntitiesResponse;
    }),
});

const emptyResponse: TreasuryEntitiesResponse = {
  entities: [],
  totalValueUsd: 0,
  entityCount: 0,
};

export const treasuryEntitiesRoute = () =>
  Effect.flatMap(entitiesCache, (cache) =>
    cache.get("all").pipe(
      Effect.timeout(Duration.seconds(30)),
      Effect.catchAll(() => Effect.succeed(emptyResponse))
    )
  );

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
