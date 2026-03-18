// API Client - Simple async functions
import type { ChartDataPoint, GlobalMarketData, CryptoPrice } from "@0xsignal/shared";
import { hyperliquidApi } from "./hyperliquid";

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

export interface FuturesPrice {
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

  getGlobalMarket: () => fetchJson<GlobalMarketData>(`${API_BASE}/global`),

  getTopCryptos: (limit = 100) => fetchJson<CryptoPrice[]>(`${API_BASE}/prices?limit=${limit}`),

  getFuturesPrice: async (symbol: string): Promise<FuturesPrice> => {
    const searchSymbol = symbol.toUpperCase().trim();

    const [allMids, metaAndAssetCtxs] = await Promise.all([
      hyperliquidApi.getAllMids(),
      hyperliquidApi.getMetaAndAssetCtxs(),
    ]);

    if (!allMids || typeof allMids !== "object") {
      throw new ApiError("Failed to fetch prices from Hyperliquid", 500);
    }

    const [meta, assetCtxs] = metaAndAssetCtxs;

    if (!meta || !meta.universe) {
      throw new ApiError("Failed to fetch asset metadata from Hyperliquid", 500);
    }

    const universe = meta.universe;
    const perpSymbols = universe.map((u) => u.name);

    let coinIndex = universe.findIndex((u) => u.name === searchSymbol);
    if (coinIndex === -1) {
      coinIndex = universe.findIndex((u) => u.name.toUpperCase() === searchSymbol);
    }
    if (coinIndex === -1) {
      throw new ApiError(
        `"${symbol}" is not a perpetual. Available: ${perpSymbols.slice(0, 15).join(", ")}...`,
        404
      );
    }

    const coinName = universe[coinIndex].name;
    const mid = allMids[coinName];
    if (!mid) {
      throw new ApiError(`No price data for ${coinName}`, 500);
    }

    const ctx = assetCtxs[coinIndex];
    if (!ctx) {
      throw new ApiError(`No asset context for ${coinName}`, 404);
    }

    const price = parseFloat(ctx.markPx || ctx.midPx || mid);
    const prevDayPx = parseFloat(ctx.prevDayPx);
    const change24h = prevDayPx > 0 ? ((price - prevDayPx) / prevDayPx) * 100 : 0;

    return {
      symbol: coinName,
      price,
      change24h,
      volume24h: parseFloat(ctx.dayNtlVlm || "0"),
      openInterest: parseFloat(ctx.openInterest || "0"),
      funding: parseFloat(ctx.funding || "0"),
      markPx: parseFloat(ctx.markPx || mid),
      midPx: parseFloat(ctx.midPx || mid),
      prevDayPx,
      high24h: undefined,
      low24h: undefined,
      timestamp: new Date(),
    };
  },
};
