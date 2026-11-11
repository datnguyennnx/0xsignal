/**
 * @hyperliquid-api POST /info | POST /exchange
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets
 */

export const NONCE_WINDOW_PAST_MS = 172_800_000;
export const NONCE_WINDOW_FUTURE_MS = 86_400_000;

import { NonceError } from "./errors";

export function assertNonceWindow(nonce: bigint, now: number): void {
  const t = BigInt(now);
  const lower = t - BigInt(NONCE_WINDOW_PAST_MS);
  const upper = t + BigInt(NONCE_WINDOW_FUTURE_MS);
  if (nonce <= lower || nonce >= upper) {
    throw new NonceError(`nonce ${nonce} outside (${lower}, ${upper})`);
  }
}

export const MAX_TRACKED_SIGNERS = 64;

export class NonceSource {
  readonly #now: () => number;
  readonly #last = new Map<string, bigint>();

  constructor(opts: { now?: () => number } = {}) {
    this.#now = opts.now ?? Date.now;
  }

  next(signer: string): bigint {
    return this.reserve(signer);
  }

  reserve(signer: string, explicitNonce?: number): bigint {
    const now = this.#now();
    const last = this.#last.get(signer) ?? 0n;
    const current = BigInt(now);
    const value =
      explicitNonce === undefined ? (current > last ? current : last + 1n) : BigInt(explicitNonce);
    assertNonceWindow(value, now);
    this.#remember(signer, value);
    return value;
  }

  #remember(signer: string, value: bigint): void {
    this.#last.delete(signer);
    this.#last.set(signer, value);
    while (this.#last.size > MAX_TRACKED_SIGNERS) {
      const oldest = this.#last.keys().next();
      if (oldest.done === true) return;
      this.#last.delete(oldest.value);
    }
  }
}
