import { describe, expect, it, vi } from "vitest";
import { resolveWithCache, type CacheSlot } from "../cache";

describe("hyperliquid cache", () => {
  it("returns cached value within ttl", async () => {
    const slot: CacheSlot<number> = { expiresAt: 0 };
    const loader = vi.fn(async () => 7);
    const now = vi.spyOn(Date, "now");

    now.mockReturnValue(1_000);
    await expect(resolveWithCache(slot, 500, loader)).resolves.toBe(7);
    await expect(resolveWithCache(slot, 500, loader)).resolves.toBe(7);

    expect(loader).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });

  it("deduplicates in-flight loads", async () => {
    const slot: CacheSlot<number> = { expiresAt: 0 };
    let resolveLoader: ((value: number) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveLoader = resolve;
        })
    );

    const first = resolveWithCache(slot, 100, loader);
    const second = resolveWithCache(slot, 100, loader);
    expect(loader).toHaveBeenCalledTimes(1);

    resolveLoader?.(42);
    await expect(first).resolves.toBe(42);
    await expect(second).resolves.toBe(42);
  });
});
