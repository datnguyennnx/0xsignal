/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  isPageHidden,
  onPageResume,
  onPageSuspend,
  onPageVisibilityChange,
  wasPageDiscarded,
} from "./page-visibility";

type Listener = () => void;

interface FakeTarget {
  readonly listeners: Map<string, Set<Listener>>;
  readonly addEventListener: ReturnType<typeof mock>;
  readonly removeEventListener: ReturnType<typeof mock>;
}

interface FakeDocument extends FakeTarget {
  visibilityState: DocumentVisibilityState;
  wasDiscarded: boolean;
}

let currentDocument: FakeDocument | null = null;
let currentWindow: FakeTarget | null = null;
const cleanups: Array<() => void> = [];

const createTarget = (): FakeTarget => {
  const listeners = new Map<string, Set<Listener>>();
  const addEventListener = mock((type: string, listener: Listener): void => {
    const bucket = listeners.get(type) ?? new Set<Listener>();
    bucket.add(listener);
    listeners.set(type, bucket);
  });
  const removeEventListener = mock((type: string, listener: Listener): void => {
    listeners.get(type)?.delete(listener);
  });
  return { listeners, addEventListener, removeEventListener };
};

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
  currentWindow = fake;
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

const dispatchDocumentEvent = (type: string): void => {
  dispatch(currentDocument, type);
};
const dispatchWindowEvent = (type: string): void => {
  dispatch(currentWindow, type);
};

const track = (unsubscribe: () => void): (() => void) => {
  cleanups.push(unsubscribe);
  return unsubscribe;
};

const eventTypes = (spy: ReturnType<typeof mock>): string[] =>
  spy.mock.calls.map((call: unknown[]) => String(call[0]));

beforeEach(() => {
  cleanups.length = 0;
  currentDocument = null;
  currentWindow = null;
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  Reflect.deleteProperty(globalThis, "document");
  Reflect.deleteProperty(globalThis, "window");
  currentDocument = null;
  currentWindow = null;
});

describe("isPageHidden", () => {
  test("reports the document's visibility state", () => {
    installDocument("hidden");
    expect(isPageHidden()).toBe(true);

    dispatchVisibility("visible");
    expect(isPageHidden()).toBe(false);
  });

  test("is safe without a document (SSR)", () => {
    expect(typeof document).toBe("undefined");
    expect(isPageHidden()).toBe(false);
  });
});

describe("wasPageDiscarded", () => {
  test("reflects document.wasDiscarded", () => {
    const doc = installDocument("visible", true);
    expect(wasPageDiscarded()).toBe(true);

    doc.wasDiscarded = false;
    expect(wasPageDiscarded()).toBe(false);
  });

  test("is false without a document (SSR)", () => {
    expect(typeof document).toBe("undefined");
    expect(wasPageDiscarded()).toBe(false);
  });
});

describe("onPageVisibilityChange", () => {
  test("notifies each subscriber of hidden and visible transitions", () => {
    installDocument("visible");
    const seen: boolean[] = [];

    onPageVisibilityChange((hidden) => seen.push(hidden));

    dispatchVisibility("hidden");
    dispatchVisibility("visible");

    expect(seen).toEqual([true, false]);
  });

  test("removes the listener on unsubscribe", () => {
    const doc = installDocument("visible");
    const seen: boolean[] = [];

    const unsubscribe = onPageVisibilityChange((hidden) => seen.push(hidden));
    expect(doc.listeners.get("visibilitychange")?.size).toBe(1);

    unsubscribe();
    expect(doc.listeners.get("visibilitychange")?.size).toBe(0);

    dispatchVisibility("hidden");
    expect(seen).toEqual([]);
  });

  test("unsubscribing is idempotent", () => {
    const doc = installDocument("visible");
    const unsubscribe = onPageVisibilityChange(() => {});

    unsubscribe();
    unsubscribe();

    expect(doc.listeners.get("visibilitychange")?.size).toBe(0);
  });

  test("is safe without a document (SSR)", () => {
    const unsubscribe = onPageVisibilityChange(() => {});
    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe("onPageResume", () => {
  test("fires once for a visible + pageshow + resume burst", () => {
    const doc = installDocument("hidden");
    installWindow();
    let resumes = 0;

    track(
      onPageResume(() => {
        resumes += 1;
      }),
    );

    dispatchVisibility("visible");
    dispatchWindowEvent("pageshow");
    dispatchDocumentEvent("resume");

    expect(resumes).toBe(1);
    expect(doc.listeners.get("visibilitychange")?.size).toBe(1);
  });

  test("notifies two subscribers through one shared native listener", () => {
    const doc = installDocument("hidden");
    installWindow();
    let first = 0;
    let second = 0;

    track(
      onPageResume(() => {
        first += 1;
      }),
    );
    track(
      onPageResume(() => {
        second += 1;
      }),
    );

    expect(eventTypes(doc.addEventListener)).toEqual(["visibilitychange", "resume"]);

    dispatchVisibility("visible");

    expect(first).toBe(1);
    expect(second).toBe(1);
  });

  test("unsubscribe removes only that subscriber and tears down the native listener last", () => {
    const doc = installDocument("visible");
    installWindow();
    let first = 0;
    let second = 0;

    const unsubscribeFirst = track(
      onPageResume(() => {
        first += 1;
      }),
    );
    const unsubscribeSecond = track(
      onPageResume(() => {
        second += 1;
      }),
    );

    unsubscribeFirst();
    expect(doc.listeners.get("visibilitychange")?.size).toBe(1);
    expect(doc.removeEventListener.mock.calls.length).toBe(0);

    dispatchVisibility("visible");
    expect(first).toBe(0);
    expect(second).toBe(1);

    unsubscribeSecond();
    expect(doc.listeners.get("visibilitychange")?.size).toBe(0);
    expect(eventTypes(doc.removeEventListener)).toEqual(["visibilitychange", "resume"]);
  });

  test("is a no-op without a document (SSR)", () => {
    const unsubscribe = onPageResume(() => {});
    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe("onPageSuspend", () => {
  test("fires once for a hidden + pagehide + freeze burst", () => {
    installDocument("visible");
    installWindow();
    let suspends = 0;

    track(
      onPageSuspend(() => {
        suspends += 1;
      }),
    );

    dispatchVisibility("hidden");
    dispatchWindowEvent("pagehide");
    dispatchDocumentEvent("freeze");

    expect(suspends).toBe(1);
  });

  test("does not fire when the page becomes visible", () => {
    installDocument("hidden");
    installWindow();
    let suspends = 0;

    track(
      onPageSuspend(() => {
        suspends += 1;
      }),
    );

    dispatchVisibility("visible");

    expect(suspends).toBe(0);
  });

  test("is a no-op without a document (SSR)", () => {
    const unsubscribe = onPageSuspend(() => {});
    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
  });
});
