/** Provider-agnostic exchange execution types */

export type OrderSide = "buy" | "sell";

export type OrderType =
  | {
      readonly kind: "limit";
      readonly timeInForce: "GTC" | "IOC" | "FOK" | "Alo" | "FrontendMarket";
    }
  | {
      readonly kind: "trigger";
      readonly isMarket: boolean;
      readonly triggerPrice: string;
      readonly tpsl: "tp" | "sl";
    };

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
  readonly grouping?: "na" | "normalTpsl" | "positionTpsl";
}

export interface UpdateLeverageRequest {
  readonly symbol: string;
  readonly isCross: boolean;
  readonly leverage: number;
}

export interface CancelEntry {
  readonly symbol: string;
  readonly orderId: number;
}

export interface CancelOrdersRequest {
  readonly cancels: CancelEntry[];
}
