/**
 * DefiLlama Provider
 * Protocol fees and revenue data from DefiLlama API
 */

import { Effect, Context, Layer, Data } from "effect";
import type { ProtocolBuyback } from "@0xsignal/shared";
import { HttpService } from "../http.service";
import { Logger } from "../../logging/console.logger";
import { DataSourceError, type AdapterInfo } from "../types";

// ============================================================================
// DefiLlama Error (internal)
// ============================================================================

export class DefiLlamaError extends Data.TaggedError("DefiLlamaError")<{
  readonly message: string;
  readonly protocol?: string;
}> {}

// ============================================================================
// Adapter Info
// ============================================================================

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
  rateLimit: {
    requestsPerMinute: 60,
  },
};

// ============================================================================
// DefiLlama API Response Types
// ============================================================================

interface DefiLlamaFeesProtocol {
  readonly name: string;
  readonly displayName?: string;
  readonly symbol?: string;
  readonly gecko_id?: string | null;
  readonly logo?: string;
  readonly url?: string;
  readonly category?: string;
  readonly chains?: readonly string[];
  readonly total24h?: number;
  readonly total7d?: number;
  readonly total30d?: number;
  readonly revenue24h?: number;
  readonly revenue7d?: number;
  readonly revenue30d?: number;
  readonly holdersRevenue24h?: number;
  readonly holdersRevenue7d?: number;
  readonly holdersRevenue30d?: number;
}

interface DefiLlamaFeesResponse {
  readonly protocols?: readonly DefiLlamaFeesProtocol[];
  readonly totalFees24h?: number;
  readonly totalRevenue24h?: number;
}

// ============================================================================
// DefiLlama Service Tag
// ============================================================================

export interface ProtocolFeesDetail {
  readonly protocol: ProtocolBuyback;
  readonly dailyFees: readonly { date: number; fees: number }[];
  readonly methodology: string | null;
  readonly revenueSource: string | null;
}

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

// ============================================================================
// DefiLlama Service Implementation
// ============================================================================

export const DefiLlamaServiceLive = Layer.effect(
  DefiLlamaService,
  Effect.gen(function* () {
    const http = yield* HttpService;
    const logger = yield* Logger;

    const BASE_URL = "https://api.llama.fi";

    const mapError = (error: unknown, protocol?: string): DataSourceError =>
      new DataSourceError({
        source: "DefiLlama",
        message: error instanceof Error ? error.message : "Unknown error",
        symbol: protocol,
      });

    const getProtocolsWithRevenue = (): Effect.Effect<ProtocolBuyback[], DataSourceError> =>
      Effect.gen(function* () {
        yield* logger.info("Fetching protocols with revenue from DefiLlama");

        // Fetch both endpoints concurrently for speed
        const feesUrl = `${BASE_URL}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`;
        const protocolsUrl = `${BASE_URL}/protocols`;

        const [feesResponse, protocolsResponse] = yield* Effect.all(
          [
            http.get(feesUrl).pipe(Effect.mapError((e) => mapError(e))),
            http.get(protocolsUrl).pipe(Effect.mapError((e) => mapError(e))),
          ],
          { concurrency: "unbounded" }
        );

        const feesData = feesResponse as DefiLlamaFeesResponse;
        const protocolsData = protocolsResponse as Array<{
          name: string;
          symbol?: string;
          gecko_id?: string;
          slug: string;
        }>;

        // Create lookup map by slug/name for gecko_id
        const geckoIdMap = new Map<string, { geckoId: string; symbol: string }>();
        for (const p of protocolsData) {
          if (p.gecko_id) {
            geckoIdMap.set(p.name.toLowerCase(), { geckoId: p.gecko_id, symbol: p.symbol || "" });
            if (p.slug) {
              geckoIdMap.set(p.slug.toLowerCase(), { geckoId: p.gecko_id, symbol: p.symbol || "" });
            }
          }
        }

        if (!feesData.protocols || !Array.isArray(feesData.protocols)) {
          return [];
        }

        const protocolsWithRevenue = feesData.protocols
          .filter((p) => {
            const hasFees = (p.total24h && p.total24h > 0) || (p.total30d && p.total30d > 0);
            const geckoInfo =
              geckoIdMap.get(p.name.toLowerCase()) ||
              geckoIdMap.get((p.displayName || "").toLowerCase());
            return hasFees && geckoInfo;
          })
          .map((p): ProtocolBuyback => {
            const geckoInfo =
              geckoIdMap.get(p.name.toLowerCase()) ||
              geckoIdMap.get((p.displayName || "").toLowerCase());
            return {
              protocol: p.displayName || p.name,
              symbol: geckoInfo?.symbol || p.symbol || p.name.toLowerCase(),
              geckoId: geckoInfo?.geckoId || null,
              revenue24h: p.total24h || 0,
              revenue7d: p.total7d || 0,
              revenue30d: p.total30d || 0,
              fees24h: p.total24h || 0,
              fees7d: p.total7d || 0,
              fees30d: p.total30d || 0,
              chains: p.chains || [],
              category: p.category || "Unknown",
              logo: p.logo || null,
              url: p.url || null,
            };
          });

        yield* logger.info(`Found ${protocolsWithRevenue.length} protocols with fees and gecko_id`);

        return protocolsWithRevenue;
      });

    const getProtocolFees = (protocol: string): Effect.Effect<ProtocolBuyback, DataSourceError> =>
      Effect.gen(function* () {
        yield* logger.info(`Fetching fees for protocol: ${protocol}`);

        const url = `${BASE_URL}/summary/fees/${protocol}`;

        const response = yield* http.get(url).pipe(Effect.mapError((e) => mapError(e, protocol)));

        const p = response as DefiLlamaFeesProtocol;

        return {
          protocol: p.name || protocol,
          symbol: p.symbol || protocol.toLowerCase(),
          geckoId: p.gecko_id || null,
          revenue24h: p.holdersRevenue24h || p.revenue24h || 0,
          revenue7d: p.holdersRevenue7d || p.revenue7d || 0,
          revenue30d: p.holdersRevenue30d || p.revenue30d || 0,
          fees24h: p.total24h || 0,
          fees7d: p.total7d || 0,
          fees30d: p.total30d || 0,
          chains: p.chains || [],
          category: p.category || "Unknown",
          logo: p.logo || null,
          url: p.url || null,
        };
      });

    const getProtocolFeesDetail = (
      protocol: string
    ): Effect.Effect<ProtocolFeesDetail, DataSourceError> =>
      Effect.gen(function* () {
        yield* logger.info(`Fetching detailed fees for protocol: ${protocol}`);

        const url = `${BASE_URL}/summary/fees/${protocol}`;
        const response = yield* http.get(url).pipe(Effect.mapError((e) => mapError(e, protocol)));

        const data = response as {
          name?: string;
          displayName?: string;
          symbol?: string;
          gecko_id?: string | null;
          logo?: string;
          url?: string;
          category?: string;
          chains?: string[];
          total24h?: number;
          total7d?: number;
          total30d?: number;
          totalDataChart?: [number, number][];
          methodology?: Record<string, string>;
        };

        const dailyFees = (data.totalDataChart || [])
          .map(([timestamp, fees]) => ({ date: timestamp, fees }))
          .filter((d) => d.fees > 0)
          .slice(-90); // Last 90 days

        const methodologyText = data.methodology
          ? Object.entries(data.methodology)
              .map(([k, v]) => `${k}: ${v}`)
              .join(". ")
          : null;

        return {
          protocol: {
            protocol: data.displayName || data.name || protocol,
            symbol: data.symbol || protocol.toLowerCase(),
            geckoId: data.gecko_id || null,
            revenue24h: data.total24h || 0,
            revenue7d: data.total7d || 0,
            revenue30d: data.total30d || 0,
            fees24h: data.total24h || 0,
            fees7d: data.total7d || 0,
            fees30d: data.total30d || 0,
            chains: data.chains || [],
            category: data.category || "Unknown",
            logo: data.logo || null,
            url: data.url || null,
          },
          dailyFees,
          methodology: methodologyText,
          revenueSource: data.methodology?.Revenue || null,
        };
      });

    return {
      info: DEFILLAMA_INFO,
      getProtocolsWithRevenue,
      getProtocolFees,
      getProtocolFeesDetail,
    };
  })
);
