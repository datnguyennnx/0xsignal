import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHyperliquidCandles } from "./use-hyperliquid-candles";

const { mockUseHyperliquidWs, mockUseCandleHistory, mockFetchByRange } = vi.hoisted(() => ({
  mockUseHyperliquidWs: vi.fn(),
  mockUseCandleHistory: vi.fn(),
  mockFetchByRange: vi.fn(),
}));

vi.mock("./use-hyperliquid-ws", async () => {
  const actual =
    await vi.importActual<typeof import("./use-hyperliquid-ws")>("./use-hyperliquid-ws");
  return {
    ...actual,
    useHyperliquidWs: mockUseHyperliquidWs,
  };
});

vi.mock("./use-candle-history", async () => {
  const actual =
    await vi.importActual<typeof import("./use-candle-history")>("./use-candle-history");
  return {
    ...actual,
    useCandleHistory: mockUseCandleHistory,
    fetchByRange: mockFetchByRange,
  };
});

describe("useHyperliquidCandles interval guard", () => {
  beforeEach(() => {
    mockUseHyperliquidWs.mockReset();
    mockUseCandleHistory.mockReset();
    mockUseCandleHistory.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    mockFetchByRange.mockReset();
    mockFetchByRange.mockResolvedValue([]);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("ignores stale candle frames and accepts active interval frames", () => {
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

    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    const { result } = renderHook(() =>
      useHyperliquidCandles({
        symbol: "ETH",
        interval: "1m",
        enabled: true,
      })
    );

    act(() => {
      capturedOnMessage?.(
        [{ t: 1716000000000, o: "100", h: "102", l: "99", c: "101", v: "25" }],
        "candle",
        { interval: "1h" }
      );
      vi.runAllTimers();
    });

    expect(result.current.data).toHaveLength(0);

    act(() => {
      capturedOnMessage?.(
        [{ t: 1716000000000, o: "100", h: "102", l: "99", c: "101", v: "25" }],
        "candle",
        { interval: "1m" }
      );
      vi.runAllTimers();
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]?.time).toBe(1716000000);
  });

  it("keeps hasMore true when a full page of older candles is returned", async () => {
    mockUseHyperliquidWs.mockImplementation(() => ({
      isConnected: true,
      resubscribe: vi.fn(),
      subscription: null,
    }));

    mockUseCandleHistory.mockReturnValue({
      data: [
        { time: 200, open: 1, high: 1, low: 1, close: 1, volume: 1 },
        { time: 300, open: 1, high: 1, low: 1, close: 1, volume: 1 },
      ],
      isLoading: false,
      error: null,
    });

    mockFetchByRange.mockResolvedValue([
      { time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { time: 60, open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { time: 120, open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { time: 180, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ]);

    const { result } = renderHook(() =>
      useHyperliquidCandles({
        symbol: "ETHUSDT",
        interval: "1m",
        enabled: true,
      })
    );

    await act(async () => {
      await result.current.loadMore(4);
    });

    expect(mockFetchByRange).toHaveBeenCalledOnce();
    expect(result.current.hasMore).toBe(true);
  });
});
