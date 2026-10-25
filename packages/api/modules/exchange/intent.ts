import { createHash } from "node:crypto";
import type { OrderIntentRequest } from "@0xsignal/shared";

export const INTENT_TTL_MS = 2 * 60 * 1000;

/** Terminal intents are audit history, not live state: keep one bounded window. */
export const ORDER_INTENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const canonicalIntent = (input: OrderIntentRequest): string =>
  JSON.stringify({
    symbol: input.symbol,
    side: input.side,
    size: input.size,
    price: input.price,
    orderType: input.orderType,
    timeInForce: input.timeInForce ?? null,
    reduceOnly: input.reduceOnly ?? false,
    slippageBps: input.slippageBps ?? null,
    leverage: input.leverage ?? null,
  });

export const hashIntent = (input: OrderIntentRequest): string =>
  createHash("sha256").update(canonicalIntent(input)).digest("hex");

export const isIntentExpired = (createdAt: string, nowMillis: number): boolean =>
  nowMillis - Date.parse(createdAt) >= INTENT_TTL_MS;
