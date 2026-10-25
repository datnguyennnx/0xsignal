const NONCE_KEY_PREFIX = "0xsignal:hyperliquid:nonce:";
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface NonceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class StaleNonceError extends Error {
  constructor(nonce: number, now: number) {
    super(`Stored nonce ${nonce} is outside the accepted window around ${now}.`);
    this.name = "StaleNonceError";
  }
}

export class MissingWebLocksError extends Error {
  constructor() {
    super("Cannot sign: the Web Locks API is unavailable, so two tabs could issue the same nonce.");
    this.name = "MissingWebLocksError";
  }
}

/** Hyperliquid rejects actions outside (now - 2 days, now + 1 day). */
export function assertNonceWithinWindow(nonce: number, now: number): void {
  if (!Number.isSafeInteger(nonce) || nonce < now - TWO_DAYS_MS || nonce > now + ONE_DAY_MS) {
    throw new StaleNonceError(nonce, now);
  }
}

export interface NonceIssuerOptions {
  readonly storage: NonceStorage;
  readonly now?: () => number;
  readonly withLock?: <T>(address: string, run: () => Promise<T>) => Promise<T>;
}

/**
 * One nonce per signer for the whole origin. The Web Locks lock is shared by
 * every tab, so two tabs cannot read the same stored value and sign with it;
 * the stored value is advanced even when a signature is later rejected.
 */
export function createNonceIssuer({
  storage,
  now = Date.now,
  withLock,
}: NonceIssuerOptions): (address: string) => Promise<number> {
  return (address) => {
    const key = `${NONCE_KEY_PREFIX}${address.toLowerCase()}`;
    const issue = (): Promise<number> => {
      const timestamp = now();
      const stored = Number(storage.getItem(key));
      const candidate = Number.isSafeInteger(stored) ? Math.max(timestamp, stored + 1) : timestamp;
      assertNonceWithinWindow(candidate, timestamp);
      storage.setItem(key, String(candidate));
      return Promise.resolve(candidate);
    };
    return withLock === undefined ? issue() : withLock(key, issue);
  };
}

interface LockManagerLike {
  request<T>(name: string, run: () => Promise<T>): Promise<T>;
}

const isLockManager = (value: unknown): value is LockManagerLike =>
  typeof value === "object" &&
  value !== null &&
  typeof Reflect.get(value, "request") === "function";

const getLockManager = (): LockManagerLike | null => {
  const navigatorValue: unknown = Reflect.get(globalThis, "navigator");
  if (typeof navigatorValue !== "object" || navigatorValue === null) return null;
  const locks: unknown = Reflect.get(navigatorValue, "locks");
  return isLockManager(locks) ? locks : null;
};

export interface BrowserNonceIssuerOptions {
  readonly storage: NonceStorage;
  readonly locks: LockManagerLike | null;
}

/** No Web Locks means no cross-tab exclusion, so a collision is possible; refuse instead. */
export function createLockedNonceIssuer({
  storage,
  locks,
}: BrowserNonceIssuerOptions): (address: string) => Promise<number> {
  if (locks === null) {
    return () => Promise.reject(new MissingWebLocksError());
  }
  return createNonceIssuer({
    storage,
    withLock: <T>(name: string, run: () => Promise<T>) =>
      locks.request(`0xsignal-nonce:${name}`, run),
  });
}

export function createBrowserNonceIssuer(): (address: string) => Promise<number> {
  return createLockedNonceIssuer({
    storage: window.localStorage,
    locks: getLockManager(),
  });
}
