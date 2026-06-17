// Re-export everything for direct imports
export * from "./client";
export * from "./types";
export * from "./market";
export * from "./user";
export * from "./auth";
export * from "./credentials";
export * from "./exchange";

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
