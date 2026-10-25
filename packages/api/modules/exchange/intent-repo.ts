import { Context, Data, type Effect } from "effect";
import type { OrderIntentStatus } from "@0xsignal/shared";

export class OrderIntentRepoError extends Data.TaggedError("OrderIntentRepoError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type OrderIntentRecord = {
  readonly id: string;
  readonly userId: string;
  readonly intentHash: string;
  readonly symbol: string;
  readonly side: "buy" | "sell";
  readonly size: string;
  readonly price: string | null;
  readonly orderType: "limit" | "market";
  readonly reduceOnly: boolean;
  readonly status: OrderIntentStatus;
  readonly txHash: string | null;
  readonly error: string | null;
  readonly createdAt: string;
};

export type NewOrderIntentRecord = {
  readonly userId: string;
  readonly intentHash: string;
  readonly symbol: string;
  readonly side: "buy" | "sell";
  readonly size: string;
  readonly price: string | null;
  readonly orderType: "limit" | "market";
  readonly timeInForce: string | null;
  readonly reduceOnly: boolean;
  readonly slippageBps: number | null;
  readonly leverage: number | null;
  readonly createdAt: string;
};

export type OrderIntentClose = {
  readonly status: "submitted" | "rejected";
  readonly txHash: string | null;
  readonly error: string | null;
};

export interface OrderIntentRepoPort {
  readonly insert: (
    intent: NewOrderIntentRecord,
  ) => Effect.Effect<OrderIntentRecord, OrderIntentRepoError>;

  readonly findById: (
    id: string,
    userId: string,
  ) => Effect.Effect<OrderIntentRecord | null, OrderIntentRepoError>;

  readonly markExpired: (
    id: string,
    userId: string,
    nowMillis: number,
  ) => Effect.Effect<OrderIntentRecord | null, OrderIntentRepoError>;

  readonly closePending: (
    id: string,
    userId: string,
    close: OrderIntentClose,
    nowMillis: number,
  ) => Effect.Effect<OrderIntentRecord | null, OrderIntentRepoError>;
}

export class OrderIntentRepo extends Context.Service<OrderIntentRepo, OrderIntentRepoPort>()(
  "OrderIntentRepo",
) {}
