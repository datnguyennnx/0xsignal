/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { attachDragListeners } from "./use-lift-and-float";

interface FakeTarget {
  target: EventTarget;
  handlers: Map<string, Set<unknown>>;
  addCount: () => number;
  removeCount: () => number;
}

/**
 * The real hook only needs `addEventListener`/`removeEventListener` on a target.
 * A DOM shim would add noise, so this fake records the exact handler identities
 * the helper registers and drops. Driving the hook's unmount would need a DOM
 * renderer (bun test ships without one), so the helper-level assertion is the
 * faithful proxy: the hook's unmount cleanup calls the same returned disposer.
 */
function fakeTarget(): FakeTarget {
  const handlers = new Map<string, Set<unknown>>();
  let adds = 0;
  let removes = 0;

  const target = {
    addEventListener(type: string, handler: unknown): void {
      adds += 1;
      const set = handlers.get(type) ?? new Set();
      set.add(handler);
      handlers.set(type, set);
    },
    removeEventListener(type: string, handler: unknown): void {
      removes += 1;
      handlers.get(type)?.delete(handler);
    },
  } as unknown as EventTarget;

  return {
    target,
    handlers,
    addCount: () => adds,
    removeCount: () => removes,
  };
}

const onMove = (_event: PointerEvent): void => {};
const onUp = (_event: PointerEvent): void => {};

describe("attachDragListeners", () => {
  test("adds exactly pointermove, pointerup and pointercancel", () => {
    const fake = fakeTarget();

    attachDragListeners(fake.target as unknown as Document, { onMove, onUp });

    expect(fake.addCount()).toBe(3);
    expect([...fake.handlers.keys()].sort()).toEqual(["pointercancel", "pointermove", "pointerup"]);
    expect(fake.handlers.get("pointermove")).toEqual(new Set([onMove]));
    expect(fake.handlers.get("pointerup")).toEqual(new Set([onUp]));
    expect(fake.handlers.get("pointercancel")).toEqual(new Set([onUp]));
  });

  test("cleanup removes exactly the three listeners it added and empties the set", () => {
    const fake = fakeTarget();
    const cleanup = attachDragListeners(fake.target as unknown as Document, { onMove, onUp });

    cleanup();

    expect(fake.removeCount()).toBe(3);
    expect(fake.handlers.get("pointermove")?.size).toBe(0);
    expect(fake.handlers.get("pointerup")?.size).toBe(0);
    expect(fake.handlers.get("pointercancel")?.size).toBe(0);
  });

  test("cleanup is idempotent", () => {
    const fake = fakeTarget();
    const cleanup = attachDragListeners(fake.target as unknown as Document, { onMove, onUp });

    cleanup();
    expect(() => {
      cleanup();
    }).not.toThrow();

    expect(fake.removeCount()).toBe(3);
    expect([...fake.handlers.values()].every((set) => set.size === 0)).toBe(true);
  });
});
