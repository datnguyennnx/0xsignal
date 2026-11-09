/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, spyOn, test, type Mock } from "bun:test";

import * as marketDataStore from "@/stores/use-market-data-store";

/**
 * `useHyperliquidWs` is where every `allMids` subscription in the app is
 * registered (`use-all-mids.ts` and `positions-tab.tsx` both go through it),
 * so its consumer count is the global count M3 needs. Driving the real effect
 * cleanup would need a DOM renderer (bun test ships without one), so the
 * cleanup proxy under test is the release callback that effect returns — the
 * same seam use-lift-and-float.test.ts uses for its listeners.
 */
const { acquireAllMidsConsumer } = await import("./use-hyperliquid-ws");

type Cleanup = () => void;

const cleanups: Cleanup[] = [];

let cancelMidsFlushSpy: Mock<typeof marketDataStore.cancelMidsFlush>;

/** One unsubscribe: claim a consumer, keep its cleanup for teardown. */
const acquire = (): Cleanup => {
  const cleanup = acquireAllMidsConsumer();
  cleanups.push(cleanup);
  return cleanup;
};

beforeEach(() => {
  // The hook's default cancel target is the store export, so spying on it
  // asserts the real call without replacing the store module.
  cancelMidsFlushSpy = spyOn(marketDataStore, "cancelMidsFlush");
});

afterEach(() => {
  // Keep the module-level count at zero even when an assertion fails early.
  for (const cleanup of cleanups.splice(0)) cleanup();
  cancelMidsFlushSpy.mockRestore();
});

const cancelCalls = (): number => cancelMidsFlushSpy.mock.calls.length;

describe("allMids consumer cleanup", () => {
  test("the last unsubscribe cancels the pending mids frame exactly once", () => {
    acquire()();

    expect(cancelCalls()).toBe(1);
  });

  test("does not cancel while another allMids consumer is still subscribed", () => {
    const first = acquire();
    const second = acquire();

    first();

    expect(cancelCalls()).toBe(0);

    second();

    expect(cancelCalls()).toBe(1);
  });

  test("a second cleanup from the same subscription is safe and does not cancel again", () => {
    const cleanup = acquire();
    cleanup();

    expect(() => {
      cleanup();
    }).not.toThrow();
    expect(cancelCalls()).toBe(1);
  });

  test("a stale cleanup does not cancel a claim made by a newer subscription", () => {
    const previous = acquire();
    acquire();

    previous();
    previous();

    expect(cancelCalls()).toBe(0);
  });
});
