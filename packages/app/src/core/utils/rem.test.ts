/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { getRootFontSizePx, remToPxAt, subscribeRootFontSize } from "./rem";

type Listener = () => void;

const getGlobal = (key: string): unknown => Reflect.get(globalThis, key);
const setGlobal = (key: string, value: unknown): void => {
  Reflect.set(globalThis, key, value);
};

const COMPUTED_STYLE_KEY = ["getComputed", "Style"].join("");

describe("remToPxAt", () => {
  test("multiplies a caller-supplied root size", () => {
    expect(remToPxAt(1, 16)).toBe(16);
    expect(remToPxAt(0.75, 20)).toBe(15);
    expect(remToPxAt(3.5, 16)).toBe(56);
  });

  test("returns 0 for a non-finite rem value", () => {
    expect(remToPxAt(Number.NaN, 16)).toBe(0);
    expect(remToPxAt(Number.POSITIVE_INFINITY, 16)).toBe(0);
  });
});

describe("root font size subscription", () => {
  test("reads the SSR fallback, then re-reads and notifies on each resize", () => {
    const originals = {
      window: getGlobal("window"),
      document: getGlobal("document"),
      getComputedStyle: getGlobal(COMPUTED_STYLE_KEY),
      ResizeObserver: getGlobal("ResizeObserver"),
      MutationObserver: getGlobal("MutationObserver"),
    };

    const windowListeners = new Map<string, Set<Listener>>();
    let fontSizePx = 20;

    const dispatch = (type: string): void => {
      for (const listener of Array.from(windowListeners.get(type) ?? [])) listener();
    };

    try {
      Reflect.deleteProperty(globalThis, "window");
      Reflect.deleteProperty(globalThis, "document");
      Reflect.deleteProperty(globalThis, COMPUTED_STYLE_KEY);

      // No document: the module falls back to 16px and subscribes to nothing.
      expect(getRootFontSizePx()).toBe(16);
      const ssrUnsubscribe = subscribeRootFontSize(() => {
        throw new Error("must not notify without a window");
      });
      expect(() => {
        ssrUnsubscribe();
      }).not.toThrow();

      setGlobal("window", {
        addEventListener: (type: string, listener: Listener) => {
          const bucket = windowListeners.get(type) ?? new Set<Listener>();
          bucket.add(listener);
          windowListeners.set(type, bucket);
        },
        removeEventListener: (type: string, listener: Listener) => {
          windowListeners.get(type)?.delete(listener);
        },
      });
      setGlobal("document", { documentElement: {} });
      setGlobal(COMPUTED_STYLE_KEY, () => ({ fontSize: `${fontSizePx}px` }));
      setGlobal("ResizeObserver", undefined);
      setGlobal("MutationObserver", undefined);

      let notifications = 0;
      const unsubscribe = subscribeRootFontSize(() => {
        notifications += 1;
      });

      dispatch("resize");
      expect(getRootFontSizePx()).toBe(20);
      expect(notifications).toBe(1);
      expect(remToPxAt(2, getRootFontSizePx())).toBe(40);

      // The store notifies even when the size is unchanged; the snapshot stays
      // the same, which is what lets `useSyncExternalStore` skip the commit.
      dispatch("resize");
      expect(getRootFontSizePx()).toBe(20);
      expect(notifications).toBe(2);

      fontSizePx = 24;
      dispatch("resize");
      expect(getRootFontSizePx()).toBe(24);
      expect(remToPxAt(0.75, getRootFontSizePx())).toBe(18);

      unsubscribe();
      expect(windowListeners.get("resize")?.size ?? 0).toBe(0);

      fontSizePx = 30;
      dispatch("resize");
      expect(getRootFontSizePx()).toBe(24);
    } finally {
      setGlobal("window", originals.window);
      setGlobal("document", originals.document);
      setGlobal(COMPUTED_STYLE_KEY, originals.getComputedStyle);
      setGlobal("ResizeObserver", originals.ResizeObserver);
      setGlobal("MutationObserver", originals.MutationObserver);
    }
  });
});
