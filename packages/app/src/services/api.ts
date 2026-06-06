/**
 * Frontend HTTP client for backend market data APIs.
 */
import type {
  ApiErrorBody,
  ChartDataPoint,
  AggregatedMarket,
  MarketTicker,
  ApiEnvelope,
  ClearinghouseState,
  SpotClearinghouseState,
  OpenOrder,
  FrontendOpenOrder,
  HistoricalOrderEntry,
  UserFill,
  PlaceOrderRequest,
  UpdateLeverageRequest,
  CancelOrdersRequest,
} from "@0xsignal/shared";
import { normalizeCandle, normalizeChartDataPoints } from "@0xsignal/shared";
import { resolveApiBase, setAuthToken, apiFetch, UnauthenticatedError } from "@/lib/api-base";
import { normalizeSymbol } from "@/features/trade/lib/symbol";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_BASE = resolveApiBase(configuredApiUrl, import.meta.env.DEV);

// Re-export boundary types for consumers of this module.
export type { ChartDataPoint, AggregatedMarket, MarketTicker } from "@0xsignal/shared";
export type {
  ClearinghouseState,
  SpotClearinghouseState,
  OpenOrder,
  FrontendOpenOrder,
  HistoricalOrderEntry,
  UserFill,
} from "@0xsignal/shared";
export type {
  PlaceOrderRequest,
  UpdateLeverageRequest,
  CancelOrdersRequest,
} from "@0xsignal/shared";

// Portfolio & Vault API types

export interface PortfolioPeriod {
  readonly accountValueHistory: [number, string][];
  readonly pnlHistory: [number, string][];
  readonly vlm: string;
}

export type PortfolioPeriodKey =
  | "day"
  | "week"
  | "month"
  | "allTime"
  | "perpDay"
  | "perpWeek"
  | "perpMonth"
  | "perpAllTime";

/** 8-tuple matching Hyperliquid API shape: [periodKey, periodData] */
export type PortfolioResponse = readonly [
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
];

export interface UserVaultEquity {
  readonly vaultAddress: string;
  readonly equity: string;
  readonly lockedUntilTimestamp: number;
}

export interface UserFundingDelta {
  readonly type: "funding";
  readonly coin: string;
  readonly usdc: string;
  readonly szi: string;
  readonly fundingRate: string;
  readonly nSamples: number;
}

export interface UserFundingEntry {
  readonly time: number;
  readonly hash: string;
  readonly delta: UserFundingDelta;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

function toNumberOrNull(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRawCandlePayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.candles)) return obj.candles as Record<string, unknown>[];
    if (Array.isArray(obj.lane)) return obj.lane as Record<string, unknown>[];
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
  }
  return [];
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body;
  } catch {
    return null;
  }
}

function unwrapEnvelope<T>(json: unknown): T {
  if (json && typeof json === "object" && "data" in json) {
    return (json as ApiEnvelope<T>).data;
  }
  return json as T;
}

let activeRefreshPromise: Promise<boolean> | null = null;

async function attemptSilentRefresh(): Promise<boolean> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const body = await res.json();
        const data = body && typeof body === "object" && "data" in body ? (body as any).data : body;
        if (data && data.accessToken) {
          setAuthToken(data.accessToken);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

async function fetchJson<T>(url: string, options?: RequestInit, isRetry = false): Promise<T> {
  try {
    const response = await apiFetch(url, {
      credentials: "include",
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401 && !isRetry) {
        const refreshed = await attemptSilentRefresh();
        if (refreshed) {
          return fetchJson<T>(url, options, true);
        } else {
          setAuthToken(null);
        }
      }

      const errorBody = await parseErrorBody(response);
      throw new ApiError(
        errorBody?.error ?? `API request failed: ${response.statusText}`,
        response.status,
        response.statusText,
        errorBody?.code
      );
    }

    const body = await response.json();
    return unwrapEnvelope<T>(body);
  } catch (error) {
    if (error instanceof ApiError || error instanceof UnauthenticatedError) throw error;
    throw new NetworkError(error instanceof Error ? error.message : "Network request failed");
  }
}

/** Frontend-specific DTO assembled locally from ticker data. */
export interface MarketPrice {
  readonly symbol: string;
  readonly price: number;
  readonly change24h: number;
  readonly volume24h: number;
  readonly openInterest: number;
  readonly funding: number;
  readonly markPx: number;
  readonly midPx: number;
  readonly prevDayPx: number;
  readonly high24h?: number;
  readonly low24h?: number;
  readonly timestamp: Date;
}

export const api = {
  health: () => fetchJson(`${API_BASE}/health`),

  getMarkets: () => fetchJson<AggregatedMarket[]>(`${API_BASE}/markets`),

  getCandles: async (params: {
    symbol: string;
    interval: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<ChartDataPoint[]> => {
    const query = new URLSearchParams({
      symbol: normalizeSymbol(params.symbol),
      interval: params.interval,
    });

    if (params.startTime !== undefined) {
      query.set("start_time", new Date(params.startTime).toISOString());
    }
    if (params.endTime !== undefined) {
      query.set("end_time", new Date(params.endTime).toISOString());
    }
    if (params.limit !== undefined) {
      query.set("limit", String(params.limit));
    }

    const payload = await fetchJson(`${API_BASE}/candles?${query.toString()}`);
    const rawItems = extractRawCandlePayload(payload);
    return normalizeChartDataPoints(
      rawItems.map((item) => normalizeCandle(item)).filter((p): p is ChartDataPoint => p !== null)
    );
  },

  getRecentChartLane: async (params: {
    symbol: string;
    interval: string;
    limit?: number;
    endTime?: number;
  }): Promise<ChartDataPoint[]> => {
    const query = new URLSearchParams({
      symbol: normalizeSymbol(params.symbol),
      interval: params.interval,
    });

    if (params.limit !== undefined) {
      query.set("limit", String(params.limit));
    }
    if (params.endTime !== undefined) {
      query.set("end_time", new Date(params.endTime).toISOString());
    }

    const payload = await fetchJson(`${API_BASE}/candles/recent?${query.toString()}`);
    const rawItems = extractRawCandlePayload(payload);
    return normalizeChartDataPoints(
      rawItems.map((item) => normalizeCandle(item)).filter((p): p is ChartDataPoint => p !== null)
    );
  },

  getTicker: (symbol: string) =>
    fetchJson<MarketTicker>(
      `${API_BASE}/ticker?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`
    ),

  getOrderbook: (symbol: string, depth?: number) => {
    const query = new URLSearchParams({ symbol: normalizeSymbol(symbol) });
    if (depth !== undefined) query.set("depth", String(depth));
    return fetchJson(`${API_BASE}/orderbook?${query.toString()}`);
  },

  getTradeAnnotation: (symbol: string) =>
    fetchJson<{
      symbol: string;
      annotation?: {
        category?: string;
        description?: string;
        displayName?: string;
        keywords?: string[];
      } | null;
    }>(`${API_BASE}/trade-annotation?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`),

  getUserClearinghouseState: (walletAddress: string) =>
    fetchJson<ClearinghouseState>(
      `${API_BASE}/user/clearinghouse-state?walletAddress=${encodeURIComponent(walletAddress)}`
    ),

  getUserSpotClearinghouseState: (walletAddress: string) =>
    fetchJson<SpotClearinghouseState>(
      `${API_BASE}/user/spot-clearinghouse-state?walletAddress=${encodeURIComponent(walletAddress)}`
    ),

  getUserOpenOrders: (walletAddress: string) =>
    fetchJson<OpenOrder[]>(
      `${API_BASE}/user/open-orders?walletAddress=${encodeURIComponent(walletAddress)}`
    ),

  getUserFrontendOpenOrders: (walletAddress: string) =>
    fetchJson<FrontendOpenOrder[]>(
      `${API_BASE}/user/frontend-open-orders?walletAddress=${encodeURIComponent(walletAddress)}`
    ),

  getUserHistoricalOrders: (walletAddress: string) =>
    fetchJson<HistoricalOrderEntry[]>(
      `${API_BASE}/user/historical-orders?walletAddress=${encodeURIComponent(walletAddress)}`
    ),

  getUserFills: (walletAddress: string) =>
    fetchJson<UserFill[]>(
      `${API_BASE}/user/fills?walletAddress=${encodeURIComponent(walletAddress)}`
    ),

  getPortfolio: (walletAddress: string) =>
    fetchJson<PortfolioResponse>(
      `${API_BASE}/user/portfolio?walletAddress=${encodeURIComponent(walletAddress)}`
    ),

  getUserVaultEquities: (walletAddress: string) =>
    fetchJson<UserVaultEquity[]>(
      `${API_BASE}/user/vault-equities?walletAddress=${encodeURIComponent(walletAddress)}`
    ),

  getUserFunding: (walletAddress: string, startTime?: number, endTime?: number) => {
    const query = new URLSearchParams({ walletAddress });
    if (startTime !== undefined) query.set("startTime", String(startTime));
    if (endTime !== undefined) query.set("endTime", String(endTime));
    const qs = query.toString();
    return fetchJson<UserFundingEntry[]>(`${API_BASE}/user/funding?${qs}`);
  },

  placeOrder: (params: PlaceOrderRequest) =>
    fetchJson(`${API_BASE}/exchange/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }),

  updateLeverage: (params: UpdateLeverageRequest) =>
    fetchJson(`${API_BASE}/exchange/leverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }),

  cancelOrders: (params: CancelOrdersRequest) =>
    fetchJson(`${API_BASE}/exchange/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }),

  getMarketPrice: async (symbol: string): Promise<MarketPrice> => {
    const normalizedSymbol = normalizeSymbol(symbol);
    let markPx = 0;
    let midPx = 0;
    let prevDayPx = 0;
    let volume24h = 0;
    let openInterest = 0;
    let funding = 0;
    let resolvedSymbol = normalizedSymbol;

    try {
      const ticker = await api.getTicker(normalizedSymbol);

      const mid = toNumberOrNull(ticker.mid ?? ticker.midPx ?? ticker.markPx) ?? 0;
      markPx = toNumberOrNull(ticker.markPx) ?? mid;
      midPx = toNumberOrNull(ticker.midPx) ?? mid;
      prevDayPx = toNumberOrNull(ticker.prevDayPx) ?? markPx;
      volume24h = toNumberOrNull(ticker.dayNtlVlm) ?? 0;
      openInterest = toNumberOrNull(ticker.openInterest) ?? 0;
      funding = toNumberOrNull(ticker.funding) ?? 0;
      resolvedSymbol =
        typeof ticker.symbol === "string" && ticker.symbol.trim().length > 0
          ? ticker.symbol
          : normalizedSymbol;
    } catch (err) {
      // Graceful fallback for builder perps not in main perp universe
      console.warn("Ticker fetch failed for", normalizedSymbol, err);
    }

    const price = markPx || midPx;
    const change24h = prevDayPx > 0 ? ((price - prevDayPx) / prevDayPx) * 100 : 0;

    return {
      symbol: resolvedSymbol,
      price,
      change24h,
      volume24h,
      openInterest,
      funding,
      markPx,
      midPx,
      prevDayPx,
      high24h: undefined,
      low24h: undefined,
      timestamp: new Date(),
    };
  },

  /** Check current auth session — returns user info if authenticated, throws 401 if not */
  getAuthMe: () =>
    fetchJson<{
      userId: string;
      provider: string;
      avatarUrl: string | null;
      displayName: string | null;
    }>(`${API_BASE}/auth/me`),

  /** Logout — revoke refresh token on server */
  logout: () =>
    fetchJson(`${API_BASE}/auth/logout`, {
      method: "POST",
    }),

  /** Update the current user's profile. */
  updateProfile: (params: { displayName: string }) =>
    fetchJson<{
      data: {
        userId: string;
        provider: string;
        avatarUrl: string | null;
        displayName: string | null;
      };
    }>(`${API_BASE}/auth/me/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }),

  exchangeCode: (code: string) =>
    fetchJson<{ accessToken: string; tokenType: "Bearer"; expiresIn: number }>(
      `${API_BASE}/auth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }
    ),

  refreshToken: () =>
    fetchJson<{ accessToken: string; tokenType: "Bearer"; expiresIn: number }>(
      `${API_BASE}/auth/refresh`,
      {
        method: "POST",
      }
    ),

  // Exchange Credentials API

  /** Create a key credential for an exchange wallet. */
  createCredential: (params: {
    accountId: string;
    agentAddress: string;
    agentPrivateKey: string;
    label?: string;
  }) =>
    fetchJson<{ credentialId: string; agentAddress: string; isVerified: boolean }>(
      `${API_BASE}/wallets/${params.accountId}/keys`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentAddress: params.agentAddress,
          agentPrivateKey: params.agentPrivateKey,
          label: params.label,
        }),
      }
    ),

  /** List credentials for a wallet. */
  listCredentials: (accountId: string) =>
    fetchJson<
      Array<{
        id: string;
        label: string;
        agentAddress: string;
        permissions: string[];
        isVerified: boolean;
        verifiedAt: string | null;
        createdAt: string;
        expiresAt: string | null;
        isRevoked: boolean;
      }>
    >(`${API_BASE}/wallets/${accountId}/keys`),

  /** Revoke / delete a credential by ID. */
  revokeCredential: (accountId: string, credentialId: string) =>
    fetchJson<void>(`${API_BASE}/wallets/${accountId}/keys/${credentialId}`, {
      method: "DELETE",
    }),

  /** Verify credential connectivity with the exchange. */
  verifyCredential: (accountId: string, credentialId: string) =>
    fetchJson<{ isVerified: boolean; verifiedAt: string }>(
      `${API_BASE}/wallets/${accountId}/keys/${credentialId}/verify`,
      {
        method: "POST",
      }
    ),

  // Wallet Linking API

  /** List wallets linked to the current user's account. */
  listWallets: () =>
    fetchJson<
      Array<{
        id: string;
        walletAddress: string;
        label: string;
        isPrimary: boolean;
      }>
    >(`${API_BASE}/wallets`),

  /** Link a wallet address to the current user's account. */
  createWallet: (params: { walletAddress: string; label?: string }) =>
    fetchJson<{ accountId: string; walletAddress: string; isPrimary: boolean }>(
      `${API_BASE}/wallets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchangeSlug: "hyperliquid",
          walletAddress: params.walletAddress,
          label: params.label,
        }),
      }
    ),
};
