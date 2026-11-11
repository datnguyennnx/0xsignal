import { useEffect, useRef } from "react";
import { createAssetCtxStream, type AssetCtxStream } from "../lib/asset-ctx-stream";
import { parseAssetCtx, type AssetCtxSnapshot } from "../lib/asset-ctx";
import { subscribeAssetCtx } from "../lib/hyperliquid-sink";
import { useMarketDataStore } from "@/stores/use-market-data-store";

const COIN_SEPARATOR = "\u0000";

const ignoreError = (): void => undefined;

export type CtxBatchUpdate = readonly [string, AssetCtxSnapshot];

export type CtxBuffer = {
  push(coin: string, snapshot: AssetCtxSnapshot): void;
  flush(): void;
};

/** Last snapshot per coin, drained into one commit per flush. */
export function createCtxBuffer(commit: (updates: readonly CtxBatchUpdate[]) => void): CtxBuffer {
  const pending = new Map<string, AssetCtxSnapshot>();
  return {
    push(coin, snapshot) {
      pending.set(coin, snapshot);
    },
    flush() {
      if (pending.size === 0) return;
      const updates: CtxBatchUpdate[] = [];
      for (const [coin, snapshot] of pending) updates.push([coin, snapshot]);
      pending.clear();
      commit(updates);
    },
  };
}

export function visibleCoinsKey(coins: readonly string[]): string {
  return Array.from(new Set(coins)).join(COIN_SEPARATOR);
}

export type VisibleCoinsSync = {
  apply(coins: readonly string[]): void;
  dispose(): void;
};

export function createVisibleCoinsSync(stream: AssetCtxStream): VisibleCoinsSync {
  let lastKey: string | null = null;
  let disposed = false;

  return {
    apply(coins) {
      if (disposed) return;
      const key = visibleCoinsKey(coins);
      if (key === lastKey) return;
      lastKey = key;
      stream.setVisible(coins);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stream.dispose();
    },
  };
}

type VisibleRuntime = {
  readonly stream: AssetCtxStream;
  readonly sync: VisibleCoinsSync;
};

export function useVisibleAssetCtx(coins: readonly string[]): void {
  const runtimeRef = useRef<VisibleRuntime | null>(null);
  const key = visibleCoinsKey(coins);

  useEffect(() => {
    const buffer = createCtxBuffer((updates) => {
      useMarketDataStore.getState().applyAssetCtxBatch(updates);
    });
    let cancelPending: (() => void) | null = null;

    const scheduleFlush = (): void => {
      if (cancelPending !== null) return;
      if (typeof requestAnimationFrame === "function") {
        const frame = requestAnimationFrame(() => {
          cancelPending = null;
          buffer.flush();
        });
        cancelPending = () => {
          cancelAnimationFrame(frame);
          cancelPending = null;
        };
        return;
      }
      let cancelled = false;
      cancelPending = () => {
        cancelled = true;
        cancelPending = null;
      };
      queueMicrotask(() => {
        if (cancelled) return;
        cancelPending = null;
        buffer.flush();
      });
    };

    const stream = createAssetCtxStream({
      subscribe: subscribeAssetCtx,
      onCtx: (coin, ctx) => {
        const parsed = parseAssetCtx(ctx);
        if (parsed === null) return;
        buffer.push(coin, parsed);
        scheduleFlush();
      },
      onError: ignoreError,
    });
    const sync = createVisibleCoinsSync(stream);
    runtimeRef.current = { stream, sync };
    return () => {
      cancelPending?.();
      cancelPending = null;
      sync.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const visible = key === "" ? [] : key.split(COIN_SEPARATOR);
    runtimeRef.current?.sync.apply(visible);
  }, [key]);
}
