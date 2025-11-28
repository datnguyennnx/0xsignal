/**
 * DefiLlama Provider
 * Protocol fees and revenue data with Effect's Cache for proper concurrent handling
 */

import { Effect, Context, Layer, Data, Cache } from "effect";
import type { ProtocolBuyback } from "@0xsignal/shared";
import { HttpClientTag } from "../../http/client";
import { DataSourceError, type AdapterInfo } from "../types";
import { API_URLS, CACHE_TTL, CACHE_CAPACITY, RATE_LIMITS } from "../../config/app.config";

// DefiLlama-specific error
export class DefiLlamaError extends Data.TaggedError("DefiLlamaError")<{
  readonly message: string;
  readonly protocol?: string;
}> {}

// Adapter metadata
export const DEFILLAMA_INFO: AdapterInfo = {
  name: "DefiLlama",
  version: "1.0.0",
  capabilities: {
    spotPrices: false,
    futuresPrices: false,
    liquidations: false,
    openInterest: false,
    fundingRates: false,
    heatmap: false,
    historicalData: true,
    realtime: false,
  },
  rateLimit: { requestsPerMinute: RATE_LIMITS.DEFILLAMA },
};

// Protocol fees detail type
export interface ProtocolFeesDetail {
  readonly protocol: ProtocolBuyback;
  readonly dailyFees: readonly { date: number; fees: number }[];
  readonly methodology: string | null;
  readonly revenueSource: string | null;
}

// Map errors
const mapError = (e: unknown, protocol?: string): DataSourceError =>
  new DataSourceError({
    source: "DefiLlama",
    message: e instanceof Error ? e.message : "Unknown error",
    symbol: protocol,
  });

// Service interface
export class DefiLlamaService extends Context.Tag("DefiLlamaService")<
  DefiLlamaService,
  {
    readonly info: AdapterInfo;
    readonly getProtocolsWithRevenue: () => Effect.Effect<ProtocolBuyback[], DataSourceError>;
    readonly getProtocolFees: (protocol: string) => Effect.Effect<ProtocolBuyback, DataSourceError>;
    readonly getProtocolFeesDetail: (
      protocol: string
    ) => Effect.Effect<ProtocolFeesDetail, DataSourceError>;
  }
>() {}

// Service implementation with Effect's Cache
export const DefiLlamaServiceLive = Layer.effect(
  DefiLlamaService,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;

    // Cache for all protocols with revenue - single key cache
    const protocolsCache = yield* Cache.make({
      capacity: 1,
      timeToLive: CACHE_TTL.DEFILLAMA_PROTOCOLS,
      lookup: (_: "all") =>
        Effect.gen(function* () {
          yield* Effect.logInfo("[DefiLlama] Fetching all protocols with revenue");

          // Fetch fees and protocols concurrently
          const [feesData, protocolsData] = yield* Effect.all(
            [
              http.getJson(
                `${API_URLS.DEFILLAMA}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`
              ),
              http.getJson(`${API_URLS.DEFILLAMA}/protocols`),
            ],
            { concurrency: 2 }
          ).pipe(Effect.mapError((e) => mapError(e)));

          const fees = feesData as { protocols?: any[] };
          const protocols = protocolsData as Array<{
            name: string;
            symbol?: string;
            gecko_id?: string;
            slug: string;
          }>;

          // Build gecko_id lookup
          const geckoMap = new Map<string, { geckoId: string; symbol: string }>();
          for (const p of protocols) {
            if (p.gecko_id) {
              geckoMap.set(p.name.toLowerCase(), { geckoId: p.gecko_id, symbol: p.symbol ?? "" });
              if (p.slug)
                geckoMap.set(p.slug.toLowerCase(), { geckoId: p.gecko_id, symbol: p.symbol ?? "" });
            }
          }

          if (!fees.protocols) return [];

          const result = fees.protocols
            .filter((p: any) => {
              const hasFees = (p.total24h && p.total24h > 0) || (p.total30d && p.total30d > 0);
              const geckoInfo =
                geckoMap.get(p.name.toLowerCase()) ||
                geckoMap.get((p.displayName ?? "").toLowerCase());
              return hasFees && geckoInfo;
            })
            .map((p: any): ProtocolBuyback => {
              const geckoInfo =
                geckoMap.get(p.name.toLowerCase()) ||
                geckoMap.get((p.displayName ?? "").toLowerCase());
              return {
                protocol: p.displayName || p.name,
                symbol: geckoInfo?.symbol || p.symbol || p.name.toLowerCase(),
                geckoId: geckoInfo?.geckoId ?? null,
                revenue24h: p.total24h ?? 0,
                revenue7d: p.total7d ?? 0,
                revenue30d: p.total30d ?? 0,
                fees24h: p.total24h ?? 0,
                fees7d: p.total7d ?? 0,
                fees30d: p.total30d ?? 0,
                chains: p.chains ?? [],
                category: p.category ?? "Unknown",
                logo: p.logo ?? null,
                url: p.url ?? null,
              };
            });

          yield* Effect.logDebug(`[DefiLlama] Found ${result.length} protocols with fees`);
          return result;
        }),
    });

    // Cache for single protocol fees
    const protocolFeesCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.LARGE,
      timeToLive: CACHE_TTL.DEFILLAMA_PROTOCOL,
      lookup: (protocol: string) =>
        http.getJson(`${API_URLS.DEFILLAMA}/summary/fees/${protocol}`).pipe(
          Effect.map((data: any) => ({
            protocol: data.name ?? protocol,
            symbol: data.symbol ?? protocol.toLowerCase(),
            geckoId: data.gecko_id ?? null,
            revenue24h: data.holdersRevenue24h ?? data.revenue24h ?? 0,
            revenue7d: data.holdersRevenue7d ?? data.revenue7d ?? 0,
            revenue30d: data.holdersRevenue30d ?? data.revenue30d ?? 0,
            fees24h: data.total24h ?? 0,
            fees7d: data.total7d ?? 0,
            fees30d: data.total30d ?? 0,
            chains: data.chains ?? [],
            category: data.category ?? "Unknown",
            logo: data.logo ?? null,
            url: data.url ?? null,
          })),
          Effect.mapError((e) => mapError(e, protocol))
        ),
    });

    // Cache for protocol fees detail
    const protocolDetailCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.LARGE,
      timeToLive: CACHE_TTL.DEFILLAMA_PROTOCOL,
      lookup: (protocol: string) =>
        http.getJson(`${API_URLS.DEFILLAMA}/summary/fees/${protocol}`).pipe(
          Effect.map((data: any) => {
            const dailyFees = (data.totalDataChart ?? [])
              .map(([ts, fees]: [number, number]) => ({ date: ts, fees }))
              .filter((d: any) => d.fees > 0)
              .slice(-90);

            const methodology = data.methodology
              ? Object.entries(data.methodology)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(". ")
              : null;

            return {
              protocol: {
                protocol: data.displayName ?? data.name ?? protocol,
                symbol: data.symbol ?? protocol.toLowerCase(),
                geckoId: data.gecko_id ?? null,
                revenue24h: data.total24h ?? 0,
                revenue7d: data.total7d ?? 0,
                revenue30d: data.total30d ?? 0,
                fees24h: data.total24h ?? 0,
                fees7d: data.total7d ?? 0,
                fees30d: data.total30d ?? 0,
                chains: data.chains ?? [],
                category: data.category ?? "Unknown",
                logo: data.logo ?? null,
                url: data.url ?? null,
              },
              dailyFees,
              methodology,
              revenueSource: data.methodology?.Revenue ?? null,
            } as ProtocolFeesDetail;
          }),
          Effect.mapError((e) => mapError(e, protocol))
        ),
    });

    return {
      info: DEFILLAMA_INFO,
      getProtocolsWithRevenue: () => protocolsCache.get("all"),
      getProtocolFees: (protocol: string) => protocolFeesCache.get(protocol),
      getProtocolFeesDetail: (protocol: string) => protocolDetailCache.get(protocol),
    };
  })
);
