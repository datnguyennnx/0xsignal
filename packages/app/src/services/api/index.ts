// Public API surface — named exports only, no wildcard re-exports
export type { MarketPrice, PlaceOrderRequest, UpdateLeverageRequest } from "./types";
export type { AgentRegistration } from "./credentials";
export { ApiError } from "@/lib/api-error";

import {
  getMarkets,
  getCandles,
  getRecentChartLane,
  getTicker,
  getTradeAnnotation,
  getMarketPrice,
} from "./market";
import {
  getUserClearinghouseState,
  getUserSpotClearinghouseState,
  getUserFrontendOpenOrders,
  getUserHistoricalOrders,
  getUserFills,
  getPortfolio,
  getUserVaultEquities,
  getUserFunding,
} from "./user";
import { exchangeCode, getAuthMe, logout, updateProfile, refreshToken } from "./auth";
import {
  listWallets,
  createWallet,
  requestWalletChallenge,
  listAgentRegistrations,
} from "./credentials";

export const api = {
  getMarkets,
  getCandles,
  getRecentChartLane,
  getTicker,
  getTradeAnnotation,
  getMarketPrice,
  getUserClearinghouseState,
  getUserSpotClearinghouseState,
  getUserFrontendOpenOrders,
  getUserHistoricalOrders,
  getUserFills,
  getPortfolio,
  getUserVaultEquities,
  getUserFunding,
  exchangeCode,
  getAuthMe,
  logout,
  updateProfile,
  refreshToken,
  listWallets,
  createWallet,
  requestWalletChallenge,
  listAgentRegistrations,
};
