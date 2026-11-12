import {
  HttpError,
  HyperliquidError,
  InfoClient,
  Transport,
  TransportError,
  ValidationError,
  cast,
} from "@0xsignal/sdk-hyperliquid";
import type {
  ClearinghouseStateInfoResponse,
  HistoricalOrdersInfoResponse,
  PortfolioInfoResponse,
  UserFundingInfoResponse,
  UserVaultEquitiesInfoResponse,
} from "@0xsignal/sdk-hyperliquid/info";
import {
  normalizeCandle,
  type ChartDataPoint,
  type ClearinghouseState,
  type HistoricalOrderEntry,
  type OpenOrder,
  type PortfolioPeriod,
  type PortfolioPeriodKey,
  type PortfolioResponse,
  type SpotClearinghouseState,
  type UserFill,
  type UserFundingEntry,
  type UserVaultEquity,
  type WsMarketInterval,
} from "@0xsignal/shared";
import { ApiError, VALIDATION_ERROR_CODE } from "@/lib/api-error";
import { backendReads, readWithFallback } from "./hl-fallback";

/**
 * Browser-direct Hyperliquid REST reads.
 *
 * These four endpoints are pure passthroughs, so each tab can call them itself
 * and the backend stops paying upstream cost per user. Every call keeps the
 * backend route as a fallback for transport failures only.
 */

const HL_INFO_URL = "https://api.hyperliquid.xyz";
const REQUEST_TIMEOUT_MS = 10_000;

let infoClient: InfoClient | null = null;

/** One client for the tab's lifetime: the SDK transport owns no per-call state. */
function getInfoClient(): InfoClient {
  infoClient ??= new InfoClient(
    new Transport({
      baseUrl: HL_INFO_URL,
      timeoutMs: REQUEST_TIMEOUT_MS,
      retries: 0,
      fetchImpl: applicationErrorFetch,
    }),
  );
  return infoClient;
}

/** Anything that is not an SDK HTTP or validation failure means the request never reached Hyperliquid. */
function isNetworkFailure(error: unknown): boolean {
  if (error instanceof ApiError) return false;
  if (error instanceof HyperliquidError) return error instanceof TransportError;
  return true;
}

/** `null` means "retry through the backend"; anything else is the answer to surface. */
function classifyReadFailure(error: unknown): Error | null {
  return isNetworkFailure(error) ? null : toApiError(error);
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpError) {
    const message = applicationErrorMessage(parseJson(error.body));
    return new ApiError(message ?? error.message, error.status);
  }
  if (error instanceof TransportError) return new ApiError(error.message);
  if (error instanceof ValidationError) {
    return new ApiError(error.message, undefined, undefined, VALIDATION_ERROR_CODE);
  }
  return new ApiError(error instanceof Error ? error.message : "Hyperliquid read failed");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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

const applicationErrorFetch = cast<typeof fetch>(
  async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const response = await globalThis.fetch(input, init);
    if (!response.ok) return response;
    const body = await response.clone().text();
    if (applicationErrorMessage(parseJson(body)) === null) return response;
    throw new HttpError(response.status, body);
  },
  "fetchImpl",
);

function ensureArrayResult(payload: unknown, operation: string): void {
  const applicationError = applicationErrorMessage(payload);
  if (applicationError !== null) throw new ApiError(applicationError);
  if (!Array.isArray(payload)) throw new ApiError(`${operation}: unexpected Hyperliquid response`);
}

function toHistoricalOrderEntry(entry: HistoricalOrdersInfoResponse[number]): HistoricalOrderEntry {
  return {
    order: entry.order,
    // The shared contract models historical orders only; any other processing
    // status is a live order and cannot appear on this endpoint.
    status: entry.status === "filled" ? "filled" : "canceled",
    statusTimestamp: entry.statusTimestamp,
  };
}

function toUserFundingEntry(entry: UserFundingInfoResponse[number]): UserFundingEntry {
  return {
    time: entry.time,
    hash: entry.hash,
    delta: {
      type: entry.delta.type,
      coin: entry.delta.coin,
      usdc: entry.delta.usdc,
      szi: entry.delta.szi,
      fundingRate: entry.delta.fundingRate,
      nSamples: entry.delta.nSamples,
    },
  };
}

function userFundingParams(
  user: string,
  startTime: number | undefined,
  endTime: number | undefined,
): { user: string; startTime: number; endTime?: number } {
  const params: { user: string; startTime: number; endTime?: number } = {
    user,
    startTime: startTime ?? 0,
  };
  if (endTime !== undefined) params.endTime = endTime;
  return params;
}

function toPortfolioPeriod([key, period]: PortfolioInfoResponse[number]): readonly [
  PortfolioPeriodKey,
  PortfolioPeriod,
] {
  return [
    key,
    {
      accountValueHistory: period.accountValueHistory.map(([time, value]): [number, string] => [
        time,
        value,
      ]),
      pnlHistory: period.pnlHistory.map(([time, value]): [number, string] => [time, value]),
      vlm: period.vlm,
    },
  ];
}

function toPortfolioResponse(entries: PortfolioInfoResponse): PortfolioResponse {
  return entries.map((entry) => toPortfolioPeriod(entry));
}

function toClearinghouseState(state: ClearinghouseStateInfoResponse): ClearinghouseState {
  return {
    marginSummary: state.marginSummary,
    crossMarginSummary: state.crossMarginSummary,
    crossMaintenanceMarginUsed: state.crossMaintenanceMarginUsed,
    withdrawable: state.withdrawable,
    time: state.time,
    assetPositions: state.assetPositions.map(({ type, position }) => ({
      type,
      position: {
        ...position,
        leverage:
          position.leverage.type === "isolated"
            ? {
                type: "isolated",
                value: position.leverage.value,
                rawUsd: position.leverage.rawUsd,
              }
            : { type: "cross", value: position.leverage.value },
      },
    })),
  };
}

function toUserVaultEquity(entry: UserVaultEquitiesInfoResponse[number]): UserVaultEquity {
  return {
    vaultAddress: entry.vaultAddress,
    equity: entry.equity,
  };
}

export function getPortfolio(user: string): Promise<PortfolioResponse> {
  return readWithFallback<PortfolioResponse>(
    async () => {
      const data = await getInfoClient().portfolio({ user });
      ensureArrayResult(data, "portfolio");
      return toPortfolioResponse(data);
    },
    () => backendReads.portfolio(user),
    classifyReadFailure,
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
  return readWithFallback<ChartDataPoint[]>(
    async () => {
      const data = await getInfoClient().candleSnapshot({ req: params });
      ensureArrayResult(data, "candleSnapshot");
      return data.flatMap((candle) => normalizeCandle(candle) ?? []);
    },
    backend,
    classifyReadFailure,
  );
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
    return toPortfolioResponse(data);
  });
}

export function getClearinghouseStatePublic(user: string): Promise<ClearinghouseState> {
  return readDirect<ClearinghouseState>(async () => {
    const data = await getInfoClient().clearinghouseState({ user });
    const applicationError = applicationErrorMessage(data);
    if (applicationError !== null) throw new ApiError(applicationError);
    return toClearinghouseState(data);
  });
}

export function getUserVaultEquitiesPublic(user: string): Promise<UserVaultEquity[]> {
  return readDirect<UserVaultEquity[]>(async () => {
    const data = await getInfoClient().userVaultEquities({ user });
    ensureArrayResult(data, "userVaultEquities");
    return data.map((entry) => toUserVaultEquity(entry));
  });
}

export function getOpenOrdersPublic(user: string): Promise<OpenOrder[]> {
  return readDirect<OpenOrder[]>(async () => {
    const data = await getInfoClient().openOrders({ user });
    ensureArrayResult(data, "openOrders");
    return [...data];
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
    return [...data];
  });
}

export function getUserFundingPublic(
  user: string,
  startTime?: number,
  endTime?: number,
): Promise<UserFundingEntry[]> {
  const params = userFundingParams(user, startTime, endTime);

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
    () => backendReads.userHistoricalOrders(user),
    classifyReadFailure,
  );
}

export function getUserVaultEquities(user: string): Promise<UserVaultEquity[]> {
  return readWithFallback<UserVaultEquity[]>(
    async () => {
      const data = await getInfoClient().userVaultEquities({ user });
      ensureArrayResult(data, "userVaultEquities");
      return data.map((entry) => toUserVaultEquity(entry));
    },
    () => backendReads.userVaultEquities(user),
    classifyReadFailure,
  );
}

export function getUserFunding(
  user: string,
  startTime?: number,
  endTime?: number,
): Promise<UserFundingEntry[]> {
  const params = userFundingParams(user, startTime, endTime);

  return readWithFallback<UserFundingEntry[]>(
    async () => {
      const data = await getInfoClient().userFunding(params);
      ensureArrayResult(data, "userFunding");
      return data.map((entry) => toUserFundingEntry(entry));
    },
    () => backendReads.userFunding(user, startTime, endTime),
    classifyReadFailure,
  );
}
