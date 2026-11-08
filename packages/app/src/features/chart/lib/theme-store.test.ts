/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { CHART_TOKENS, getChartTheme, subscribeChartTheme } from "./theme-store";

const setGlobal = (key: string, value: unknown): void => {
  Reflect.set(globalThis, key, value);
};

const getGlobal = (key: string): unknown => Reflect.get(globalThis, key);

const COMPUTED_STYLE_KEY = ["getComputed", "Style"].join("");

const tokenValues: Record<string, string> = {};
for (const token of CHART_TOKENS) tokenValues[token] = "#abcdef";
tokenValues["--data-up"] = "#111111";

class FakeMutationObserver {
  static instances: FakeMutationObserver[] = [];

  private readonly callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
    FakeMutationObserver.instances.push(this);
  }

  observe(): void {}

  disconnect(): void {}

  fire(): void {
    this.callback();
  }
}

describe("chart theme store", () => {
  test("re-resolves tokens and bumps version when the root class changes", () => {
    tokenValues["--data-up"] = "#111111";

    const originalDocument = getGlobal("document");
    const originalGetComputedStyle = getGlobal(COMPUTED_STYLE_KEY);
    const originalMutationObserver = getGlobal("MutationObserver");
    const originalRequestAnimationFrame = getGlobal("requestAnimationFrame");

    setGlobal("document", { documentElement: {} });
    setGlobal(COMPUTED_STYLE_KEY, () => ({
      getPropertyValue: (token: string) => tokenValues[token],
    }));
    setGlobal("MutationObserver", FakeMutationObserver);
    // The store coalesces mutations onto the next frame; run it inline here.
    setGlobal("requestAnimationFrame", (callback: (time: number) => void) => {
      callback(0);
      return 1;
    });

    try {
      const before = getChartTheme();
      expect(before.colors["--data-up"]).toBe("#111111");

      const seen: number[] = [];
      const unsubscribe = subscribeChartTheme(() => {
        seen.push(getChartTheme().version);
      });

      tokenValues["--data-up"] = "#222222";
      for (const observer of FakeMutationObserver.instances) observer.fire();

      const after = getChartTheme();
      expect(after.version).toBe(before.version + 1);
      expect(after.colors["--data-up"]).toBe("#222222");
      expect(seen).toEqual([after.version]);

      unsubscribe();
    } finally {
      setGlobal("document", originalDocument);
      setGlobal(COMPUTED_STYLE_KEY, originalGetComputedStyle);
      setGlobal("MutationObserver", originalMutationObserver);
      setGlobal("requestAnimationFrame", originalRequestAnimationFrame);
    }
  });
});
