import type { WsActiveAssetCtx } from "@0xsignal/sdk-hyperliquid/subscription";

type Ctx = WsActiveAssetCtx["ctx"];
type CtxListener = (ctx: Ctx) => void;
type ErrorHandler = (error: unknown) => void;

export type AssetCtxStream = {
  setVisible(coins: readonly string[]): void;
  dispose(): void;
};

export function createAssetCtxStream(options: {
  subscribe: (coin: string, listener: CtxListener, onError?: ErrorHandler) => () => void;
  onCtx: (coin: string, ctx: Ctx) => void;
  onError?: ErrorHandler;
}): AssetCtxStream {
  const unsubscribes = new Map<string, () => void>();
  let disposed = false;

  const reportError = (error: unknown): void => {
    options.onError?.(error);
  };

  const open = (coin: string): void => {
    let unsubscribe: () => void;
    try {
      unsubscribe = options.subscribe(
        coin,
        (ctx) => {
          try {
            options.onCtx(coin, ctx);
          } catch (error) {
            reportError(error);
          }
        },
        reportError,
      );
    } catch (error) {
      reportError(error);
      return;
    }
    if (disposed) {
      unsubscribe();
      return;
    }
    unsubscribes.set(coin, unsubscribe);
  };

  const close = (coin: string): void => {
    const unsubscribe = unsubscribes.get(coin);
    if (unsubscribe === undefined) return;
    unsubscribes.delete(coin);
    try {
      unsubscribe();
    } catch (error) {
      reportError(error);
    }
  };

  return {
    setVisible(coins) {
      if (disposed) return;
      const visible = new Set(coins);
      for (const coin of unsubscribes.keys()) {
        if (!visible.has(coin)) close(coin);
      }
      for (const coin of visible) {
        if (!unsubscribes.has(coin)) open(coin);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const coin of unsubscribes.keys()) close(coin);
      unsubscribes.clear();
    },
  };
}
