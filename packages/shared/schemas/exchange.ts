/**
 * Shared boundary types for exchange operations.
 *
 * Replaces duplicated frontend manual types and backend ad-hoc body shapes.
 */

// ─── Place Order ──────────────────────────────────────────────────────────────

export interface LimitInstruction {
  readonly limit: {
    readonly tif: "Gtc" | "Ioc" | "Alo" | "FrontendMarket";
  };
}

export interface TriggerInstruction {
  readonly trigger: {
    readonly isMarket: boolean;
    readonly triggerPx: string;
    readonly tpsl: "tp" | "sl";
  };
}

export type OrderInstruction = LimitInstruction | TriggerInstruction;

export interface PlaceOrderEntry {
  readonly a: number;
  readonly b: boolean;
  readonly p: string;
  readonly s: string;
  readonly r: boolean;
  readonly t: OrderInstruction;
}

export interface PlaceOrderRequest {
  readonly orders: PlaceOrderEntry[];
  readonly grouping?: "na" | "normalTpsl" | "positionTpsl";
}

// ─── Update Leverage ──────────────────────────────────────────────────────────

export interface UpdateLeverageRequest {
  readonly asset: number;
  readonly isCross: boolean;
  readonly leverage: number;
}

// ─── Cancel Orders ────────────────────────────────────────────────────────────

export interface CancelEntry {
  readonly coin: string;
  readonly o: number;
}

export interface CancelOrdersRequest {
  readonly cancels: CancelEntry[];
}
