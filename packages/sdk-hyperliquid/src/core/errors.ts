/**
 * @hyperliquid-api (core) POST /info, POST /exchange
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

export abstract class HyperliquidError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = new.target.name;
  }
}

export class ValidationError extends HyperliquidError {
  readonly path: string;
  readonly expected: string;

  constructor(path: string, expected: string) {
    super("VALIDATION", `${path}: expected ${expected}`);
    this.path = path;
    this.expected = expected;
  }
}

export class HttpError extends HyperliquidError {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super("HTTP", `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export class TransportError extends HyperliquidError {
  constructor(cause: unknown) {
    super("TRANSPORT", cause instanceof Error ? cause.message : "Transport failure", { cause });
  }
}

export class ExchangeError extends HyperliquidError {
  readonly response: string;

  constructor(response: string) {
    super("EXCHANGE", response);
    this.response = response;
  }
}

export class NonceError extends HyperliquidError {
  constructor(message = "Nonce out of range") {
    super("NONCE", message);
  }
}

export class WeightError extends HyperliquidError {
  constructor(message = "Rate limit weight exceeded") {
    super("WEIGHT", message);
  }
}

export const ORDER_ERROR_STRINGS = [
  "Price must be divisible by tick size.",
  "Order must have minimum value of $10.",
  "Order must have minimum value of 10 {quote_token}.",
  "Insufficient margin to place order.",
  "Reduce only order would increase position.",
  "Post only order would have immediately matched, bbo was {bbo}.",
  "Order could not immediately match against any resting orders.",
  "Invalid TP/SL price.",
  "No liquidity available for market order.",
  "Order would increase open interest while open interest is capped",
  "Order rejected due to price more aggressive than oracle while open interest is capped",
  "Order would increase open interest too quickly",
  "(Spot-only) Order has insufficient spot balance to trade",
  "Order price too far from oracle",
  "Order would cause position to exceed margin tier limit at current leverage",
  "Order was never placed, already canceled, or filled.",
  "L1 error: User or API Wallet {address} does not exist.",
  "Must deposit before performing actions. User: {address}",
  "Action already expired",
] as const;

export type OrderErrorString = (typeof ORDER_ERROR_STRINGS)[number];
