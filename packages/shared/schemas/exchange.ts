/**
 * Shared boundary types for exchange operations.
 *
 * Replaces duplicated frontend manual types and backend ad-hoc body shapes.
 */

// Order Side

export type OrderSide = "buy" | "sell";

export type TimeInForce = "GTC" | "IOC" | "FOK" | "Alo" | "FrontendMarket";

// Order Type

export type OrderType =
  | {
      readonly kind: "limit";
      readonly timeInForce: TimeInForce;
    }
  | {
      readonly kind: "trigger";
      readonly isMarket: boolean;
      readonly triggerPrice: string;
      readonly tpsl: "tp" | "sl";
    };

// Place Order

export interface PlaceOrderEntry {
  readonly symbol: string;
  readonly side: OrderSide;
  readonly quantity: string;
  readonly price: string;
  readonly reduceOnly: boolean;
  readonly orderType: OrderType;
}

export interface PlaceOrderRequest {
  readonly orders: PlaceOrderEntry[];
  readonly grouping?: "na" | "normalTpsl" | "positionTpsl" | undefined;
}

// Update Leverage

export interface UpdateLeverageRequest {
  readonly symbol: string;
  readonly isCross: boolean;
  readonly leverage: number;
}

// Cancel Orders

export interface CancelEntry {
  readonly symbol: string;
  readonly orderId: number;
}

export interface CancelOrdersRequest {
  readonly cancels: CancelEntry[];
}

// Order Intent (unsigned, recorded before the browser signs)

export type OrderIntentOrderType = "limit" | "market";

export type OrderIntentStatus = "pending" | "submitted" | "rejected" | "expired";

export interface OrderIntentRequest {
  readonly symbol: string;
  readonly side: OrderSide;
  readonly size: string;
  readonly price: string | null;
  readonly orderType: OrderIntentOrderType;
  readonly timeInForce?: TimeInForce | undefined;
  readonly reduceOnly?: boolean | undefined;
  readonly slippageBps?: number | undefined;
  readonly leverage?: number | undefined;
}

export interface OrderIntentValidation {
  readonly assetIndex: number;
  readonly symbol: string;
  readonly sizeDecimals: number;
  readonly priceDecimals: number;
  readonly notionalUsd: number;
}

export interface OrderIntentResponse {
  readonly intentId: string;
  readonly intentHash: string;
  readonly validated: OrderIntentValidation;
}

export type OrderIntentResultRequest = { readonly txHash: string } | { readonly error: string };

export interface OrderIntentResultResponse {
  readonly intentId: string;
  readonly status: OrderIntentStatus;
  readonly txHash: string | null;
  readonly error: string | null;
}
