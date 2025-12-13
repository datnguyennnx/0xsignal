/** DefiLlama Provider - Protocol fees and revenue */

import { Effect, Context, Layer, Data, Cache, Array as Arr, Option, pipe } from "effect";
import type { ProtocolBuyback } from "@0xsignal/shared";
import { HttpClientTag } from "../../http/client";
import { DataSourceError, type AdapterInfo } from "../types";
import { API_URLS, CACHE_TTL, CACHE_CAPACITY, RATE_LIMITS } from "../../config/app.config";

export class DefiLlamaError extends Data.TaggedError("DefiLlamaError")<{
  readonly message: string;
  readonly protocol?: string;
}> {}

export const DEFILLAMA_INFO: AdapterInfo = {
  name: "DefiLlama",
  version: "1.0.0",
  capabilities: {
    spotPrices: false,
    futuresPrices: false,

    openInterest: false,
    fundingRates: false,
    heatmap: false,
    historicalData: true,
    realtime: false,
  },
  rateLimit: { requestsPerMinute: RATE_LIMITS.DEFILLAMA },
};

export interface ProtocolFeesDetail {
  readonly protocol: ProtocolBuyback;
  readonly dailyFees: readonly { date: number; fees: number }[];
  readonly methodology: string | null;
  readonly revenueSource: string | null;
}

const mapError = (e: unknown, protocol?: string): DataSourceError =>
  new DataSourceError({
    source: "DefiLlama",
    message: e instanceof Error ? e.message : "Unknown error",
    symbol: protocol,
  });

const toProtocol = (p: any, geckoInfo?: { geckoId: string; symbol: string }): ProtocolBuyback => ({
  protocol: p.displayName || p.name,
  symbol: geckoInfo?.symbol || p.symbol || p.name.toLowerCase(),
  geckoId: geckoInfo?.geckoId ?? p.gecko_id ?? null,
  revenue24h: p.total24h ?? p.holdersRevenue24h ?? p.revenue24h ?? 0,
  revenue7d: p.total7d ?? p.holdersRevenue7d ?? p.revenue7d ?? 0,
  revenue30d: p.total30d ?? p.holdersRevenue30d ?? p.revenue30d ?? 0,
  fees24h: p.total24h ?? 0,
  fees7d: p.total7d ?? 0,
  fees30d: p.total30d ?? 0,
  average1y: p.average1y ?? null,
  total1y: p.total1y ?? null,
  change30d: p.change_30dover30d ?? null,
  chains: p.chains ?? [],
  category: p.category ?? "Unknown",
  logo: p.logo ?? null,
  url: p.url ?? null,
});

// Build gecko mapping from protocols using functional approach
const buildGeckoMap = (
  protocols: readonly any[]
): Map<string, { geckoId: string; symbol: string }> => {
  const entries: [string, { geckoId: string; symbol: string }][] = pipe(
    protocols,
    Arr.filter((p) => Boolean(p.gecko_id)),
    Arr.flatMap((p): [string, { geckoId: string; symbol: string }][] => {
      const info = { geckoId: p.gecko_id, symbol: p.symbol ?? "" };
      const base: [string, { geckoId: string; symbol: string }][] = [[p.name.toLowerCase(), info]];
      return p.slug ? [...base, [p.slug.toLowerCase(), info]] : base;
    })
  );
  return new Map(entries);
};

// Transform fees protocols to buyback protocols
const transformProtocols = (
  feesProtocols: readonly any[],
  geckoMap: Map<string, { geckoId: string; symbol: string }>
): ProtocolBuyback[] =>
  pipe(
    feesProtocols,
    Arr.filterMap((p) => {
      const hasFees = p.total24h > 0 || p.total30d > 0;
      const geckoInfo =
        geckoMap.get(p.name.toLowerCase()) ?? geckoMap.get((p.displayName ?? "").toLowerCase());
      return hasFees && geckoInfo ? Option.some(toProtocol(p, geckoInfo)) : Option.none();
    })
  );

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

export const DefiLlamaServiceLive = Layer.effect(
  DefiLlamaService,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;

    const protocolsCache = yield* Cache.make({
      capacity: 1,
      timeToLive: CACHE_TTL.DEFILLAMA_PROTOCOLS,
      lookup: (_: "all") =>
        Effect.gen(function* () {
          const { fees, protocols } = yield* Effect.all(
            {
              fees: http.getJson(
                `${API_URLS.DEFILLAMA}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`
              ),
              protocols: http.getJson(`${API_URLS.DEFILLAMA}/protocols`),
            },
            { concurrency: 2 }
          ).pipe(Effect.mapError(mapError));

          const geckoMap = buildGeckoMap(protocols as any[]);
          const feesData = fees as { protocols?: any[] };

          return pipe(
            Option.fromNullable(feesData.protocols),
            Option.map((p) => transformProtocols(p, geckoMap)),
            Option.getOrElse(() => [] as ProtocolBuyback[])
          );
        }),
    });

    const protocolCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.LARGE,
      timeToLive: CACHE_TTL.DEFILLAMA_PROTOCOL,
      lookup: (protocol: string) =>
        http.getJson(`${API_URLS.DEFILLAMA}/summary/fees/${protocol}`).pipe(
          Effect.map((d: any) => toProtocol(d)),
          Effect.mapError((e) => mapError(e, protocol))
        ),
    });

    const detailCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.LARGE,
      timeToLive: CACHE_TTL.DEFILLAMA_PROTOCOL,
      lookup: (protocol: string) =>
        http.getJson(`${API_URLS.DEFILLAMA}/summary/fees/${protocol}`).pipe(
          Effect.map((d: any) => {
            const chartData = (d.totalDataChart ?? []) as [number, number][];
            const dailyFees = pipe(
              chartData,
              Arr.map(([ts, fees]) => ({ date: ts, fees })),
              Arr.filter((x) => x.fees > 0),
              Arr.takeRight(90)
            );
            const methodology = pipe(
              Option.fromNullable(d.methodology as Record<string, string> | undefined),
              Option.map((m) =>
                Object.entries(m)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(". ")
              ),
              Option.getOrNull
            );
            return {
              protocol: toProtocol(d),
              dailyFees,
              methodology,
              revenueSource: d.methodology?.Revenue ?? null,
            } as ProtocolFeesDetail;
          }),
          Effect.mapError((e) => mapError(e, protocol))
        ),
    });

    return {
      info: DEFILLAMA_INFO,
      getProtocolsWithRevenue: () => protocolsCache.get("all"),
      getProtocolFees: (protocol) => protocolCache.get(protocol),
      getProtocolFeesDetail: (protocol) => detailCache.get(protocol),
    };
  })
);
