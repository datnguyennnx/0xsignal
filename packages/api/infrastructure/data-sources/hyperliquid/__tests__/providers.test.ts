import { describe, it, expect, vi } from "vitest";
import { Effect, Layer } from "effect";
import { getCandleSnapshot, getMetadata, getAllMids } from "../providers";
import { HyperliquidClient } from "../client";

const mockInfoClient = {
  candleSnapshot: vi.fn(),
  meta: vi.fn(),
  allMids: vi.fn(),
};

const TestHLClientLive = Layer.succeed(
  HyperliquidClient,
  HyperliquidClient.of({
    info: mockInfoClient as any,
  })
);

describe("Hyperliquid Providers", () => {
  it("getCandleSnapshot should call SDK and normalize results", async () => {
    mockInfoClient.candleSnapshot.mockResolvedValueOnce([
      { t: 1000, o: "1", h: "2", l: "0.5", c: "1.5", v: "10" },
    ]);

    const program = getCandleSnapshot("BTC", "1m", 0, 2000);
    const result = (await Effect.runPromise(program.pipe(Effect.provide(TestHLClientLive)))) as {
      universe: unknown[];
    };

    expect(mockInfoClient.candleSnapshot).toHaveBeenCalledWith({
      coin: "BTC",
      interval: "1m",
      startTime: 0,
      endTime: 2000,
    });
    expect(result).toHaveLength(1);
    expect(result[0].open).toBe(1);
  });

  it("getMetadata should call SDK and return data", async () => {
    mockInfoClient.meta.mockResolvedValueOnce({ universe: [] });

    const program = getMetadata();
    const result = await Effect.runPromise(program.pipe(Effect.provide(TestHLClientLive)));

    expect(mockInfoClient.meta).toHaveBeenCalled();
    expect(result.universe).toEqual([]);
  });

  it("should wrap HL SDK errors into HyperliquidError", async () => {
    mockInfoClient.allMids.mockRejectedValueOnce(new Error("Rate Limit"));

    const program = getAllMids().pipe(Effect.provide(TestHLClientLive));

    await expect(Effect.runPromise(program)).rejects.toThrow("Failed to fetch all mids");
  });
});
