/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import { queryClient } from "./query-client";
import { RESUME_RESYNC_AFTER_MS, installResumeResync, shouldResync } from "./resume-resync";

type Listener = () => void;

interface FakeTarget {
  readonly listeners: Map<string, Set<Listener>>;
  readonly addEventListener: (type: string, listener: Listener) => void;
  readonly removeEventListener: (type: string, listener: Listener) => void;
}

interface FakeDocument extends FakeTarget {
  visibilityState: DocumentVisibilityState;
  wasDiscarded: boolean;
}

const createTarget = (): FakeTarget => {
  const listeners = new Map<string, Set<Listener>>();
  return {
    listeners,
    addEventListener: (type, listener) => {
      const bucket = listeners.get(type) ?? new Set<Listener>();
      bucket.add(listener);
      listeners.set(type, bucket);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
  };
};

let currentDocument: FakeDocument | null = null;
const cleanups: Array<() => void> = [];
const realDateNow = Date.now;
let nowMs = 0;

const installDocument = (
  visibilityState: DocumentVisibilityState,
  wasDiscarded = false,
): FakeDocument => {
  const fake: FakeDocument = { ...createTarget(), visibilityState, wasDiscarded };
  Object.defineProperty(globalThis, "document", { configurable: true, value: fake });
  currentDocument = fake;
  return fake;
};

const installWindow = (): FakeTarget => {
  const fake = createTarget();
  Object.defineProperty(globalThis, "window", { configurable: true, value: fake });
  return fake;
};

const dispatch = (target: FakeTarget | null, type: string): void => {
  const bucket = target?.listeners.get(type);
  if (!bucket) return;
  for (const listener of Array.from(bucket)) listener();
};

const dispatchVisibility = (visibilityState: DocumentVisibilityState): void => {
  if (!currentDocument) throw new Error("document is not installed");
  currentDocument.visibilityState = visibilityState;
  dispatch(currentDocument, "visibilitychange");
};

const track = (cleanup: () => void): (() => void) => {
  cleanups.push(cleanup);
  return cleanup;
};

const createInvalidateSpy = () => mock((_queryKey: readonly string[]): void => {});

const invalidatedRoots = (spy: ReturnType<typeof createInvalidateSpy>): string[] =>
  spy.mock.calls.map((call: unknown[]) => String((call[0] as readonly string[])[0]));

beforeEach(() => {
  cleanups.length = 0;
  currentDocument = null;
  nowMs = 1_000_000;
  Date.now = () => nowMs;
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  Date.now = realDateNow;
  Reflect.deleteProperty(globalThis, "document");
  Reflect.deleteProperty(globalThis, "window");
  currentDocument = null;
});

describe("shouldResync", () => {
  test("is false without a hidden timestamp", () => {
    expect(shouldResync(null, 1_000_000, false)).toBe(false);
  });

  test("respects the threshold boundary", () => {
    const hiddenAt = 1_000_000;

    expect(shouldResync(hiddenAt, hiddenAt + RESUME_RESYNC_AFTER_MS - 1, false)).toBe(false);
    expect(shouldResync(hiddenAt, hiddenAt + RESUME_RESYNC_AFTER_MS, false)).toBe(true);
    expect(shouldResync(hiddenAt, hiddenAt + RESUME_RESYNC_AFTER_MS + 1, false)).toBe(true);
  });

  test("resyncs a discarded page even without a hidden timestamp", () => {
    expect(shouldResync(null, 1_000_000, true)).toBe(true);
    expect(shouldResync(1_000_000, 1_000_001, true)).toBe(true);
  });
});

describe("installResumeResync", () => {
  test("does not invalidate on a short hide and show", () => {
    installDocument("visible");
    installWindow();
    const invalidate = createInvalidateSpy();
    track(installResumeResync(invalidate));

    dispatchVisibility("hidden");
    nowMs += 1_000;
    dispatchVisibility("visible");

    expect(invalidate).not.toHaveBeenCalled();
  });

  test("invalidates user, whales, and market once after a long hide", () => {
    installDocument("visible");
    installWindow();
    const invalidate = createInvalidateSpy();
    track(installResumeResync(invalidate));

    dispatchVisibility("hidden");
    nowMs += RESUME_RESYNC_AFTER_MS;
    dispatchVisibility("visible");

    expect(invalidatedRoots(invalidate)).toEqual(["user", "whales", "market"]);
  });

  test("resyncs a discarded page even for a short gap", () => {
    const doc = installDocument("visible");
    installWindow();
    const invalidate = createInvalidateSpy();
    track(installResumeResync(invalidate));

    dispatchVisibility("hidden");
    nowMs += 1_000;
    doc.wasDiscarded = true;
    dispatchVisibility("visible");

    expect(invalidatedRoots(invalidate)).toEqual(["user", "whales", "market"]);
  });

  test("consumes the discard signal only once (short gaps after the restore stay cached)", () => {
    const doc = installDocument("visible");
    installWindow();
    const invalidate = createInvalidateSpy();
    track(installResumeResync(invalidate));

    // First resume: discarded page, short gap -> resync.
    dispatchVisibility("hidden");
    nowMs += 1_000;
    doc.wasDiscarded = true;
    dispatchVisibility("visible");

    expect(invalidatedRoots(invalidate)).toEqual(["user", "whales", "market"]);

    invalidate.mockClear();

    // Second resume: the sticky flag is still true, but the signal is spent.
    dispatchVisibility("hidden");
    nowMs += 1_000;
    dispatchVisibility("visible");

    expect(invalidate).not.toHaveBeenCalled();
  });

  test("still resyncs after a long gap once the discard signal was consumed", () => {
    const doc = installDocument("visible");
    installWindow();
    const invalidate = createInvalidateSpy();
    track(installResumeResync(invalidate));

    dispatchVisibility("hidden");
    nowMs += 1_000;
    doc.wasDiscarded = true;
    dispatchVisibility("visible");

    expect(invalidatedRoots(invalidate)).toEqual(["user", "whales", "market"]);

    invalidate.mockClear();

    dispatchVisibility("hidden");
    nowMs += RESUME_RESYNC_AFTER_MS;
    dispatchVisibility("visible");

    expect(invalidatedRoots(invalidate)).toEqual(["user", "whales", "market"]);
  });

  test("a reinstall after uninstall handles the discard signal again", () => {
    const doc = installDocument("visible");
    installWindow();
    const invalidate = createInvalidateSpy();
    const firstUninstall = track(installResumeResync(invalidate));

    dispatchVisibility("hidden");
    nowMs += 1_000;
    doc.wasDiscarded = true;
    dispatchVisibility("visible");

    expect(invalidatedRoots(invalidate)).toEqual(["user", "whales", "market"]);

    firstUninstall();
    invalidate.mockClear();

    track(installResumeResync(invalidate));

    dispatchVisibility("hidden");
    nowMs += 1_000;
    dispatchVisibility("visible");

    expect(invalidatedRoots(invalidate)).toEqual(["user", "whales", "market"]);
  });

  test("default invalidation only refetches observed (active) keys", () => {
    installDocument("visible");
    installWindow();
    const invalidateQueries = spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    const uninstall = track(installResumeResync());

    try {
      dispatchVisibility("hidden");
      nowMs += RESUME_RESYNC_AFTER_MS;
      dispatchVisibility("visible");

      const filters = invalidateQueries.mock.calls.map(([value]) => value);
      expect(filters.map((value) => value?.queryKey)).toEqual([["user"], ["whales"], ["market"]]);
      expect(filters.every((value) => value?.refetchType === "active")).toBe(true);
    } finally {
      uninstall();
      invalidateQueries.mockRestore();
    }
  });

  test("uninstall stops further invalidations", () => {
    installDocument("visible");
    installWindow();
    const invalidate = createInvalidateSpy();
    const uninstall = track(installResumeResync(invalidate));

    uninstall();

    dispatchVisibility("hidden");
    nowMs += RESUME_RESYNC_AFTER_MS;
    dispatchVisibility("visible");

    expect(invalidate).not.toHaveBeenCalled();
  });

  test("a second install does not double-fire", () => {
    installDocument("visible");
    installWindow();
    const invalidate = createInvalidateSpy();
    const first = track(installResumeResync(invalidate));
    const second = track(installResumeResync(invalidate));

    expect(second).toBe(first);

    dispatchVisibility("hidden");
    nowMs += RESUME_RESYNC_AFTER_MS;
    dispatchVisibility("visible");

    expect(invalidatedRoots(invalidate)).toEqual(["user", "whales", "market"]);
  });

  test("uninstalling is idempotent", () => {
    installDocument("visible");
    const uninstall = track(installResumeResync(createInvalidateSpy()));

    uninstall();
    expect(() => uninstall()).not.toThrow();
  });

  test("is safe without a document (SSR)", () => {
    const invalidate = createInvalidateSpy();
    const uninstall = installResumeResync(invalidate);

    expect(typeof uninstall).toBe("function");
    expect(() => uninstall()).not.toThrow();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
