import { useRef, useCallback } from "react";
import { Effect } from "effect";

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const REQUEST_TIMEOUT = 5000;

export const useDeduplicatedRequest = <T>() => {
  const pendingRequests = useRef<Map<string, PendingRequest<T>>>(new Map());

  const execute = useCallback((key: string, effect: Effect.Effect<T, any>) => {
    const now = Date.now();
    const pending = pendingRequests.current.get(key);

    if (pending && now - pending.timestamp < REQUEST_TIMEOUT) {
      return pending.promise;
    }

    const promise = Effect.runPromise(effect);
    pendingRequests.current.set(key, { promise, timestamp: now });

    promise.finally(() => {
      pendingRequests.current.delete(key);
    });

    return promise;
  }, []);

  return { execute };
};
