import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHyperliquidOrderbook } from "./use-hyperliquid-orderbook";

const { mockUseHyperliquidWs } = vi.hoisted(() => ({
  mockUseHyperliquidWs: vi.fn(),
}));

vi.mock("./use-hyperliquid-ws", async () => {
  const actual =
    await vi.importActual<typeof import("./use-hyperliquid-ws")>("./use-hyperliquid-ws");
  return {
    ...actual,
    useHyperliquidWs: mockUseHyperliquidWs,
  };
});

describe("useHyperliquidOrderbook precision guard", () => {
  beforeEach(() => {
    mockUseHyperliquidWs.mockReset();
  });

  it("ignores l2Book frames from non-active nSigFigs", async () => {
    let capturedOnMessage:
      | ((data: unknown, channel: string, meta?: { nSigFigs?: number; interval?: string }) => void)
      | null = null;

    mockUseHyperliquidWs.mockImplementation(
      (opts: {
        onMessage: (
          data: unknown,
          channel: string,
          meta?: { nSigFigs?: number; interval?: string }
        ) => void;
      }) => {
        capturedOnMessage = opts.onMessage;
        return {
          isConnected: true,
          resubscribe: vi.fn(),
          subscription: null,
        };
      }
    );

    const rafSpy = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });

    const { result } = renderHook(() =>
      useHyperliquidOrderbook("ETH", true, { controlledNSigFigs: 5, adaptiveNSigFigs: false })
    );

    const fineLevels = {
      levels: [[{ px: "77746", sz: "1.5", n: 1 }], [{ px: "77747", sz: "2.1", n: 1 }]],
    };

    const coarseLevels = {
      levels: [[{ px: "77700", sz: "3.0", n: 1 }], [{ px: "77800", sz: "4.0", n: 1 }]],
    };

    act(() => {
      capturedOnMessage?.(fineLevels, "l2Book", { nSigFigs: 5 });
    });

    expect(result.current.fineBook?.bids[0]?.price).toBe(77746);
    expect(result.current.fineBook?.asks[0]?.price).toBe(77747);

    act(() => {
      capturedOnMessage?.(coarseLevels, "l2Book", { nSigFigs: 3 });
    });

    expect(result.current.fineBook?.bids[0]?.price).toBe(77746);
    expect(result.current.fineBook?.asks[0]?.price).toBe(77747);

    rafSpy.mockRestore();
  });
});
