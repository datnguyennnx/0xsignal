/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import {
  MissingWebLocksError,
  StaleNonceError,
  assertNonceWithinWindow,
  createLockedNonceIssuer,
  createNonceIssuer,
  type NonceStorage,
} from "./nonce-issuer";

const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ADDRESS = "0x0000000000000000000000000000000000000001";
const now = (): number => NOW;

const memoryStorage = (): NonceStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

/** A shared mutex stands in for navigator.locks across two simulated tabs. */
const serialize = () => {
  let chain: Promise<unknown> = Promise.resolve();
  return <T>(_address: string, run: () => Promise<T>): Promise<T> => {
    const next = chain.then(run, run);
    chain = next.catch(() => null);
    return next;
  };
};

const rejectionOf = async (run: () => Promise<unknown>): Promise<Error | null> => {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("non-error rejection");
  }
};

const thrownBy = (run: () => void): Error | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("non-error rejection");
  }
};

describe("nonce issuer", () => {
  test("is strictly increasing across tabs sharing storage", async () => {
    const storage = memoryStorage();
    const lock = serialize();
    const tabA = createNonceIssuer({ storage, now, withLock: lock });
    const tabB = createNonceIssuer({ storage, now, withLock: lock });

    const first = await tabA(ADDRESS);
    const second = await tabB(ADDRESS);
    const third = await tabA(ADDRESS);

    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(new Set([first, second, third]).size).toBe(3);
    expect(storage.getItem(`0xsignal:hyperliquid:nonce:${ADDRESS}`)).toBe(String(third));
  });

  test("keeps separate counters per signer", async () => {
    const storage = memoryStorage();
    const issue = createNonceIssuer({ storage, now });
    const a = await issue(ADDRESS);
    const b = await issue("0x0000000000000000000000000000000000000002");
    expect(a).toBe(b);
  });

  test("rejects a persisted nonce beyond now + 1 day", async () => {
    const storage = memoryStorage();
    storage.setItem(`0xsignal:hyperliquid:nonce:${ADDRESS}`, String(NOW + 2 * DAY_MS));
    const issue = createNonceIssuer({ storage, now });
    expect(await rejectionOf(() => issue(ADDRESS))).toBeInstanceOf(StaleNonceError);
  });

  test("rejects a nonce older than now - 2 days", () => {
    const error = thrownBy(() => {
      assertNonceWithinWindow(NOW - 3 * DAY_MS, NOW);
    });
    expect(error).toBeInstanceOf(StaleNonceError);
  });

  test("rejects a non-integer nonce", () => {
    const error = thrownBy(() => {
      assertNonceWithinWindow(NOW + 0.5, NOW);
    });
    expect(error).toBeInstanceOf(StaleNonceError);
  });

  test("refuses to issue a nonce when Web Locks is unavailable", async () => {
    const issue = createLockedNonceIssuer({ storage: memoryStorage(), locks: null });
    expect(await rejectionOf(() => issue(ADDRESS))).toBeInstanceOf(MissingWebLocksError);
  });
});
