import { API_BASE, fetchJson } from "./client";
import type { PlaceOrderRequest, UpdateLeverageRequest, CancelOrdersRequest } from "./types";

export function placeOrder(params: PlaceOrderRequest) {
  return fetchJson(`${API_BASE}/exchange/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function updateLeverage(params: UpdateLeverageRequest) {
  return fetchJson(`${API_BASE}/exchange/leverage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function cancelOrders(params: CancelOrdersRequest) {
  return fetchJson(`${API_BASE}/exchange/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}
