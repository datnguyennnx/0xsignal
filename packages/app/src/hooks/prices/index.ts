/**
 * @overview Market Data Hooks
 *
 * Logic for fetching and caching global market stats and top cryptocurrency prices.
 * Uses TanStack Query for caching and stale-while-revalidate strategy.
 *
 * @strategy Uses placeholder data for an "instant-on" UI feel before network requests complete.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { CryptoPrice, GlobalMarketData } from "@0xsignal/shared";
import { queryKeys } from "@/lib/query/query-keys";
import { getQueryOptions } from "@/lib/query/client";

// Placeholder data cho UI load nhanh
const placeholderPrices: CryptoPrice[] = [];

const placeholderGlobalMarket: GlobalMarketData = {
  totalMarketCap: 0,
  totalVolume24h: 0,
  btcDominance: 0,
  ethDominance: 0,
  marketCapChange24h: 0,
  activeCryptocurrencies: 0,
  markets: 0,
  updatedAt: Date.now(),
};

// Lấy danh sách giá crypto
export function usePrices(limit = 100) {
  return useQuery({
    queryKey: queryKeys.prices.list(limit),
    queryFn: () => api.getTopCryptos(limit),
    ...getQueryOptions.prices,
    placeholderData: placeholderPrices,
  });
}

// Lấy thông tin thị trường toàn cầu
export function useGlobalMarket() {
  return useQuery({
    queryKey: queryKeys.globalMarket.overview(),
    queryFn: () => api.getGlobalMarket(),
    ...getQueryOptions.globalMarket,
    placeholderData: placeholderGlobalMarket,
  });
}
