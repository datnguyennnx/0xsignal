import { API_BASE, fetchJson } from "./client";
import type {
  ClearinghouseState,
  SpotClearinghouseState,
  FrontendOpenOrder,
  HistoricalOrderEntry,
  UserFill,
  PortfolioResponse,
  UserVaultEquity,
  UserFundingEntry,
} from "./types";

export function getUserClearinghouseState(walletAddress: string) {
  return fetchJson<ClearinghouseState>(
    `${API_BASE}/user/clearinghouse-state?walletAddress=${encodeURIComponent(walletAddress)}`,
  );
}

export function getUserSpotClearinghouseState(walletAddress: string) {
  return fetchJson<SpotClearinghouseState>(
    `${API_BASE}/user/spot-clearinghouse-state?walletAddress=${encodeURIComponent(walletAddress)}`,
  );
}

export function getUserFrontendOpenOrders(walletAddress: string) {
  return fetchJson<FrontendOpenOrder[]>(
    `${API_BASE}/user/frontend-open-orders?walletAddress=${encodeURIComponent(walletAddress)}`,
  );
}

export function getUserHistoricalOrders(walletAddress: string) {
  return fetchJson<HistoricalOrderEntry[]>(
    `${API_BASE}/user/historical-orders?walletAddress=${encodeURIComponent(walletAddress)}`,
  );
}

export function getUserFills(walletAddress: string) {
  return fetchJson<UserFill[]>(
    `${API_BASE}/user/fills?walletAddress=${encodeURIComponent(walletAddress)}`,
  );
}

export function getPortfolio(walletAddress: string) {
  return fetchJson<PortfolioResponse>(
    `${API_BASE}/user/portfolio?walletAddress=${encodeURIComponent(walletAddress)}`,
  );
}

export function getUserVaultEquities(walletAddress: string) {
  return fetchJson<UserVaultEquity[]>(
    `${API_BASE}/user/vault-equities?walletAddress=${encodeURIComponent(walletAddress)}`,
  );
}

export function getUserFunding(walletAddress: string, startTime?: number, endTime?: number) {
  const query = new URLSearchParams({ walletAddress });
  if (startTime !== undefined) query.set("startTime", String(startTime));
  if (endTime !== undefined) query.set("endTime", String(endTime));
  const qs = query.toString();
  return fetchJson<UserFundingEntry[]>(`${API_BASE}/user/funding?${qs}`);
}
