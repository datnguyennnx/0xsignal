import { HttpRequestError, HttpTransport, InfoClient, ValidationError } from "@nktkas/hyperliquid";
import type { HistoricalOrdersResponse, UserFundingResponse } from "@nktkas/hyperliquid/api/info";
import {
  normalizeCandle,
  type ChartDataPoint,
  type ClearinghouseState,
  type HistoricalOrderEntry,
  type OpenOrder,
  type PortfolioResponse,
  type SpotClearinghouseState,
  type UserFill,
  type UserFundingEntry,
  type UserVaultEquity,
  type WsMarketInterval,
} from "@0xsignal/shared";
import { ApiError } from "@/lib/api-error";
import { api } from "@/services/api";

/**
 * Browser-direct Hyperliquid REST reads.
 *
 * These four endpoints are pure passthroughs, so each tab can call them itself
 * and the backend stops paying upstream cost per user. Every call keeps the
 * backend route as a fallback for transport failures only.
 */

const HL_INFO_URL = "https://api.hyperliquid.xyz";
const REQUEST_TIMEOUT_MS = 10_000;

/** Single rollback switch: set `enabled` to false to send every read via the backend again. */
export const DIRECT_READS: { enabled: boolean } = { enabled: true };

let infoClient: InfoClient | null = null;

/** One client for the tab's lifetime: the SDK transport owns no per-call state. */
function getInfoClient(): InfoClient {
  infoClient ??= new InfoClient({
    transport: new HttpTransport({ apiUrl: HL_INFO_URL, timeout: REQUEST_TIMEOUT_MS }),
  });
  return infoClient;
}

/** A thrown transport error with no HTTP response means the request never reached Hyperliquid. */
function isNetworkFailure(error: unknown): boolean {
  return error instanceof HttpRequestError && error.response === undefined;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpRequestError) {
    return new ApiError(error.message, error.response?.status, error.response?.statusText);
  }
  if (error instanceof ValidationError) return new ApiError(error.message);
  return new ApiError(error instanceof Error ? error.message : "Hyperliquid read failed");
}

/**
 * Hyperliquid answers some bad requests with HTTP 200 and an error body, which the
 * SDK hands back unvalidated. Surface it instead of returning an empty value.
 */
function applicationErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  if ("error" in payload && typeof payload.error === "string") return payload.error;
  return null;
}

function ensureArrayResult(payload: unknown, operation: string): void {
  const applicationError = applicationErrorMessage(payload);
  if (applicationError !== null) throw new ApiError(applicationError);
  if (!Array.isArray(payload)) throw new ApiError(`${operation}: unexpected Hyperliquid response`);
}

async function readWithFallback<T>(
  direct: () => Promise<T>,
  backend: () => Promise<T>,
): Promise<T> {
  if (!DIRECT_READS.enabled) return backend();
  try {
    return await direct();
  } catch (error) {
    if (!isNetworkFailure(error)) throw toApiError(error);
    return backend();
  }
}

function toHistoricalOrderEntry(entry: HistoricalOrdersResponse[number]): HistoricalOrderEntry {
  return {
    order: entry.order,
    // The shared contract models historical orders only; any other processing
    // status is a live order and cannot appear on this endpoint.
    status: entry.status === "filled" ? "filled" : "canceled",
    statusTimestamp: entry.statusTimestamp,
  };
}

function toUserFundingEntry(entry: UserFundingResponse[number]): UserFundingEntry {
  return {
    time: entry.time,
    hash: entry.hash,
    delta: {
      type: entry.delta.type,
      coin: entry.delta.coin,
      usdc: entry.delta.usdc,
      szi: entry.delta.szi,
      fundingRate: entry.delta.fundingRate,
      nSamples: entry.delta.nSamples ?? 0,
    },
  };
}

export function getPortfolio(user: string): Promise<PortfolioResponse> {
  return readWithFallback<PortfolioResponse>(
    async () => {
      const data = await getInfoClient().portfolio({ user });
      ensureArrayResult(data, "portfolio");
      return data;
    },
    () => api.getPortfolio(user),
  );
}

export interface CandleSnapshotParams {
  readonly coin: string;
  readonly interval: WsMarketInterval;
  readonly startTime: number;
  readonly endTime: number;
}

/**
 * Direct `candleSnapshot` read. The caller owns the fallback route so a recent bootstrap
 * and an older backfill each return to the endpoint matching their window; an application
 * error rejects rather than resolving to an empty page.
 */
export function getCandleSnapshot(
  params: CandleSnapshotParams,
  backend: () => Promise<ChartDataPoint[]>,
): Promise<ChartDataPoint[]> {
  return readWithFallback<ChartDataPoint[]>(async () => {
    const data = await getInfoClient().candleSnapshot(params);
    ensureArrayResult(data, "candleSnapshot");
    return data.flatMap((candle) => normalizeCandle(candle) ?? []);
  }, backend);
}

/** Direct-only: third-party reads must never reach the authenticated backend route. */
async function readDirect<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    throw toApiError(error);
  }
}

export function getPortfolioPublic(user: string): Promise<PortfolioResponse> {
  return readDirect<PortfolioResponse>(async () => {
    const data = await getInfoClient().portfolio({ user });
    ensureArrayResult(data, "portfolio");
    return data;
  });
}

export function getClearinghouseStatePublic(user: string): Promise<ClearinghouseState> {
  return readDirect<ClearinghouseState>(async () => {
    const data = await getInfoClient().clearinghouseState({ user });
    const applicationError = applicationErrorMessage(data);
    if (applicationError !== null) throw new ApiError(applicationError);
    return data;
  });
}

export function getUserVaultEquitiesPublic(user: string): Promise<UserVaultEquity[]> {
  return readDirect<UserVaultEquity[]>(async () => {
    const data = await getInfoClient().userVaultEquities({ user });
    ensureArrayResult(data, "userVaultEquities");
    return data;
  });
}

export function getOpenOrdersPublic(user: string): Promise<OpenOrder[]> {
  return readDirect<OpenOrder[]>(async () => {
    const data = await getInfoClient().openOrders({ user });
    ensureArrayResult(data, "openOrders");
    return data;
  });
}

export function getSpotClearinghouseStatePublic(user: string): Promise<SpotClearinghouseState> {
  return readDirect<SpotClearinghouseState>(async () => {
    const data = await getInfoClient().spotClearinghouseState({ user });
    const applicationError = applicationErrorMessage(data);
    if (applicationError !== null) throw new ApiError(applicationError);
    // Outcome pseudo-balances carry no token address; the shared contract models
    // spot tokens only, so they are dropped rather than coerced.
    const balances = data.balances.flatMap((balance) =>
      "token" in balance
        ? [
            {
              coin: balance.coin,
              token: balance.token,
              total: balance.total,
              hold: balance.hold,
              entryNtl: balance.entryNtl,
            },
          ]
        : [],
    );
    return { balances };
  });
}

export function getUserFillsPublic(user: string): Promise<UserFill[]> {
  return readDirect<UserFill[]>(async () => {
    const data = await getInfoClient().userFills({ user });
    ensureArrayResult(data, "userFills");
    return data;
  });
}

export function getUserFundingPublic(
  user: string,
  startTime?: number,
  endTime?: number,
): Promise<UserFundingEntry[]> {
  const params: { user: string; startTime?: number; endTime?: number } = { user };
  if (startTime !== undefined) params.startTime = startTime;
  if (endTime !== undefined) params.endTime = endTime;

  return readDirect<UserFundingEntry[]>(async () => {
    const data = await getInfoClient().userFunding(params);
    ensureArrayResult(data, "userFunding");
    return data.map((entry) => toUserFundingEntry(entry));
  });
}

export function getHistoricalOrdersPublic(user: string): Promise<HistoricalOrderEntry[]> {
  return readDirect<HistoricalOrderEntry[]>(async () => {
    const data = await getInfoClient().historicalOrders({ user });
    ensureArrayResult(data, "historicalOrders");
    return data.map((entry) => toHistoricalOrderEntry(entry));
  });
}

export function getHistoricalOrders(user: string): Promise<HistoricalOrderEntry[]> {
  return readWithFallback<HistoricalOrderEntry[]>(
    async () => {
      const data = await getInfoClient().historicalOrders({ user });
      ensureArrayResult(data, "historicalOrders");
      return data.map((entry) => toHistoricalOrderEntry(entry));
    },
    () => api.getUserHistoricalOrders(user),
  );
}

export function getUserVaultEquities(user: string): Promise<UserVaultEquity[]> {
  return readWithFallback<UserVaultEquity[]>(
    async () => {
      const data = await getInfoClient().userVaultEquities({ user });
      ensureArrayResult(data, "userVaultEquities");
      return data;
    },
    () => api.getUserVaultEquities(user),
  );
}

export function getUserFunding(
  user: string,
  startTime?: number,
  endTime?: number,
): Promise<UserFundingEntry[]> {
  const params: { user: string; startTime?: number; endTime?: number } = { user };
  if (startTime !== undefined) params.startTime = startTime;
  if (endTime !== undefined) params.endTime = endTime;

  return readWithFallback<UserFundingEntry[]>(
    async () => {
      const data = await getInfoClient().userFunding(params);
      ensureArrayResult(data, "userFunding");
      return data.map((entry) => toUserFundingEntry(entry));
    },
    () => api.getUserFunding(user, startTime, endTime),
  );
}
