// API Client - Simple async functions
import type {
  ChartDataPoint,
  GlobalMarketData,
  OpenInterestData,
  FundingRateData,
  CryptoPrice,
} from "@0xsignal/shared";

const API_BASE = import.meta.env.DEV ? "/api" : "http://localhost:9006/api";

export type { ChartDataPoint };

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string
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

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new ApiError(
        `API request failed: ${response.statusText}`,
        response.status,
        response.statusText
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new NetworkError(error instanceof Error ? error.message : "Network request failed");
  }
}

export const api = {
  health: () => fetchJson(`${API_BASE}/health`),

  getGlobalMarket: () => fetchJson<GlobalMarketData>(`${API_BASE}/global`),

  getTopCryptos: (limit = 100) => fetchJson<CryptoPrice[]>(`${API_BASE}/prices?limit=${limit}`),

  getCryptoPrice: (symbol: string) => fetchJson<CryptoPrice>(`${API_BASE}/prices/${symbol}`),

  getTopOpenInterest: (limit = 20) =>
    fetchJson<OpenInterestData[]>(`${API_BASE}/derivatives/open-interest?limit=${limit}`),

  getOpenInterest: (symbol: string) =>
    fetchJson<OpenInterestData>(`${API_BASE}/derivatives/${symbol}/open-interest`),

  getFundingRate: (symbol: string) =>
    fetchJson<FundingRateData>(`${API_BASE}/derivatives/${symbol}/funding-rate`),
};
