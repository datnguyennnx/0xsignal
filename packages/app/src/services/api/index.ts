// Public API surface — named exports only, no wildcard re-exports
export type { MarketPrice, UserFill, PlaceOrderRequest, UpdateLeverageRequest } from "./types";
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
import { listWallets, createWallet } from "./credentials";
import { getCalendar, getUpcomingCalendar } from "./calendar";
import { getPositions } from "./whales";

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
  calendar: {
    get: getCalendar,
    upcoming: getUpcomingCalendar,
  },
  whales: {
    positions: getPositions,
  },
};
