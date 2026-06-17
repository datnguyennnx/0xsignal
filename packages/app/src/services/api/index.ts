// Public API surface — named exports only, no wildcard re-exports
export type { MarketPrice, UserFill, PlaceOrderRequest, UpdateLeverageRequest } from "./types";
export { fetchJson, ApiError, NetworkError } from "./client";
export { UnauthenticatedError } from "@/lib/api-base";
export {
  getMarkets,
  getCandles,
  getRecentChartLane,
  getTicker,
  getOrderbook,
  getTradeAnnotation,
  getMarketPrice,
} from "./market";
export {
  getUserClearinghouseState,
  getUserSpotClearinghouseState,
  getUserFrontendOpenOrders,
  getUserHistoricalOrders,
  getUserFills,
  getPortfolio,
  getUserVaultEquities,
  getUserFunding,
} from "./user";
export { exchangeCode, getAuthMe, logout, updateProfile, refreshToken } from "./auth";
export { createCredential, listWallets, createWallet } from "./credentials";
export { placeOrder, updateLeverage, cancelOrders } from "./exchange";

import {
  getMarkets,
  getCandles,
  getRecentChartLane,
  getTicker,
  getOrderbook,
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
import { createCredential, listWallets, createWallet } from "./credentials";
import { placeOrder, updateLeverage, cancelOrders } from "./exchange";

export const api = {
  getMarkets,
  getCandles,
  getRecentChartLane,
  getTicker,
  getOrderbook,
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
  createCredential,
  listWallets,
  createWallet,
  placeOrder,
  updateLeverage,
  cancelOrders,
};
