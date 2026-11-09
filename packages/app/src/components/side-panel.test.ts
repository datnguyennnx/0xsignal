/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { getIsSheetSnapshot, subscribeIsSheet } from "./side-panel-sheet-store";

type Listener = () => void;

const getGlobal = (key: string): unknown => Reflect.get(globalThis, key);
const setGlobal = (key: string, value: unknown): void => {
  Reflect.set(globalThis, key, value);
};

const MD_QUERY = "(min-width: 48rem)";

class FakeMediaQueryList {
  readonly media: string;
  matches: boolean;
  private readonly changeListeners = new Set<Listener>();

  constructor(media: string, matches: boolean) {
    this.media = media;
    this.matches = matches;
  }

  addEventListener(type: string, listener: Listener): void {
    if (type === "change") this.changeListeners.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    if (type === "change") this.changeListeners.delete(listener);
  }

  listenerCount(): number {
    return this.changeListeners.size;
  }

  dispatchChange(): void {
    for (const listener of Array.from(this.changeListeners)) listener();
  }
}

describe("side panel media-query store", () => {
  test("is safe without a window (SSR)", () => {
    const originalWindow = getGlobal("window");
    Reflect.deleteProperty(globalThis, "window");

    try {
      expect(getIsSheetSnapshot()).toBe(false);
      const unsubscribe = subscribeIsSheet(() => {});
      expect(typeof unsubscribe).toBe("function");
      expect(() => {
        unsubscribe();
      }).not.toThrow();
    } finally {
      setGlobal("window", originalWindow);
    }
  });

  test("reports a sheet below the md breakpoint and follows the media query", () => {
    const originalWindow = getGlobal("window");
    const queries: string[] = [];
    const lists: FakeMediaQueryList[] = [];
    let matches = true;

    setGlobal("window", {
      matchMedia: (query: string) => {
        queries.push(query);
        const list = new FakeMediaQueryList(query, matches);
        lists.push(list);
        return list;
      },
    });

    try {
      expect(getIsSheetSnapshot()).toBe(false);

      matches = false;
      expect(getIsSheetSnapshot()).toBe(true);

      matches = true;
      let changes = 0;
      const unsubscribe = subscribeIsSheet(() => {
        changes += 1;
      });
      const subscribed = lists.at(-1);
      expect(subscribed).toBeDefined();
      expect(subscribed?.listenerCount()).toBe(1);

      matches = false;
      subscribed?.dispatchChange();
      expect(changes).toBe(1);

      unsubscribe();
      expect(subscribed?.listenerCount()).toBe(0);
      subscribed?.dispatchChange();
      expect(changes).toBe(1);

      expect(queries.length).toBeGreaterThan(0);
      expect(queries.every((query) => query === MD_QUERY)).toBe(true);
    } finally {
      setGlobal("window", originalWindow);
    }
  });
});
