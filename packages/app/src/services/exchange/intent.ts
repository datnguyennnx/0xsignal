import type {
  OrderIntentRequest,
  OrderIntentResponse,
  OrderIntentValidation,
} from "@0xsignal/shared";

/** Mirrors the backend canonical form exactly; any drift changes the hash. */
export function canonicalIntent(input: OrderIntentRequest): string {
  return JSON.stringify({
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
}

export async function computeIntentHash(input: OrderIntentRequest): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalIntent(input));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class IntentHashMismatchError extends Error {
  constructor() {
    super("Refusing to sign: the order the backend recorded does not match what you entered.");
    this.name = "IntentHashMismatchError";
  }
}

export async function assertIntentHash(
  input: OrderIntentRequest,
  response: OrderIntentResponse,
): Promise<void> {
  const local = await computeIntentHash(input);
  if (local !== response.intentHash) throw new IntentHashMismatchError();
}

export interface IntentSummary {
  readonly symbol: string;
  readonly side: "buy" | "sell";
  readonly size: string;
  readonly price: string;
  readonly orderType: string;
  readonly timeInForce: string;
  readonly reduceOnly: boolean;
  readonly notionalUsd: number;
}

export function summarizeIntent(
  input: OrderIntentRequest,
  validated: OrderIntentValidation,
): IntentSummary {
  return {
    symbol: validated.symbol,
    side: input.side,
    size: input.size,
    price: input.price ?? "market",
    orderType: input.orderType,
    timeInForce: input.timeInForce ?? (input.orderType === "market" ? "FrontendMarket" : "GTC"),
    reduceOnly: input.reduceOnly ?? false,
    notionalUsd: validated.notionalUsd,
  };
}

export function formatConfirmation(
  summaries: readonly IntentSummary[],
  connectionId: string,
): string {
  const lines = ["Sign this Hyperliquid order?", ""];
  for (const summary of summaries) {
    lines.push(
      `Market:      ${summary.symbol}`,
      `Side:        ${summary.side.toUpperCase()}`,
      `Size:        ${summary.size}`,
      `Price:       ${summary.price}`,
      `Order type:  ${summary.orderType} (${summary.timeInForce})`,
      `Reduce only: ${summary.reduceOnly ? "yes" : "no"}`,
      `Notional:    ~$${summary.notionalUsd.toFixed(2)}`,
      "",
    );
  }
  lines.push(`connectionId: ${connectionId}`);
  return lines.join("\n");
}
