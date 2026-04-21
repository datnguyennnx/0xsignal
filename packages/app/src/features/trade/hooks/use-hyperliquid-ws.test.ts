import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useHyperliquidWs } from "./use-hyperliquid-ws";
import type {
  MarketSubscription,
  MarketStreamSubscription,
} from "../contexts/market-stream-context";

const { mockUseMarketStreamClient } = vi.hoisted(() => ({
  mockUseMarketStreamClient: vi.fn(),
}));

vi.mock("../contexts/market-stream-context", async () => {
  const actual = await vi.importActual<typeof import("../contexts/market-stream-context")>(
    "../contexts/market-stream-context"
  );

  return {
    ...actual,
    useMarketStreamClient: () => mockUseMarketStreamClient(),
  };
});

interface StreamCallbacks {
  onMessage: (
    data: unknown,
    channel: string,
    meta?: { nSigFigs?: number; interval?: string }
  ) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

interface CapturedSubscription {
  callbacks: StreamCallbacks;
  handle: MarketStreamSubscription;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useHyperliquidWs", () => {
  beforeEach(() => {
    mockUseMarketStreamClient.mockReset();
  });

  it("ignores stale subscription callbacks after precision resubscribe", async () => {
    const captured: CapturedSubscription[] = [];

    const subscribe = vi.fn(
      async (_subscription: MarketSubscription, callbacks: StreamCallbacks) => {
        const handle = {
          unsubscribe: vi.fn(),
        };
        captured.push({ callbacks, handle });
        return handle;
      }
    );

    mockUseMarketStreamClient.mockReturnValue({ subscribe });

    const onMessage = vi.fn();
    const onConnectionChange = vi.fn();

    const { rerender } = renderHook(
      ({ subscription }) =>
        useHyperliquidWs({
          subscription,
          enabled: true,
          onMessage,
          onConnectionChange,
        }),
      {
        initialProps: {
          subscription: { type: "l2Book", coin: "ETH", nSigFigs: 5 } as MarketSubscription,
        },
      }
    );

    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    rerender({ subscription: { type: "l2Book", coin: "ETH", nSigFigs: 3 } as MarketSubscription });

    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(2));

    onMessage.mockClear();
    onConnectionChange.mockClear();

    act(() => {
      captured[0].callbacks.onMessage({ levels: [] }, "l2Book");
      captured[0].callbacks.onConnectionChange?.(true);
    });

    expect(onMessage).not.toHaveBeenCalled();
    expect(onConnectionChange).not.toHaveBeenCalled();

    act(() => {
      captured[1].callbacks.onMessage({ levels: [] }, "l2Book");
      captured[1].callbacks.onConnectionChange?.(true);
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onConnectionChange).toHaveBeenCalledWith(true);
  });

  it("forwards optional meta while keeping non-l2 channels unchanged", async () => {
    const captured: CapturedSubscription[] = [];

    const subscribe = vi.fn(
      async (_subscription: MarketSubscription, callbacks: StreamCallbacks) => {
        const handle = {
          unsubscribe: vi.fn(),
        };
        captured.push({ callbacks, handle });
        return handle;
      }
    );

    mockUseMarketStreamClient.mockReturnValue({ subscribe });

    const onMessage = vi.fn();

    const { result } = renderHook(
      ({ subscription }) =>
        useHyperliquidWs({
          subscription,
          enabled: true,
          onMessage,
        }),
      {
        initialProps: {
          subscription: { type: "l2Book", coin: "ETH", nSigFigs: 5 } as MarketSubscription,
        },
      }
    );

    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isConnected).toBe(false));

    act(() => {
      captured[0].callbacks.onConnectionChange?.(true);
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      captured[0].callbacks.onMessage({ levels: [] }, "l2Book", { nSigFigs: 5 });
      captured[0].callbacks.onMessage({ p: "1" }, "trades");
    });

    expect(onMessage).toHaveBeenNthCalledWith(1, { levels: [] }, "l2Book", { nSigFigs: 5 });
    expect(onMessage).toHaveBeenNthCalledWith(2, { p: "1" }, "trades", undefined);

    await act(async () => {
      await result.current.resubscribe({ type: "l2Book", coin: "ETH", nSigFigs: 3 });
    });

    expect(subscribe).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      captured[1].callbacks.onMessage({ levels: [] }, "l2Book", { nSigFigs: 3 });
      captured[1].callbacks.onMessage({ p: "2" }, "trades");
    });

    expect(onMessage).toHaveBeenNthCalledWith(3, { levels: [] }, "l2Book", { nSigFigs: 3 });
    expect(onMessage).toHaveBeenNthCalledWith(4, { p: "2" }, "trades", undefined);
  });

  it("unsubscribes late stale subscription when a newer one wins", async () => {
    const captured: CapturedSubscription[] = [];
    const firstDeferred = createDeferred<MarketStreamSubscription>();

    const subscribe = vi.fn((subscription: MarketSubscription, callbacks: StreamCallbacks) => {
      const handle = {
        unsubscribe: vi.fn(),
      };
      captured.push({ callbacks, handle });

      if (subscription.nSigFigs === 5) {
        return firstDeferred.promise;
      }

      return Promise.resolve(handle);
    });

    mockUseMarketStreamClient.mockReturnValue({ subscribe });

    const onMessage = vi.fn();
    const onConnectionChange = vi.fn();

    const { rerender } = renderHook(
      ({ subscription }) =>
        useHyperliquidWs({
          subscription,
          enabled: true,
          onMessage,
          onConnectionChange,
        }),
      {
        initialProps: {
          subscription: { type: "l2Book", coin: "ETH", nSigFigs: 5 } as MarketSubscription,
        },
      }
    );

    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    rerender({ subscription: { type: "l2Book", coin: "ETH", nSigFigs: 3 } as MarketSubscription });

    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(2));

    firstDeferred.resolve(captured[0].handle);

    await waitFor(() => {
      expect(captured[0].handle.unsubscribe).toHaveBeenCalledTimes(1);
    });

    onMessage.mockClear();

    act(() => {
      captured[0].callbacks.onMessage({ levels: [] }, "l2Book");
      captured[1].callbacks.onMessage({ levels: [] }, "l2Book");
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("supports allMids resubscribe without coin", async () => {
    const captured: CapturedSubscription[] = [];

    const subscribe = vi.fn(
      async (_subscription: MarketSubscription, callbacks: StreamCallbacks) => {
        const handle = {
          unsubscribe: vi.fn(),
        };
        captured.push({ callbacks, handle });
        return handle;
      }
    );

    mockUseMarketStreamClient.mockReturnValue({ subscribe });

    const onMessage = vi.fn();
    const { result } = renderHook(
      ({ subscription }) =>
        useHyperliquidWs({
          subscription,
          enabled: true,
          onMessage,
        }),
      {
        initialProps: {
          subscription: { type: "allMids" } as MarketSubscription,
        },
      }
    );

    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    act(() => {
      captured[0].callbacks.onConnectionChange?.(true);
    });

    await act(async () => {
      await result.current.resubscribe({ type: "allMids" });
    });

    expect(subscribe).toHaveBeenCalledTimes(2);
  });
});
