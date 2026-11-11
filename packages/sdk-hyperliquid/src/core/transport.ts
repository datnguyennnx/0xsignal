/**
 * @hyperliquid-api POST /info | POST /exchange
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits
 */

import { HttpError, HyperliquidError, TransportError } from "./errors";
import { WeightLedger, exchangeWeight, infoWeight, retryWeight } from "./weight";

export const MAINNET = "https://api.hyperliquid.xyz";
export const TESTNET = "https://api.hyperliquid-testnet.xyz";

const MAX_BACKOFF_MS = 8_000;

class HttpResponseError extends HttpError {
  readonly retryAfterMs: number | undefined;

  constructor(status: number, body: string, retryAfterMs: number | undefined) {
    super(status, body);
    this.name = "HttpError";
    this.retryAfterMs = retryAfterMs;
  }
}

const parseRetryAfter = (response: Response): number | undefined => {
  const header = response.headers.get("retry-after");
  if (header === null) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const at = Date.parse(header);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, at - Date.now());
};

export type TransportOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  ledger?: WeightLedger;
  fetchImpl?: typeof fetch;
};

export class Transport {
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #retries: number;
  readonly #ledger: WeightLedger;
  readonly #fetchImpl: typeof fetch | undefined;

  constructor(opts: TransportOptions = {}) {
    this.#baseUrl = opts.baseUrl ?? MAINNET;
    this.#timeoutMs = opts.timeoutMs ?? 10_000;
    this.#retries = opts.retries ?? 2;
    this.#ledger = opts.ledger ?? new WeightLedger();
    this.#fetchImpl = opts.fetchImpl;
  }

  async postInfo<T>(
    body: Record<string, unknown>,
    parse: (u: unknown) => T,
    weight: number,
  ): Promise<T> {
    await this.#ledger.take(weight);
    const result = await this.#request("/info", body, parse, true, weight);
    const type = body["type"];
    if (typeof type === "string" && Array.isArray(result)) {
      const extra = infoWeight(type, result.length) - infoWeight(type, 0);
      if (extra > 0) this.#ledger.spend(extra);
    }
    return result;
  }

  async postExchange<T>(
    body: Record<string, unknown>,
    parse: (u: unknown) => T,
    batchLength: number,
  ): Promise<T> {
    await this.#ledger.take(exchangeWeight(batchLength));
    return this.#request("/exchange", body, parse, false, 0);
  }

  #request<T>(
    path: string,
    body: Record<string, unknown>,
    parse: (u: unknown) => T,
    isRetryable: boolean,
    weight: number,
  ): Promise<T> {
    return this.#attempt(path, JSON.stringify(body), parse, isRetryable, 0, weight);
  }

  async #attempt<T>(
    path: string,
    payload: string,
    parse: (u: unknown) => T,
    isRetryable: boolean,
    attempt: number,
    weight: number,
  ): Promise<T> {
    try {
      return await this.#send(path, payload, parse);
    } catch (cause) {
      const retryable =
        cause instanceof TransportError ||
        (cause instanceof HttpError && (cause.status === 429 || cause.status >= 500)) ||
        !(cause instanceof HyperliquidError);
      if (isRetryable && attempt < this.#retries && retryable) {
        await this.#ledger.take(retryWeight(weight));
        const retryAfter = cause instanceof HttpResponseError ? cause.retryAfterMs : undefined;
        await this.#backoff(attempt, retryAfter);
        return this.#attempt(path, payload, parse, isRetryable, attempt + 1, weight);
      }
      throw cause;
    }
  }

  async #send<T>(path: string, payload: string, parse: (u: unknown) => T): Promise<T> {
    const doFetch = this.#fetchImpl ?? globalThis.fetch;
    const response = await doFetch(`${this.#baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(this.#timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new HttpResponseError(response.status, text, parseRetryAfter(response));
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (cause) {
      throw new TransportError(cause);
    }
    try {
      return parse(json);
    } catch (cause) {
      if (cause instanceof HyperliquidError) throw cause;
      throw new TransportError(cause);
    }
  }

  async #backoff(attempt: number, retryAfter: number | undefined): Promise<void> {
    const jitter = Math.random() * 250 * 2 ** attempt;
    const delay = Math.min(retryAfter ?? jitter, MAX_BACKOFF_MS);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delay);
    });
  }
}
