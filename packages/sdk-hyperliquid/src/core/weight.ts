/**
 * @hyperliquid-api POST /info | POST /exchange
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits
 */

import { WeightError } from "./errors";

export const INFO_TYPES_WEIGHT_LIGHT = new Set<string>([
  "l2Book",
  "allMids",
  "clearinghouseState",
  "orderStatus",
  "spotClearinghouseState",
  "exchangeStatus",
]);

export const INFO_TYPES_WEIGHT_HEAVY = new Set<string>(["userRole"]);

export const INFO_TYPES_WEIGHT_PER_20_ITEMS = new Set<string>([
  "recentTrades",
  "historicalOrders",
  "userFills",
  "userFillsByTime",
  "fundingHistory",
  "userFunding",
  "userNonFundingLedgerUpdates",
  "twapHistory",
  "userTwapSliceFills",
  "userTwapSliceFillsByTime",
  "delegatorHistory",
  "delegatorRewards",
  "validatorStats",
]);

export const IS_CANDLE_WEIGHT_SCALED = true;
export const WINDOW_MS = 60_000;
export const RATE_LIMIT_WEIGHT = 1200;
export const EXCHANGE_WEIGHT = 1;

export function infoWeight(type: string, itemCount = 0): number {
  const base = INFO_TYPES_WEIGHT_LIGHT.has(type) ? 2 : INFO_TYPES_WEIGHT_HEAVY.has(type) ? 60 : 20;
  const itemized = INFO_TYPES_WEIGHT_PER_20_ITEMS.has(type)
    ? 20 * Math.max(0, Math.ceil(itemCount / 20) - 1)
    : 0;
  const candles =
    type === "candleSnapshot" && IS_CANDLE_WEIGHT_SCALED
      ? Math.max(0, Math.ceil(itemCount / 60) - 1)
      : 0;
  return base + itemized + candles;
}

export function retryWeight(weight: number): number {
  return weight;
}

export function exchangeWeight(batchLength: number): number {
  return EXCHANGE_WEIGHT + Math.floor(batchLength / 40);
}

export class WeightLedger {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #entries: { t: number; w: number }[] = [];
  #head = 0;
  #total = 0;

  constructor(limit = RATE_LIMIT_WEIGHT, windowMs = WINDOW_MS) {
    this.#limit = limit;
    this.#windowMs = windowMs;
  }

  async take(weight: number): Promise<void> {
    if (weight > this.#limit) {
      throw new WeightError(`weight ${weight} exceeds limit ${this.#limit}`);
    }
    const wait = this.#reserve(weight);
    if (wait === 0) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, wait);
    });
    return this.take(weight);
  }

  #reserve(weight: number): number {
    const now = performance.now();
    this.#prune(now);
    if (this.#total + weight <= this.#limit) {
      this.#entries.push({ t: now, w: weight });
      this.#total += weight;
      return 0;
    }
    const head = this.#entries[this.#head];
    return head === undefined ? 1 : Math.max(this.#windowMs - (now - head.t), 1);
  }

  spend(weight: number): void {
    const now = performance.now();
    this.#prune(now);
    this.#entries.push({ t: now, w: weight });
    this.#total += weight;
  }

  get used(): number {
    this.#prune(performance.now());
    return this.#total;
  }

  #prune(now: number): void {
    while (this.#head < this.#entries.length) {
      const oldest = this.#entries[this.#head];
      if (oldest === undefined || now - oldest.t < this.#windowMs) break;
      this.#total -= oldest.w;
      this.#head += 1;
    }
    if (this.#head > 64) {
      this.#entries.splice(0, this.#head);
      this.#head = 0;
    }
  }
}
