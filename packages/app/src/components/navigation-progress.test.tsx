/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";

import {
  attachNavigationProgressListeners,
  clearNavigationProgress,
  disposeNavigationProgress,
  getNavigationProgressFading,
  getNavigationProgressSnapshot,
  hideNavigationProgress,
  NAV_PROGRESS_FADE_MS,
  NAV_PROGRESS_MAX_MS,
  NAV_PROGRESS_MIN_VISIBLE_MS,
  NAV_PROGRESS_SHOW_DELAY_MS,
  showNavigationProgress,
  subscribeNavigationProgress,
} from "./navigation-progress-store";

type Handler = (event: Event) => void;

class FakeTarget {
  private readonly handlers = new Map<string, Set<Handler>>();

  addEventListener(type: string, handler: Handler): void {
    const bucket = this.handlers.get(type) ?? new Set<Handler>();
    bucket.add(handler);
    this.handlers.set(type, bucket);
  }

  removeEventListener(type: string, handler: Handler): void {
    this.handlers.get(type)?.delete(handler);
  }

  listenerCount(type?: string): number {
    if (type !== undefined) return this.handlers.get(type)?.size ?? 0;
    let total = 0;
    for (const bucket of this.handlers.values()) total += bucket.size;
    return total;
  }
}

function state(): string {
  return `${getNavigationProgressSnapshot() ? "visible" : "hidden"}:${
    getNavigationProgressFading() ? "fading" : "opaque"
  }`;
}

beforeEach(() => {
  disposeNavigationProgress();
  jest.useFakeTimers();
});

afterEach(() => {
  disposeNavigationProgress();
  jest.useRealTimers();
});

describe("navigation progress store", () => {
  test("delays the first paint until the show-delay elapses", () => {
    showNavigationProgress();

    jest.advanceTimersByTime(NAV_PROGRESS_SHOW_DELAY_MS - 1);
    expect(getNavigationProgressSnapshot()).toBe(false);

    jest.advanceTimersByTime(1);
    expect(getNavigationProgressSnapshot()).toBe(true);
  });

  test("a navigation that commits inside the show delay never paints", () => {
    const seen: string[] = [];
    const unsubscribe = subscribeNavigationProgress(() => {
      seen.push(state());
    });

    showNavigationProgress();
    jest.advanceTimersByTime(50);
    clearNavigationProgress();

    jest.advanceTimersByTime(NAV_PROGRESS_SHOW_DELAY_MS + NAV_PROGRESS_MIN_VISIBLE_MS);
    expect(getNavigationProgressSnapshot()).toBe(false);
    expect(seen).toEqual([]);

    unsubscribe();
  });

  test("a shown bar holds for the minimum-visible window, then fades", () => {
    showNavigationProgress();
    jest.advanceTimersByTime(NAV_PROGRESS_SHOW_DELAY_MS);
    expect(getNavigationProgressSnapshot()).toBe(true);

    // Commit arrives 10ms after the bar painted (t=130): too early to hide.
    jest.advanceTimersByTime(10);
    clearNavigationProgress();
    expect(state()).toBe("visible:opaque");

    // Minimum visible lands at shownAt(120) + 250 = 370.
    jest.advanceTimersByTime(NAV_PROGRESS_MIN_VISIBLE_MS - 10 - 1);
    expect(state()).toBe("visible:opaque");

    jest.advanceTimersByTime(1);
    expect(state()).toBe("visible:fading");

    // The node survives the whole opacity transition, then leaves the DOM.
    jest.advanceTimersByTime(NAV_PROGRESS_FADE_MS - 1);
    expect(getNavigationProgressSnapshot()).toBe(true);

    jest.advanceTimersByTime(1);
    expect(state()).toBe("hidden:opaque");
  });

  test("show/hide is reference-counted and idempotent", () => {
    const seen: string[] = [];
    const unsubscribe = subscribeNavigationProgress(() => {
      seen.push(state());
    });

    showNavigationProgress();
    showNavigationProgress();
    showNavigationProgress();
    jest.advanceTimersByTime(NAV_PROGRESS_SHOW_DELAY_MS);
    expect(getNavigationProgressSnapshot()).toBe(true);

    hideNavigationProgress();
    expect(getNavigationProgressSnapshot()).toBe(true);
    hideNavigationProgress();
    expect(getNavigationProgressSnapshot()).toBe(true);
    hideNavigationProgress();
    // Ref count hit zero, but the minimum-visible window still holds.
    expect(getNavigationProgressSnapshot()).toBe(true);
    hideNavigationProgress();
    expect(getNavigationProgressSnapshot()).toBe(true);

    jest.advanceTimersByTime(NAV_PROGRESS_MIN_VISIBLE_MS);
    expect(state()).toBe("visible:fading");

    jest.advanceTimersByTime(NAV_PROGRESS_FADE_MS);
    expect(getNavigationProgressSnapshot()).toBe(false);

    // Only the initial paint and the fade-to-zero mutate the snapshot.
    expect(seen).toEqual(["visible:opaque", "visible:fading", "hidden:opaque"]);

    unsubscribe();
  });

  test("the safety timeout hides the bar", () => {
    showNavigationProgress();
    jest.advanceTimersByTime(NAV_PROGRESS_SHOW_DELAY_MS);
    expect(getNavigationProgressSnapshot()).toBe(true);

    jest.advanceTimersByTime(NAV_PROGRESS_MAX_MS - NAV_PROGRESS_SHOW_DELAY_MS - 1);
    expect(getNavigationProgressSnapshot()).toBe(true);

    jest.advanceTimersByTime(1);
    expect(getNavigationProgressSnapshot()).toBe(false);
  });

  test("a route commit clears every outstanding show", () => {
    showNavigationProgress();
    showNavigationProgress();
    clearNavigationProgress();
    expect(getNavigationProgressSnapshot()).toBe(false);

    clearNavigationProgress();
    expect(getNavigationProgressSnapshot()).toBe(false);

    jest.advanceTimersByTime(NAV_PROGRESS_SHOW_DELAY_MS);
    expect(getNavigationProgressSnapshot()).toBe(false);
  });

  test("dispose clears every pending timer", () => {
    const seen: string[] = [];
    const unsubscribe = subscribeNavigationProgress(() => {
      seen.push(state());
    });

    showNavigationProgress();
    jest.advanceTimersByTime(50);
    disposeNavigationProgress();
    expect(getNavigationProgressSnapshot()).toBe(false);

    jest.advanceTimersByTime(NAV_PROGRESS_MAX_MS * 2);
    expect(getNavigationProgressSnapshot()).toBe(false);
    expect(seen).toEqual([]);

    unsubscribe();
  });

  test("detach removes every listener it installed", () => {
    const doc = new FakeTarget();
    const win = new FakeTarget();

    const detach = attachNavigationProgressListeners(doc, win);
    expect(doc.listenerCount("click")).toBe(1);
    expect(win.listenerCount("popstate")).toBe(1);

    detach();
    expect(doc.listenerCount()).toBe(0);
    expect(win.listenerCount()).toBe(0);
  });
});
